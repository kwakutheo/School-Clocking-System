import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/core/router/app_router.dart';
import 'package:tk_clocking_system/core/services/app_update_service.dart';
import 'package:tk_clocking_system/core/services/connectivity_service.dart';
import 'package:tk_clocking_system/core/theme/app_theme.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_event.dart';

import 'package:tk_clocking_system/shared/widgets/connectivity_banner.dart';

class App extends StatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  late final AuthBloc _authBloc;
  late final AttendanceBloc _attendanceBloc;
  late final ConnectivityService _connectivity;
  late final StreamSubscription<bool> _connectivitySub;
  late final StreamSubscription<void> _unauthorizedSub;

  @override
  void initState() {
    super.initState();

    _authBloc = sl<AuthBloc>()..add(const AuthCheckSessionEvent());
    _attendanceBloc = sl<AttendanceBloc>();
    _connectivity = sl<ConnectivityService>();

    // When network is restored, drain any pending offline records.
    _connectivitySub = _connectivity.onConnectivityChanged.listen((isOnline) {
      if (isOnline) {
        _attendanceBloc.add(const AttendanceSyncEvent());
      }
    });

    // Listen for 401 Unauthorized errors from ApiClient and force logout
    _unauthorizedSub = sl<ApiClient>().onUnauthorized.listen((_) {
      _authBloc.add(const AuthLogoutEvent());
    });
  }

  @override
  void dispose() {
    _unauthorizedSub.cancel();
    _connectivitySub.cancel();
    _authBloc.close();
    _attendanceBloc.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>.value(value: _authBloc),
        BlocProvider<AttendanceBloc>.value(value: _attendanceBloc),
      ],
      child: MaterialApp.router(
        title: 'TK Clocking System',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,
        routerConfig: AppRouter.router,
        builder: (context, child) => ConnectivityBanner(
          connectivityService: _connectivity,
          child: _AppUpdateGate(child: child!),
        ),
      ),
    );
  }
}

class _AppUpdateGate extends StatefulWidget {
  const _AppUpdateGate({required this.child});

  final Widget child;

  @override
  State<_AppUpdateGate> createState() => _AppUpdateGateState();
}

class _AppUpdateGateState extends State<_AppUpdateGate>
    with WidgetsBindingObserver {
  bool _isCheckingForUpdate = false;
  DateTime? _lastUpdateCheckAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkForAppUpdate();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkForAppUpdate();
    }
  }

  Future<void> _checkForAppUpdate() async {
    if (_isCheckingForUpdate) return;

    final lastCheck = _lastUpdateCheckAt;
    if (lastCheck != null &&
        DateTime.now().difference(lastCheck) < const Duration(minutes: 10)) {
      return;
    }

    _isCheckingForUpdate = true;
    _lastUpdateCheckAt = DateTime.now();
    final update = await sl<AppUpdateService>().checkForUpdate();
    _isCheckingForUpdate = false;
    if (!mounted || update == null) return;

    _showAppUpdateDialog(update);
  }

  void _showAppUpdateDialog(AppUpdateInfo update) {
    final navigatorContext = AppRouter.rootNavigatorKey.currentContext;
    if (navigatorContext == null) return;

    final theme = Theme.of(navigatorContext);

    showDialog<void>(
      context: navigatorContext,
      barrierDismissible: !update.required,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(
          Icons.system_update_alt_rounded,
          color: theme.colorScheme.primary,
        ),
        title: Text('Update available: v${update.versionName}'),
        content: Text(
          update.releaseNotes.isEmpty
              ? 'A newer version of TK Clocking System is ready to install.'
              : update.releaseNotes,
        ),
        actions: [
          if (!update.required)
            TextButton(
              onPressed: () async {
                await sl<AppUpdateService>().snooze(update);
                if (dialogContext.mounted) {
                  Navigator.of(dialogContext).pop();
                }
              },
              child: const Text('Remind Me Later'),
            ),
          FilledButton.icon(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              final progressContext =
                  AppRouter.rootNavigatorKey.currentContext;
              if (progressContext == null) return;
              showDialog<void>(
                context: progressContext,
                barrierDismissible: false,
                builder: (_) => _AppUpdateProgressDialog(update: update),
              );
            },
            icon: const Icon(Icons.download_rounded),
            label: const Text('Update Now'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _AppUpdateProgressDialog extends StatefulWidget {
  const _AppUpdateProgressDialog({required this.update});

  final AppUpdateInfo update;

  @override
  State<_AppUpdateProgressDialog> createState() =>
      _AppUpdateProgressDialogState();
}

class _AppUpdateProgressDialogState extends State<_AppUpdateProgressDialog> {
  double? _progress;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _startDownload();
  }

  Future<void> _startDownload() async {
    try {
      await sl<AppUpdateService>().downloadAndOpenInstaller(
        widget.update,
        onReceiveProgress: (received, total) {
          if (!mounted || total <= 0) return;
          setState(() => _progress = received / total);
        },
      );

      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Installer opened. Tap Install to finish updating.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on InstallPermissionRequiredException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _errorMessage =
            'Update download failed. Please try again from the dashboard link.',
      );
      debugPrint('[AppUpdate] Download/install failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = _progress;

    return AlertDialog(
      title: Text(
        _errorMessage == null ? 'Downloading update' : 'Update needs attention',
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _errorMessage ??
                'Preparing TK Clocking System v${widget.update.versionName}...',
          ),
          const SizedBox(height: 16),
          if (_errorMessage == null) ...[
            LinearProgressIndicator(value: progress),
            if (progress != null) ...[
              const SizedBox(height: 8),
              Text(
                '${(progress * 100).clamp(0, 100).toStringAsFixed(0)}%',
                style: theme.textTheme.labelMedium,
              ),
            ],
          ],
        ],
      ),
      actions: [
        if (_errorMessage != null)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
      ],
    );
  }
}
