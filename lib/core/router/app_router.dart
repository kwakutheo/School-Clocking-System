import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_state.dart';
import 'package:tk_clocking_system/features/auth/presentation/pages/login_page.dart';
import 'package:tk_clocking_system/features/dashboard/presentation/pages/home_page.dart';
import 'package:tk_clocking_system/features/attendance/presentation/pages/clock_in_page.dart';
import 'package:tk_clocking_system/features/attendance/presentation/pages/history_page.dart';
import 'package:tk_clocking_system/features/attendance/presentation/pages/my_report_page.dart';
import 'package:tk_clocking_system/features/leaves/presentation/pages/leaves_page.dart';
import 'package:tk_clocking_system/features/calendar/presentation/pages/calendar_page.dart';
import 'package:tk_clocking_system/features/profile/presentation/pages/work_history_page.dart';
import 'package:tk_clocking_system/shared/widgets/loading_indicator.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/router/go_router_refresh_stream.dart';

/// Declarative router with auth-based redirects.
///
/// The router listens to [AuthBloc] and redirects unauthenticated users
/// to /login and authenticated users away from /login to /home.
abstract final class AppRouter {
  static final _rootNavigatorKey = GlobalKey<NavigatorState>();

  static final GoRouter router = GoRouter(
        navigatorKey: _rootNavigatorKey,
        initialLocation: '/splash',
        redirect: _redirect,
        refreshListenable: GoRouterRefreshStream(sl<AuthBloc>().stream),
        routes: [
          GoRoute(
            path: '/splash',
            builder: (_, __) => const _SplashPage(),
          ),
          GoRoute(
            path: '/login',
            builder: (_, __) => const LoginPage(),
          ),
          GoRoute(
            path: '/home',
            builder: (_, __) => const HomePage(),
            routes: [
              GoRoute(
                path: 'clock-in',
                builder: (_, __) => const ClockInPage(),
              ),
              GoRoute(
                path: 'history',
                builder: (_, __) => const HistoryPage(),
              ),
              GoRoute(
                path: 'my-report',
                builder: (_, __) => const MyReportPage(),
              ),
              GoRoute(
                path: 'leaves',
                builder: (_, __) => const LeavesPage(),
              ),
              GoRoute(
                path: 'calendar',
                builder: (_, __) => const CalendarPage(),
              ),
              GoRoute(
                path: 'work-history',
                builder: (_, __) => const WorkHistoryPage(),
              ),
            ],
          ),
        ],
      );

  static String? _redirect(BuildContext context, GoRouterState state) {
    final authState = context.read<AuthBloc>().state;
    final isOnLogin = state.matchedLocation == '/login';
    final isOnSplash = state.matchedLocation == '/splash';

    if (authState is AuthInitial || authState is AuthLoading) {
      return isOnSplash ? null : '/splash';
    }

    if (authState is AuthUnauthenticated || authState is AuthFailure) {
      return isOnLogin ? null : '/login';
    }

    if (authState is AuthAuthenticated) {
      return (isOnLogin || isOnSplash) ? '/home' : null;
    }

    return null;
  }
}

/// Transient splash shown while the session check runs.
class _SplashPage extends StatelessWidget {
  const _SplashPage();

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          context.go('/home');
        } else if (state is AuthUnauthenticated || state is AuthFailure) {
          context.go('/login');
        }
      },
      child: const Scaffold(
        body: AppLoadingIndicator(message: 'Starting TK Clocking…'),
      ),
    );
  }
}
