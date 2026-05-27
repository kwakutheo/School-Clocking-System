import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/core/router/app_router.dart';
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
          child: child!,
        ),
      ),
    );
  }
}
