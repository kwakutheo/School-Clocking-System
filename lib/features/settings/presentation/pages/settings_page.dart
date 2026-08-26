import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/services/app_update_service.dart';
import 'package:tk_clocking_system/core/services/biometric_service.dart';
import 'package:tk_clocking_system/core/services/device_id_service.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/core/theme/theme_cubit.dart';
import 'package:tk_clocking_system/core/services/geofence_service.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_event.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_state.dart';
import 'package:tk_clocking_system/core/services/notification_service.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  // ── Services ──────────────────────────────────────────────────────────────
  final _storage = sl<StorageService>();
  final _biometric = sl<BiometricService>();
  final _deviceIdService = sl<DeviceIdService>();
  final _updateService = sl<AppUpdateService>();
  final _geofence = sl<GeofenceService>();
  final _notificationService = sl<NotificationService>();

  // ── State ─────────────────────────────────────────────────────────────────
  bool _biometricEnabled = false;
  bool _biometricSupported = false;
  bool _checkingUpdate = false;
  bool _notificationsEnabled = true;

  String _deviceId = '—';
  String _appVersion = '—';
  String _serverUrl = '—';
  String _timeStatus = 'Checking…';

  @override
  void initState() {
    super.initState();
    _loadData();
    _geofence.checkGeofence();
  }

  Future<void> _loadData() async {
    // Load biometric status
    final supported = await _biometric.isSecurityEnrolled();
    final secureId = await _storage.getSecureIdentifier();
    final isEnabledPref = _storage.getBiometricEnabled() ?? true;
    final notifsEnabledPref = _storage.getNotificationsEnabled() ?? true;

    // Load device ID
    final deviceId = await _deviceIdService.getDeviceId();

    // Load app version
    final info = await PackageInfo.fromPlatform();

    // Determine School Portal URL from subdomain slug
    final slug = _storage.getSubdomainSlug();
    final portalUrl = (slug != null && slug.isNotEmpty)
        ? '$slug.tkclocking.online'
        : 'Not available yet';

    // Time offset check
    final offset = _storage.getLastKnownTimeOffset();
    final timeStatus = offset == null
        ? 'Not checked yet'
        : offset.abs() > 30000 // > 30 seconds offset
            ? '⚠ Out of Sync'
            : '✓ Valid';

    if (!mounted) return;
    setState(() {
      _biometricSupported = supported;
      _biometricEnabled =
          isEnabledPref && (secureId != null && secureId.isNotEmpty);
      _notificationsEnabled = notifsEnabledPref;
      _deviceId = deviceId;
      String buildNum = info.buildNumber;
      if (buildNum.startsWith('20') && buildNum.length == 4) {
        buildNum = buildNum.substring(2);
      }
      _appVersion = '${info.version}.$buildNum';
      _serverUrl = portalUrl;
      _timeStatus = timeStatus;
    });
  }

  // ── Manual Time Check ─────────────────────────────────────────────────────
  Future<void> _checkTime() async {
    if (!mounted) return;
    setState(() => _timeStatus = 'Checking…');

    final timeService = sl<TimeService>();
    await timeService.syncTime();

    final offset = _storage.getLastKnownTimeOffset();
    final timeStatus = offset == null
        ? 'Not checked yet'
        : offset.abs() > 30000
            ? '⚠ Out of Sync'
            : '✓ Valid';

    if (!mounted) return;
    setState(() {
      _timeStatus = timeStatus;
    });
  }

  // ── Biometric toggle ──────────────────────────────────────────────────────
  Future<void> _toggleBiometric(bool value) async {
    await _storage.saveBiometricEnabled(value);

    if (value) {
      // Enable: prompt for password to store credentials
      await _showBiometricEnableDialog();
    } else {
      // Disable: clear stored credentials
      await _storage.clearSecureCredentials();
      if (mounted) setState(() => _biometricEnabled = false);
    }
  }

  Future<void> _showBiometricEnableDialog() async {
    final passwordController = TextEditingController();
    bool obscure = true;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setStateDlg) => AlertDialog(
          title: const Text('Enable Biometric Login'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Enter your password to store your credentials securely for biometric login.',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passwordController,
                obscureText: obscure,
                decoration: InputDecoration(
                  labelText: 'Password',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined),
                    onPressed: () => setStateDlg(() => obscure = !obscure),
                  ),
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (passwordController.text.trim().isNotEmpty) {
                  Navigator.pop(dialogCtx, true);
                }
              },
              child: const Text('Enable'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && mounted) {
      final username = _storage.getOfflineIdentifier();
      if (username != null) {
        await _storage.saveSecureIdentifier(username);
        await _storage.saveSecurePassword(passwordController.text.trim());
      }
      setState(() => _biometricEnabled = true);
    } else if (confirmed != true && mounted) {
      // Revert preference if they canceled the dialog
      await _storage.saveBiometricEnabled(false);
      setState(() => _biometricEnabled = false);
    }
    passwordController.dispose();
  }

  // ── Check for updates ─────────────────────────────────────────────────────
  Future<void> _checkForUpdates() async {
    if (_checkingUpdate) return;
    setState(() => _checkingUpdate = true);
    try {
      final update = await _updateService.checkForUpdate();
      if (!mounted) return;
      if (update == null) {
        _showSnack('You\'re on the latest version.');
      } else {
        _promptUpdate(update);
      }
    } catch (_) {
      if (mounted) _showSnack('Could not check for updates.');
    } finally {
      if (mounted) setState(() => _checkingUpdate = false);
    }
  }

  void _promptUpdate(AppUpdateInfo update) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.system_update_rounded),
        title: const Text('Update Available'),
        content: Text(
          'A new version (v${update.versionName}.${update.versionCode}) is available.\n\n${update.releaseNotes}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Later'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              _showSnack('Downloading update in background...');
              _updateService.downloadAndOpenInstaller(update).catchError((e) {
                if (mounted) _showSnack('Failed to start download: $e');
              });
            },
            child: const Text('Download & Install'),
          ),
        ],
      ),
    );
  }

  // ── Clear cache ───────────────────────────────────────────────────────────
  Future<void> _clearCache() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.warning_amber_rounded, color: Colors.orange),
        title: const Text('Clear App Cache?'),
        content: const Text(
          'This will wipe all offline data, clear your saved login credentials, '
          'and log you out. The app will return to a fresh state.\n\n'
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear & Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await _storage.clearSession();
      await _storage.clearOfflineCredentials();
      await _storage.clearSecureCredentials();
      if (mounted) {
        context.read<AuthBloc>().add(const AuthLogoutEvent());
      }
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final currentTheme = context.watch<ThemeCubit>().state;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          // ── Appearance ─────────────────────────────────────────────────
          _SectionHeader(title: 'Appearance'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('App Theme', style: tt.titleSmall),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: SegmentedButton<ThemeMode>(
                        segments: const [
                          ButtonSegment(
                            value: ThemeMode.light,
                            icon: Icon(Icons.light_mode_outlined),
                            label: Text('Light'),
                          ),
                          ButtonSegment(
                            value: ThemeMode.dark,
                            icon: Icon(Icons.dark_mode_outlined),
                            label: Text('Dark'),
                          ),
                          ButtonSegment(
                            value: ThemeMode.system,
                            icon: Icon(Icons.brightness_auto_outlined),
                            label: Text('Auto'),
                          ),
                        ],
                        selected: {currentTheme},
                        onSelectionChanged: (modes) =>
                            context.read<ThemeCubit>().setTheme(modes.first),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Security ───────────────────────────────────────────────────
          _SectionHeader(title: 'Security'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: Column(
                children: [
                  SwitchListTile(
                    secondary: Icon(
                      Icons.fingerprint_rounded,
                      color: _biometricEnabled ? cs.primary : null,
                    ),
                    title: const Text('Biometric Login'),
                    subtitle: Text(
                      _biometricSupported
                          ? 'Use fingerprint or face to sign in quickly'
                          : 'Not available on this device',
                    ),
                    value: _biometricEnabled,
                    onChanged: _biometricSupported ? _toggleBiometric : null,
                  ),
                ],
              ),
            ),
          ),

          // ── Device & App Info ──────────────────────────────────────────
          _SectionHeader(title: 'Device & App Info'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: Column(
                children: [
                  _InfoTile(
                    icon: Icons.phone_android_rounded,
                    title: 'Device ID',
                    value: _deviceId,
                    onCopy: () {
                      Clipboard.setData(ClipboardData(text: _deviceId));
                      _showSnack('Device ID copied to clipboard');
                    },
                  ),
                  const Divider(height: 1, indent: 56),
                  _InfoTile(
                    icon: Icons.dns_outlined,
                    title: 'School Portal URL',
                    value: _serverUrl,
                    onCopy: () {
                      Clipboard.setData(ClipboardData(text: _serverUrl));
                      _showSnack('URL copied to clipboard');
                    },
                  ),
                  const Divider(height: 1, indent: 56),
                  _InfoTile(
                    icon: Icons.info_outline_rounded,
                    title: 'App Version',
                    value: _appVersion,
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.system_update_alt_rounded),
                    title: const Text('Check for Updates'),
                    trailing: _checkingUpdate
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
                    onTap: _checkForUpdates,
                  ),
                ],
              ),
            ),
          ),

          // ── Notifications ──────────────────────────────────────────────
          _SectionHeader(title: 'Notifications'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: SwitchListTile(
                secondary: const Icon(Icons.notifications_active_rounded),
                title: const Text('Shift Reminders'),
                subtitle:
                    const Text('Get alerts for upcoming shifts & clock-outs'),
                value: _notificationsEnabled,
                onChanged: _toggleNotifications,
                activeThumbColor: cs.onPrimary,
                activeTrackColor: cs.primary,
              ),
            ),
          ),

          // ── Device Time ────────────────────────────────────────────────
          _SectionHeader(title: 'Device Time Integrity'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: ListTile(
                leading: Icon(
                  _timeStatus.contains('⚠')
                      ? Icons.warning_amber_rounded
                      : Icons.schedule_rounded,
                  color: _timeStatus.contains('⚠') ? Colors.orange : cs.primary,
                ),
                title: const Text('Device Clock Status'),
                subtitle: Text(_timeStatus),
                trailing: _timeStatus == 'Checking…'
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : IconButton(
                        icon: const Icon(Icons.refresh_rounded),
                        onPressed: _checkTime,
                        tooltip: 'Check time sync',
                      ),
              ),
            ),
          ),

          // ── GPS Diagnostics ────────────────────────────────────────────
          _SectionHeader(title: 'GPS Location Diagnostics'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: ListenableBuilder(
                listenable: _geofence,
                builder: (context, _) {
                  final isChecking = _geofence.checkingLocation;
                  final error = _geofence.locationError;
                  final inZone = _geofence.isInWorkZone;

                  String statusText;
                  Color statusColor;
                  IconData statusIcon;

                  if (isChecking) {
                    statusText = 'Checking location...';
                    statusColor = cs.primary;
                    statusIcon = Icons.my_location_rounded;
                  } else if (error != null) {
                    statusText = error;
                    statusColor = Colors.orange;
                    statusIcon = Icons.location_disabled_rounded;
                  } else if (inZone == true) {
                    statusText = 'Inside School Boundary';
                    statusColor = Colors.green;
                    statusIcon = Icons.domain_verification_rounded;
                  } else if (inZone == false) {
                    statusText = 'Outside School Boundary';
                    statusColor = cs.error;
                    statusIcon = Icons.wrong_location_rounded;
                  } else {
                    statusText = 'Location Data Missing';
                    statusColor = cs.onSurfaceVariant;
                    statusIcon = Icons.location_off_rounded;
                  }

                  return Column(
                    children: [
                      ListTile(
                        leading: Icon(statusIcon, color: statusColor),
                        title: const Text('Geofence Status'),
                        subtitle: Text(statusText,
                            style: TextStyle(color: statusColor)),
                        trailing: isChecking
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : IconButton(
                                icon: const Icon(Icons.refresh_rounded),
                                onPressed: () => _geofence.checkGeofence(),
                                tooltip: 'Refresh Location',
                              ),
                      ),
                      if (_geofence.data?.branchRadius != null)
                        const Divider(height: 1, indent: 56),
                      if (_geofence.data?.branchRadius != null)
                        ListTile(
                          leading: const Icon(Icons.radar_rounded),
                          title: const Text('Configured Geofence Radius'),
                          subtitle: Text(
                              '${_geofence.data!.branchRadius!.toInt()} meters'),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),

          // ── Data ───────────────────────────────────────────────────────
          _SectionHeader(title: 'Data'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: Column(
                children: [
                  // Offline Sync
                  ValueListenableBuilder<Box<Map>>(
                    valueListenable:
                        Hive.box<Map>(AppConstants.attendanceBox).listenable(),
                    builder: (context, box, _) {
                      final unsynced = box.values
                          .where((item) =>
                              item['sync_status'] == 'pending' ||
                              item['sync_status'] == 'failed')
                          .length;

                      return BlocBuilder<AttendanceBloc, AttendanceState>(
                        builder: (context, attendanceState) {
                          final isSyncing =
                              attendanceState is AttendanceSyncInProgress;

                          return ListTile(
                            leading: Icon(
                              unsynced > 0
                                  ? Icons.cloud_off_rounded
                                  : Icons.cloud_done_rounded,
                              color:
                                  unsynced > 0 ? Colors.orange : Colors.green,
                            ),
                            title: const Text('Offline Database Status'),
                            subtitle: Text(
                              unsynced > 0
                                  ? '$unsynced record(s) waiting to sync'
                                  : 'All records synced to server',
                            ),
                            trailing: isSyncing
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  )
                                : unsynced > 0
                                    ? IconButton(
                                        onPressed: () {
                                          context
                                              .read<AttendanceBloc>()
                                              .add(const AttendanceSyncEvent());
                                        },
                                        icon: const Icon(Icons.sync_rounded),
                                        tooltip: 'Sync Now',
                                        color: cs.primary,
                                      )
                                    : null,
                          );
                        },
                      );
                    },
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: Icon(Icons.delete_sweep_rounded, color: cs.error),
                    title: Text('Clear App Cache',
                        style: TextStyle(color: cs.error)),
                    subtitle: const Text('Log out & wipe local records'),
                    onTap: _clearCache,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  // ── Notifications toggle ──────────────────────────────────────────────────
  Future<void> _toggleNotifications(bool value) async {
    await _storage.saveNotificationsEnabled(value);
    setState(() => _notificationsEnabled = value);

    if (value) {
      // Re-schedule shift reminders based on cached home data
      await _notificationService.scheduleCachedShiftReminders();
    } else {
      // Cancel existing ones
      await _notificationService.cancelShiftReminders();
    }
  }
}

// ── Section header ──────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 16, 4),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
      ),
    );
  }
}

// ── Info tile with optional copy button ─────────────────────────────────────
class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.title,
    required this.value,
    this.onCopy,
  });

  final IconData icon;
  final String title;
  final String value;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(
        value,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontFamily: 'monospace',
            ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: onCopy != null
          ? IconButton(
              icon: const Icon(Icons.copy_outlined, size: 18),
              onPressed: onCopy,
              tooltip: 'Copy',
            )
          : null,
    );
  }
}
