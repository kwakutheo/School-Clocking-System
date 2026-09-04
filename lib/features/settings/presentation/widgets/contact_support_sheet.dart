import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/core/network/api_endpoints.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';

/// A modal bottom sheet for contacting Super Admins and HR Admins via Phone Call
/// and WhatsApp. Supervisors and general employees are strictly excluded.
class ContactSupportSheet extends StatefulWidget {
  const ContactSupportSheet({super.key, this.user});

  final UserEntity? user;

  /// Displays the contact support bottom sheet.
  static void show(BuildContext context, {UserEntity? user}) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ContactSupportSheet(user: user),
    );
  }

  @override
  State<ContactSupportSheet> createState() => _ContactSupportSheetState();
}

class _ContactSupportSheetState extends State<ContactSupportSheet> {
  final _storage = sl<StorageService>();
  final _api = sl<ApiClient>();

  bool _loading = true;
  String? _errorMessage;
  List<Map<String, dynamic>> _admins = [];

  @override
  void initState() {
    super.initState();
    _loadAdmins();
  }

  List<Map<String, dynamic>> _parseAdmins(dynamic raw) {
    if (raw is Map && raw['data'] is List) {
      raw = raw['data'];
    }
    if (raw is! List) return [];
    final list = <Map<String, dynamic>>[];
    for (final item in raw) {
      if (item is Map) {
        final map = Map<String, dynamic>.from(item);
        final role = map['role']?.toString().toLowerCase();
        final phone = map['phone']?.toString().trim() ?? '';
        // STRICT FILTER: Only Super Admin and HR Admin with valid phone number!
        // Supervisors and regular employees are strictly excluded.
        if ((role == 'super_admin' || role == 'hr_admin') && phone.isNotEmpty) {
          list.add(map);
        }
      }
    }
    return list;
  }

  Future<void> _loadAdmins() async {
    // 1. Load from local cache first for instant display / offline support
    final cachedJson = _storage.getSchoolAdminsJson();
    if (cachedJson != null && cachedJson.isNotEmpty) {
      try {
        final decoded = jsonDecode(cachedJson);
        final cachedList = _parseAdmins(decoded);
        if (cachedList.isNotEmpty && mounted) {
          setState(() {
            _admins = cachedList;
            _loading = false;
          });
        }
      } catch (_) {}
    }

    // 2. Fetch fresh contacts from backend
    try {
      final response = await _api.get(ApiEndpoints.schoolAdmins);
      if (response.data != null) {
        final freshList = _parseAdmins(response.data);
        if (mounted) {
          setState(() {
            _admins = freshList;
            _loading = false;
            _errorMessage = null;
          });
        }
        await _storage.saveSchoolAdminsJson(jsonEncode(response.data));
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          if (_admins.isEmpty) {
            _errorMessage =
                'Could not reach server to load administrator contacts.';
          }
        });
      }
    }
  }

  Future<void> _makePhoneCall(BuildContext context, String phoneNumber) async {
    final cleaned = phoneNumber.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri(scheme: 'tel', path: cleaned);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        final launched = await launchUrl(uri);
        if (!launched && context.mounted) {
          await _copyToClipboard(
              context, phoneNumber, 'Phone number copied to clipboard');
        }
      }
    } catch (_) {
      if (context.mounted) {
        await _copyToClipboard(
            context, phoneNumber, 'Phone number copied to clipboard');
      }
    }
  }

  String _normalizeForWhatsApp(String phone) {
    // Remove non-numeric characters
    String digits = phone.replaceAll(RegExp(r'\D'), '');
    // In Ghana (or local 10-digit number e.g. 024XXXXXXX), convert leading 0 to country code 233
    if (digits.startsWith('0') && digits.length == 10) {
      digits = '233${digits.substring(1)}';
    }
    return digits;
  }

  Future<void> _openWhatsApp(
    BuildContext context, {
    required String adminName,
    required String phoneNumber,
  }) async {
    final cleanPhone = _normalizeForWhatsApp(phoneNumber);
    if (cleanPhone.isEmpty) {
      if (context.mounted) {
        _copyToClipboard(
            context, phoneNumber, 'Phone number copied to clipboard');
      }
      return;
    }

    final staffName = widget.user?.fullName ?? 'Staff Member';
    final staffId = widget.user?.employeeCode ?? widget.user?.username ?? 'N/A';
    final school = widget.user?.schoolName ?? 'N/A';
    final branch = widget.user?.branchName ?? 'N/A';

    final message = 'Hello $adminName,\n'
        'I am $staffName (Staff ID: $staffId) from $school ($branch).\n'
        'I require assistance regarding the School Clocking System with [Geofence / Device Reset / Attendance].\n'
        'Thank you.';

    final uri = Uri.parse(
      'https://wa.me/$cleanPhone?text=${Uri.encodeComponent(message)}',
    );

    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        final launched =
            await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!launched && context.mounted) {
          await _copyToClipboard(
              context, phoneNumber, 'Phone number copied to clipboard');
        }
      }
    } catch (_) {
      if (context.mounted) {
        await _copyToClipboard(
            context, phoneNumber, 'Phone number copied to clipboard');
      }
    }
  }

  Future<void> _copyToClipboard(
      BuildContext context, String text, String message) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final media = MediaQuery.of(context);

    final schoolName = widget.user?.schoolName ?? 'School Administration';
    final branchName = widget.user?.branchName ?? 'Campus Support Desk';
    final staffCode = widget.user?.employeeCode ?? widget.user?.username ?? '';

    return Container(
      constraints: BoxConstraints(
        maxHeight: media.size.height * 0.88,
      ),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Drag Handle ────────────────────────────────────────────────
              Center(
                child: Container(
                  width: 44,
                  height: 4.5,
                  decoration: BoxDecoration(
                    color: cs.onSurfaceVariant.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // ── Header ────────────────────────────────────────────────────
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: cs.primaryContainer,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.support_agent_rounded,
                      color: cs.onPrimaryContainer,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Contact School Admins',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Calls & WhatsApp with Super Admin & HR Admin',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                    tooltip: 'Close',
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // ── Staff Profile Info Card ───────────────────────────────────
              Card(
                elevation: 0,
                color: cs.surfaceContainerHighest.withValues(alpha: 0.4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: cs.outlineVariant.withValues(alpha: 0.5),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.school_rounded,
                              size: 18, color: cs.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              schoolName,
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Branch: $branchName',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                      if (staffCode.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Staff Code: $staffCode',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: cs.primary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // ── Administrator Contacts List ──────────────────────────────
              Text(
                'SCHOOL ADMINISTRATORS',
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1,
                  color: cs.primary,
                ),
              ),
              const SizedBox(height: 8),

              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_admins.isEmpty)
                Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(
                      color: cs.outlineVariant.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        Icon(
                          Icons.contact_phone_outlined,
                          size: 40,
                          color: cs.onSurfaceVariant.withValues(alpha: 0.5),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'No Admin Phone Numbers Found',
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _errorMessage ??
                              'Your school administration has not registered contact phone numbers for Super Admin or HR Admin yet. Please visit the school office for in-person support.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _loadAdmins,
                          icon: const Icon(Icons.refresh_rounded, size: 16),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ..._admins.map((admin) {
                  final name = admin['fullName']?.toString() ?? 'Administrator';
                  final role = admin['role']?.toString().toLowerCase();
                  final isSuper = role == 'super_admin';
                  final roleLabel = isSuper ? 'Super Admin' : 'HR Admin';
                  final phone = admin['phone']?.toString() ?? '';

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(
                          color: cs.outlineVariant.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: isSuper
                                        ? cs.primaryContainer
                                        : cs.secondaryContainer,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    isSuper
                                        ? Icons.admin_panel_settings_rounded
                                        : Icons.badge_outlined,
                                    color: isSuper
                                        ? cs.onPrimaryContainer
                                        : cs.onSecondaryContainer,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: theme.textTheme.titleSmall
                                            ?.copyWith(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: (isSuper
                                                      ? cs.primary
                                                      : cs.secondary)
                                                  .withValues(alpha: 0.12),
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              roleLabel,
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w600,
                                                color: isSuper
                                                    ? cs.primary
                                                    : cs.secondary,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            phone,
                                            style: theme.textTheme.bodyMedium
                                                ?.copyWith(
                                              fontFamily: 'monospace',
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),

                            // ── Action Buttons: Call & WhatsApp ───────────
                            Row(
                              children: [
                                Expanded(
                                  child: FilledButton.icon(
                                    onPressed: () =>
                                        _makePhoneCall(context, phone),
                                    icon: const Icon(Icons.call_rounded,
                                        size: 16),
                                    label: const Text('Call'),
                                    style: FilledButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 10),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton.tonalIcon(
                                    onPressed: () => _openWhatsApp(
                                      context,
                                      adminName: name,
                                      phoneNumber: phone,
                                    ),
                                    icon: const Icon(
                                      Icons.chat_bubble_outline_rounded,
                                      size: 16,
                                    ),
                                    label: const Text('WhatsApp'),
                                    style: FilledButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 10),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                IconButton.outlined(
                                  onPressed: () => _copyToClipboard(
                                    context,
                                    phone,
                                    'Phone number copied',
                                  ),
                                  icon:
                                      const Icon(Icons.copy_rounded, size: 16),
                                  tooltip: 'Copy Number',
                                  style: IconButton.styleFrom(
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}
