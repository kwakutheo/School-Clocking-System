import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A modal bottom sheet displaying the Privacy Policy & Location Notice
/// loaded from [assets/Privacy Policy/privacy_policy.json].
class PrivacyPolicySheet extends StatefulWidget {
  const PrivacyPolicySheet({super.key});

  /// Displays the privacy policy modal.
  static void show(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const PrivacyPolicySheet(),
    );
  }

  @override
  State<PrivacyPolicySheet> createState() => _PrivacyPolicySheetState();
}

class _PrivacyPolicySheetState extends State<PrivacyPolicySheet> {
  bool _loading = true;
  String? _errorMessage;
  String _title = 'Privacy Policy & Location Notice';
  String _lastUpdated = 'September 2026';
  List<Map<String, dynamic>> _sections = [];

  @override
  void initState() {
    super.initState();
    _loadPolicy();
  }

  Future<void> _loadPolicy() async {
    try {
      final jsonString = await rootBundle
          .loadString('assets/Privacy Policy/privacy_policy.json');
      final data = jsonDecode(jsonString) as Map<String, dynamic>;

      final rawSections = data['sections'] as List<dynamic>? ?? [];
      final sections = rawSections
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

      if (mounted) {
        setState(() {
          _title = data['title']?.toString() ?? _title;
          _lastUpdated = data['last_updated']?.toString() ?? _lastUpdated;
          _sections = sections;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load Privacy Policy: $e';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final media = MediaQuery.of(context);

    return Container(
      height: media.size.height * 0.88,
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
      child: Column(
        children: [
          // ── Drag Handle ──────────────────────────────────────────────────
          const SizedBox(height: 12),
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

          // ── Header ────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 12, 10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: cs.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.security_rounded,
                    color: cs.onPrimaryContainer,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'Last updated: $_lastUpdated',
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
          ),
          const Divider(height: 1),

          // ── Content ───────────────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.error_outline_rounded,
                                  color: cs.error, size: 40),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: TextStyle(color: cs.error),
                              ),
                              const SizedBox(height: 16),
                              FilledButton.tonal(
                                onPressed: _loadPolicy,
                                child: const Text('Try Again'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
                        children: [
                          // ── Trust & Transparency Callout Card ───────────────
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  cs.primaryContainer.withValues(alpha: 0.5),
                                  cs.surfaceContainerHighest
                                      .withValues(alpha: 0.4),
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: cs.primary.withValues(alpha: 0.25),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      Icons.verified_user_rounded,
                                      color: cs.primary,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Staff Data Protection Commitments',
                                      style:
                                          theme.textTheme.titleSmall?.copyWith(
                                        fontWeight: FontWeight.bold,
                                        color: cs.primary,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                _buildHighlightRow(
                                  context,
                                  icon: Icons.location_on_outlined,
                                  title: 'Point-in-Time Location Only',
                                  subtitle:
                                      'Location is accessed ONLY when you perform clocking actions. No 24/7 background tracking.',
                                ),
                                const SizedBox(height: 8),
                                _buildHighlightRow(
                                  context,
                                  icon: Icons.qr_code_scanner_rounded,
                                  title: 'Dual Verification for QR Clocking',
                                  subtitle:
                                      'QR code scanning still requires and validates GPS within the campus geofence to prevent photocopy or remote clocking fraud.',
                                ),
                                const SizedBox(height: 8),
                                _buildHighlightRow(
                                  context,
                                  icon: Icons.fingerprint_rounded,
                                  title: 'Device-Isolated Biometrics',
                                  subtitle:
                                      'Fingerprint and Face Unlock execute on-device and never leave your phone hardware.',
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // ── Render All Sections ────────────────────────────
                          ..._sections.map((section) {
                            final heading =
                                section['heading']?.toString() ?? '';
                            final content =
                                section['content']?.toString() ?? '';
                            final highlights =
                                (section['highlights'] as List<dynamic>?)
                                        ?.map((e) => e.toString())
                                        .toList() ??
                                    [];

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Card(
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  side: BorderSide(
                                    color: cs.outlineVariant
                                        .withValues(alpha: 0.4),
                                  ),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        heading,
                                        style: theme.textTheme.titleSmall
                                            ?.copyWith(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        content,
                                        style: theme.textTheme.bodyMedium
                                            ?.copyWith(
                                          height: 1.5,
                                          color: cs.onSurface,
                                        ),
                                      ),
                                      if (highlights.isNotEmpty) ...[
                                        const SizedBox(height: 10),
                                        Wrap(
                                          spacing: 6,
                                          runSpacing: 6,
                                          children: highlights.map((h) {
                                            return Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                horizontal: 8,
                                                vertical: 4,
                                              ),
                                              decoration: BoxDecoration(
                                                color: cs.secondaryContainer
                                                    .withValues(alpha: 0.4),
                                                borderRadius:
                                                    BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                '✓ $h',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w500,
                                                  color: cs
                                                      .onSecondaryContainer,
                                                ),
                                              ),
                                            );
                                          }).toList(),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),

                          const SizedBox(height: 8),
                          FilledButton(
                            onPressed: () => Navigator.of(context).pop(),
                            style: FilledButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: const Text('I Understand'),
                          ),
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildHighlightRow(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: cs.primary),
        const SizedBox(width: 8),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurface),
              children: [
                TextSpan(
                  text: '$title: ',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                TextSpan(text: subtitle),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
