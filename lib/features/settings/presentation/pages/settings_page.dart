import 'dart:convert';
import 'package:crypto/crypto.dart';
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
import 'package:tk_clocking_system/features/auth/data/models/user_model.dart';
import 'package:tk_clocking_system/features/settings/presentation/widgets/faq_bottom_sheet.dart';
import 'package:tk_clocking_system/features/settings/presentation/widgets/contact_support_sheet.dart';
import 'package:tk_clocking_system/features/settings/presentation/widgets/privacy_policy_sheet.dart';

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
  bool _hapticFeedbackEnabled = true;

  UserModel? _currentUser;
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
    final hapticEnabled = _storage.getHapticFeedbackEnabled();

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

    // Load current user profile for school support context
    UserModel? currentUser;
    final userJson = _storage.getUserJson();
    if (userJson != null) {
      try {
        currentUser = UserModel.fromJson(
            jsonDecode(userJson) as Map<String, dynamic>);
      } catch (_) {}
    }

    if (!mounted) return;
    setState(() {
      _currentUser = currentUser;
      _biometricSupported = supported;
      _biometricEnabled =
          isEnabledPref && (secureId != null && secureId.isNotEmpty);
      _notificationsEnabled = notifsEnabledPref;
      _hapticFeedbackEnabled = hapticEnabled;
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
    // Before applying the toggle, demand the user's password for verification.
    final verified = await _verifyPasswordForBiometrics(value);

    if (!verified) {
      // If verification failed or dialog was dismissed, revert the visual toggle state
      if (mounted) setState(() {});
      return;
    }

    // Success! Update storage and state.
    await _storage.saveBiometricEnabled(value);

    if (value) {
      // Enabling: The password was already saved securely inside the dialog wrapper
      if (mounted) setState(() => _biometricEnabled = true);
    } else {
      // Disabling: clear stored credentials
      await _storage.clearSecureCredentials();
      if (mounted) setState(() => _biometricEnabled = false);
    }
  }

  Future<bool> _verifyPasswordForBiometrics(bool enabling) async {
    final passwordController = TextEditingController();
    final username = _storage.getOfflineIdentifier();

    if (username == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('No active session found.'),
              backgroundColor: Colors.red),
        );
      }
      return false;
    }

    bool obscure = true;
    bool isVerifying = false;
    String? errorText;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setStateDlg) => AlertDialog(
          title: Text(
              enabling ? 'Enable Biometric Login' : 'Disable Biometric Login'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                enabling
                    ? 'Enter your password to verify your identity and securely store your credentials.'
                    : 'Enter your password to verify your identity and disable biometric login.',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passwordController,
                obscureText: obscure,
                enabled: !isVerifying,
                decoration: InputDecoration(
                  labelText: 'Password',
                  errorText: errorText,
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
              onPressed:
                  isVerifying ? null : () => Navigator.pop(dialogCtx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: isVerifying
                  ? null
                  : () async {
                      final pwd = passwordController.text.trim();
                      if (pwd.isEmpty) return;

                      setStateDlg(() {
                        isVerifying = true;
                        errorText = null;
                      });

                      final storedHash = _storage.getOfflinePasswordHash();
                      final enteredHash = _hashPassword(pwd);

                      if (storedHash != null && enteredHash == storedHash) {
                        Navigator.pop(dialogCtx, true);
                      } else {
                        setStateDlg(() {
                          isVerifying = false;
                          errorText = 'Incorrect password. Please try again.';
                        });
                      }
                    },
              child: isVerifying
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(enabling ? 'Enable' : 'Disable'),
            ),
          ],
        ),
      ),
    );

    final finalPassword = passwordController.text.trim();
    passwordController.dispose();

    if (confirmed == true && enabling) {
      await _storage.saveSecureIdentifier(username);
      await _storage.saveSecurePassword(finalPassword);
    }

    return confirmed ?? false;
  }

  String _hashPassword(String password) {
    final bytes = utf8.encode(password);
    return sha256.convert(bytes).toString();
  }

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
      barrierDismissible: false,
      builder: (ctx) {
        bool isDownloading = false;
        double progress = 0.0;
        String? errorMessage;
        // Non-null when APK is downloaded but install needs permission retry.
        String? downloadedApkPath;
        bool needsPermission = false;

        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> tryInstall(String apkPath) async {
              setDialogState(() {
                needsPermission = false;
                errorMessage = null;
              });
              try {
                await _updateService.openDownloadedApk(apkPath);
                if (ctx.mounted) Navigator.pop(ctx);
              } on InstallPermissionRequiredException catch (e) {
                setDialogState(() {
                  needsPermission = true;
                  downloadedApkPath = e.apkPath;
                  errorMessage = e.message;
                });
              } catch (e) {
                setDialogState(() {
                  needsPermission = false;
                  errorMessage = 'Install failed: $e';
                });
              }
            }

            return AlertDialog(
              title: Text(
                isDownloading
                    ? 'Downloading Update...'
                    : needsPermission
                        ? 'Permission Required'
                        : 'Update Available',
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!isDownloading &&
                      !needsPermission &&
                      errorMessage == null)
                    Text(
                      'A new version (v${update.versionName}.${update.versionCode}) is available.\n\n${update.releaseNotes}',
                    ),
                  if (errorMessage != null && !needsPermission)
                    Text(
                      errorMessage!,
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  if (needsPermission) ...[
                    Text(errorMessage ??
                        'Allow TK Clocking System to install unknown apps, then tap "Try Again".'),
                    const SizedBox(height: 12),
                    const Text(
                      'The update has already been downloaded. Once you grant the permission, tap "Try Again" to complete the installation.',
                      style: TextStyle(fontSize: 12),
                    ),
                  ],
                  if (isDownloading) ...[
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                        value: progress,
                        minHeight: 8,
                        borderRadius: BorderRadius.circular(4)),
                    const SizedBox(height: 16),
                    Text(
                      '${(progress * 100).toStringAsFixed(1)}% completed',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ],
                ],
              ),
              actions: [
                if (!isDownloading)
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Later'),
                  ),
                // "Try Again" when APK is downloaded but needs permission
                if (!isDownloading &&
                    needsPermission &&
                    downloadedApkPath != null)
                  FilledButton(
                    onPressed: () => tryInstall(downloadedApkPath!),
                    child: const Text('Try Again'),
                  ),
                // "Download & Install" / "Retry" for normal states
                if (!isDownloading && !needsPermission)
                  FilledButton(
                    onPressed: () async {
                      setDialogState(() {
                        isDownloading = true;
                        errorMessage = null;
                        progress = 0.0;
                      });

                      try {
                        await _updateService.downloadAndOpenInstaller(
                          update,
                          onReceiveProgress: (received, total) {
                            if (total > 0) {
                              setDialogState(() {
                                progress = received / total;
                              });
                            }
                          },
                        );
                        if (ctx.mounted) Navigator.pop(ctx);
                      } on InstallPermissionRequiredException catch (e) {
                        setDialogState(() {
                          isDownloading = false;
                          needsPermission = true;
                          downloadedApkPath = e.apkPath;
                          errorMessage = e.message;
                        });
                      } catch (e) {
                        setDialogState(() {
                          isDownloading = false;
                          errorMessage = 'Failed to download: $e';
                        });
                      }
                    },
                    child: Text(errorMessage != null
                        ? 'Retry Download'
                        : 'Download & Install'),
                  ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _clearCache() async {
    final username = _storage.getOfflineIdentifier();
    if (username == null) {
      _showSnack('No active session found.');
      return;
    }

    final passwordController = TextEditingController();
    bool obscure = true;
    bool isVerifying = false;
    String? errorText;

    final passwordVerified = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setStateDlg) => AlertDialog(
          title: const Text('Confirm Identity'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Enter your password to proceed. This action cannot be undone.',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passwordController,
                obscureText: obscure,
                enabled: !isVerifying,
                decoration: InputDecoration(
                  labelText: 'Password',
                  errorText: errorText,
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
              onPressed:
                  isVerifying ? null : () => Navigator.pop(dialogCtx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
              onPressed: isVerifying
                  ? null
                  : () async {
                      final pwd = passwordController.text.trim();
                      if (pwd.isEmpty) return;

                      setStateDlg(() {
                        isVerifying = true;
                        errorText = null;
                      });

                      final storedHash = _storage.getOfflinePasswordHash();
                      final enteredHash = _hashPassword(pwd);

                      if (storedHash != null && enteredHash == storedHash) {
                        Navigator.pop(dialogCtx, true);
                      } else {
                        setStateDlg(() {
                          isVerifying = false;
                          errorText = 'Incorrect password. Please try again.';
                        });
                      }
                    },
              child: isVerifying
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Confirm'),
            ),
          ],
        ),
      ),
    );

    passwordController.dispose();

    if (passwordVerified != true || !mounted) return;

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

          // ── Preferences ────────────────────────────────────────────────
          _SectionHeader(title: 'Preferences'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: SwitchListTile(
                secondary: Icon(
                  Icons.vibration_rounded,
                  color: _hapticFeedbackEnabled ? cs.primary : null,
                ),
                title: const Text('Haptic Feedback'),
                subtitle: const Text(
                  'Vibrate on Clock In, Clock Out, and Break actions',
                ),
                value: _hapticFeedbackEnabled,
                onChanged: _toggleHapticFeedback,
                activeThumbColor: cs.onPrimary,
                activeTrackColor: cs.primary,
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

          // ── Help, Support & Compliance ─────────────────────────────────
          _SectionHeader(title: 'Help, Support & Compliance'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Card(
              child: Column(
                children: [
                  ListTile(
                    leading: Icon(
                      Icons.quiz_outlined,
                      color: cs.primary,
                    ),
                    title: const Text('Clocking FAQ & Guide'),
                    subtitle: const Text(
                      'Troubleshooting, geofence & offline clocking answers',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => FaqBottomSheet.show(context),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: Icon(
                      Icons.support_agent_rounded,
                      color: cs.primary,
                    ),
                    title: const Text('Contact School Administrators'),
                    subtitle: const Text(
                      'Call or WhatsApp Super Admin & HR Admin for support',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => ContactSupportSheet.show(
                      context,
                      user: _currentUser,
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: Icon(
                      Icons.privacy_tip_outlined,
                      color: cs.primary,
                    ),
                    title: const Text('Privacy Policy & Location Notice'),
                    subtitle: const Text(
                      'Location usage, on-device biometrics & data governance',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => PrivacyPolicySheet.show(context),
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
          // section hidden for now (will be used in the future when the app is able to send notifications correctly)
          // ignore: dead_code
          if (false) ...[
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
          ],

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
                    statusText = 'Inside Work Zone';
                    statusColor = Colors.green;
                    statusIcon = Icons.domain_verification_rounded;
                  } else if (inZone == false) {
                    statusText = 'Outside Work Zone';
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
                          title: const Text('Geofence Radius'),
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

  // ── Haptic feedback toggle ────────────────────────────────────────────────
  Future<void> _toggleHapticFeedback(bool value) async {
    await _storage.saveHapticFeedbackEnabled(value);
    if (value) {
      HapticFeedback.mediumImpact();
    }
    if (mounted) {
      setState(() => _hapticFeedbackEnabled = value);
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
