import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/features/profile/domain/entities/employee_status_log_entity.dart';
import 'package:tk_clocking_system/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:tk_clocking_system/features/profile/presentation/bloc/profile_event.dart';
import 'package:tk_clocking_system/features/profile/presentation/bloc/profile_state.dart';

/// Full work history page — always fetches only the current logged-in
/// employee's own history via the self-service `/employees/me/history`
/// endpoint. No employee ID is ever passed, so it is impossible for
/// an employee to view someone else's history.
class WorkHistoryPage extends StatelessWidget {
  const WorkHistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ProfileBloc>(
      // No employeeId passed → always hits /employees/me/history
      create: (_) => sl<ProfileBloc>()..add(const LoadWorkHistoryEvent()),
      child: const _WorkHistoryView(),
    );
  }
}

class _WorkHistoryView extends StatelessWidget {
  const _WorkHistoryView();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      backgroundColor: cs.surface,
      appBar: AppBar(
        title: const Text(
          'Work History',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        centerTitle: false,
        backgroundColor: const Color(0xFFF602E2),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: BlocBuilder<ProfileBloc, ProfileState>(
        builder: (context, state) {
          if (state is ProfileLoading || state is ProfileInitial) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ProfileError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline_rounded,
                        size: 48, color: cs.error),
                    const SizedBox(height: 16),
                    Text(
                      'Could not load work history.',
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      state.message,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: cs.onSurfaceVariant),
                    ),
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      onPressed: () => context
                          .read<ProfileBloc>()
                          .add(const LoadWorkHistoryEvent()),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Try Again'),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is ProfileHistoryLoaded) {
            final history = state.history;

            if (history.isEmpty) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.history_rounded,
                        size: 56, color: cs.outlineVariant),
                    const SizedBox(height: 16),
                    Text(
                      'No work history yet.',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: cs.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              );
            }

            // Group entries by year for a clean, organized layout
            final grouped = _groupByYear(history);
            final years = grouped.keys.toList()..sort((a, b) => b.compareTo(a));

            return FutureBuilder<DateTime>(
              future: sl<TimeService>().getGhanaTimeAsync(),
              initialData: sl<TimeService>().currentGhanaTime,
              builder: (context, snapshot) {
                final now = snapshot.data ?? sl<TimeService>().currentGhanaTime;
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  itemCount: years.length,
                  itemBuilder: (context, yearIndex) {
                final year = years[yearIndex];
                final entries = grouped[year]!;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Year Header ─────────────────────────────────────
                    Padding(
                      padding: EdgeInsets.only(
                          left: 4, bottom: 12, top: yearIndex == 0 ? 0 : 8),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(
                              color: cs.primaryContainer,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              year.toString(),
                              style: theme.textTheme.labelLarge?.copyWith(
                                color: cs.onPrimaryContainer,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Divider(
                                color: cs.outline.withValues(alpha: 0.2)),
                          ),
                        ],
                      ),
                    ),

                    // ── Timeline entries for this year ───────────────────
                    Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(
                            color: cs.outline.withValues(alpha: 0.15)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            vertical: 8, horizontal: 16),
                        child: Column(
                          children: List.generate(entries.length, (i) {
                            return _FullTimelineTile(
                              log: entries[i],
                              isLast: i == entries.length - 1,
                              now: now,
                            );
                          }),
                        ),
                      ),
                    ),
                  ],
                );
                  },
                );
              },
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  /// Groups history entries by the year of their startDate.
  Map<int, List<EmployeeStatusLogEntity>> _groupByYear(
      List<EmployeeStatusLogEntity> history) {
    final map = <int, List<EmployeeStatusLogEntity>>{};
    for (final entry in history) {
      final year = entry.startDate.year;
      map.putIfAbsent(year, () => []).add(entry);
    }
    return map;
  }
}

// ── Full Timeline Tile ────────────────────────────────────────────────────────
class _FullTimelineTile extends StatelessWidget {
  const _FullTimelineTile({required this.log, required this.isLast, required this.now});

  final EmployeeStatusLogEntity log;
  final bool isLast;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final formatter = DateFormat('MMM d, yyyy');

    Color statusColor;
    IconData statusIcon;

    switch (log.status.toUpperCase()) {
      case 'ACTIVE':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle_rounded;
        break;
      case 'ON_LEAVE':
        statusColor = Colors.orange;
        statusIcon = Icons.beach_access_rounded;
        break;
      case 'SUSPENDED':
        statusColor = Colors.red;
        statusIcon = Icons.pause_circle_rounded;
        break;
      case 'TERMINATED':
        statusColor = Colors.red.shade900;
        statusIcon = Icons.cancel_rounded;
        break;
      case 'INACTIVE':
        statusColor = Colors.grey;
        statusIcon = Icons.remove_circle_rounded;
        break;
      default:
        statusColor = cs.primary;
        statusIcon = Icons.circle_rounded;
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Dot and vertical line ──
          SizedBox(
            width: 32,
            child: Column(
              children: [
                const SizedBox(height: 16),
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: statusColor,
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.3),
                      width: 4,
                    ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: cs.outlineVariant.withValues(alpha: 0.4),
                    ),
                  )
                else
                  const SizedBox(height: 20),
              ],
            ),
          ),

          // ── Content ──
          Expanded(
            child: Padding(
              padding:
                  const EdgeInsets.only(left: 12, top: 10, bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status badge
                  Row(
                    children: [
                      Icon(statusIcon, size: 14, color: statusColor),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: statusColor.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          log.status.toUpperCase().replaceAll('_', ' '),
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: statusColor,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  // Date range
                  Text(
                    log.endDate != null
                        ? '${formatter.format(log.startDate)} — ${formatter.format(log.endDate!)}'
                        : '${formatter.format(log.startDate)} — Present',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: cs.onSurfaceVariant,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  // Duration
                  const SizedBox(height: 4),
                  Text(
                    _duration(log.startDate, log.endDate, now),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cs.onSurfaceVariant.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _duration(DateTime start, DateTime? end, DateTime now) {
    final to = end ?? now;
    final days = to.difference(start).inDays;
    if (days < 1) return 'Less than a day';
    if (days < 30) return '$days day${days == 1 ? '' : 's'}';
    final months = (days / 30).floor();
    if (months < 12) return '$months month${months == 1 ? '' : 's'}';
    final years = (months / 12).floor();
    final remainingMonths = months % 12;
    if (remainingMonths == 0) return '$years year${years == 1 ? '' : 's'}';
    return '$years year${years == 1 ? '' : 's'}, $remainingMonths month${remainingMonths == 1 ? '' : 's'}';
  }
}
