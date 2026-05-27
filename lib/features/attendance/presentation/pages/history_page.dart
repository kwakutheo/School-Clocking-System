import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/attendance_entity.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_state.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_state.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_event.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';
import 'package:tk_clocking_system/shared/enums/sync_status.dart';
import 'package:tk_clocking_system/shared/widgets/loading_indicator.dart';

/// Displays the employee's paginated attendance history.
class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  @override
  void initState() {
    super.initState();
    final authState = context.read<AuthBloc>().state;
    if (authState is AuthAuthenticated) {
      context.read<AttendanceBloc>().add(
            AttendanceLoadHistoryEvent(
                employeeId: authState.user.employeeId ?? authState.user.id),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance History'),
      ),
      body: VisibilityDetector(
        key: const Key('history-page'),
        onVisibilityChanged: (info) {
          if (info.visibleFraction > 0.5) {
            final authState = context.read<AuthBloc>().state;
            if (authState is AuthAuthenticated) {
              context.read<AttendanceBloc>().add(
                    AttendanceLoadHistoryEvent(
                        employeeId:
                            authState.user.employeeId ?? authState.user.id),
                  );
              context.read<AuthBloc>().add(const AuthSyncProfileEvent());
            }
          }
        },
        child: RefreshIndicator(
          onRefresh: () async {
            final authState = context.read<AuthBloc>().state;
            if (authState is AuthAuthenticated) {
              context.read<AttendanceBloc>().add(
                    AttendanceLoadHistoryEvent(
                        employeeId:
                            authState.user.employeeId ?? authState.user.id),
                  );
              context.read<AuthBloc>().add(const AuthSyncProfileEvent());
              await Future.delayed(const Duration(seconds: 1));
            }
          },
          child: BlocListener<AttendanceBloc, AttendanceState>(
            listener: (context, state) {
              if (state is AttendanceSynced) {
                // The global sync notification is already handled by the Dashboard tab.
                // Re-load history after sync to show fresh data
                final authState = context.read<AuthBloc>().state;
                if (authState is AuthAuthenticated) {
                  context.read<AttendanceBloc>().add(
                        AttendanceLoadHistoryEvent(
                          employeeId:
                              authState.user.employeeId ?? authState.user.id,
                        ),
                      );
                }
              }
            },
            child: BlocBuilder<AttendanceBloc, AttendanceState>(
              buildWhen: (previous, current) =>
                  current is AttendanceLoading ||
                  current is AttendanceHistoryLoaded ||
                  current is AttendanceFailure ||
                  // Re-render whenever state changes to anything relevant so we
                  // never get stuck on a blank/stale view after a record or sync.
                  (previous is AttendanceLoading &&
                      current is! AttendanceLoading),
              builder: (context, state) {
                if (state is AttendanceLoading) {
                  return SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: MediaQuery.of(context).size.height * 0.7,
                      child: const AppLoadingIndicator(
                          message: 'Loading history…'),
                    ),
                  );
                }

                if (state is AttendanceFailure) {
                  return SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: MediaQuery.of(context).size.height * 0.7,
                      child: _ErrorView(
                        message: state.message,
                        onRetry: () {
                          final authState = context.read<AuthBloc>().state;
                          if (authState is AuthAuthenticated) {
                            context.read<AttendanceBloc>().add(
                                  AttendanceLoadHistoryEvent(
                                      employeeId: authState.user.employeeId ??
                                          authState.user.id),
                                );
                          }
                        },
                      ),
                    ),
                  );
                }

                if (state is AttendanceHistoryLoaded) {
                  if (state.records.isEmpty) {
                    return SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: SizedBox(
                        height: MediaQuery.of(context).size.height * 0.7,
                        child: const _EmptyView(),
                      ),
                    );
                  }
                  return _HistoryList(records: state.records);
                }

                return SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: SizedBox(
                    height: MediaQuery.of(context).size.height * 0.7,
                    child: const _EmptyView(),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

// ── History list ──────────────────────────────────────────────────────────────
class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.records});

  final List<AttendanceEntity> records;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: records.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) => _HistoryTile(record: records[index]),
    );
  }
}

// ── History tile ──────────────────────────────────────────────────────────────
class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.record});

  final AttendanceEntity record;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final color = _colorFor(record.type);
    final isPending = record.syncStatus == SyncStatus.pending;

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            // Icon badge
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_iconFor(record.type), color: color, size: 22),
            ),
            const SizedBox(width: 14),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _labelFor(record.type),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('EEE, d MMM yyyy  •  HH:mm:ss')
                        .format(record.timestamp),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            // Sync badge
            if (isPending)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Pending',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: Colors.orange.shade700,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              )
            else
              Icon(Icons.cloud_done_rounded,
                  size: 18, color: Colors.green.shade500),
          ],
        ),
      ),
    );
  }

  Color _colorFor(AttendanceType type) => switch (type) {
        AttendanceType.clockIn => Colors.green,
        AttendanceType.clockOut => Colors.red,
        AttendanceType.breakIn => Colors.orange,
        AttendanceType.breakOut => Colors.blue,
      };

  IconData _iconFor(AttendanceType type) => switch (type) {
        AttendanceType.clockIn => Icons.login_rounded,
        AttendanceType.clockOut => Icons.logout_rounded,
        AttendanceType.breakIn => Icons.free_breakfast_rounded,
        AttendanceType.breakOut => Icons.replay_rounded,
      };

  String _labelFor(AttendanceType type) => switch (type) {
        AttendanceType.clockIn => 'Clock In',
        AttendanceType.clockOut => 'Clock Out',
        AttendanceType.breakIn => 'Break Start',
        AttendanceType.breakOut => 'Break End',
      };
}

// ── Empty state ───────────────────────────────────────────────────────────────
class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.history_rounded, size: 64, color: colorScheme.outline),
          const SizedBox(height: 16),
          Text(
            'No attendance records yet',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

// ── Error state ───────────────────────────────────────────────────────────────
class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_rounded,
                size: 56, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
