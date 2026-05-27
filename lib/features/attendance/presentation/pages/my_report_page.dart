import 'package:flutter/material.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/term_report_entity.dart';
import 'package:tk_clocking_system/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:tk_clocking_system/features/attendance/presentation/pages/monthly_details_page.dart';
import 'package:tk_clocking_system/shared/widgets/loading_indicator.dart';

class MyReportPage extends StatefulWidget {
  const MyReportPage({super.key});

  @override
  State<MyReportPage> createState() => _MyReportPageState();
}

class _MyReportPageState extends State<MyReportPage> {
  late Future<TermReportEntity> _reportFuture;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  void _loadReport() {
    _reportFuture = sl<AttendanceRepository>().getMyTermReport().then((result) {
      return result.fold(
        (failure) => throw Exception(failure.message),
        (report) => report,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Report'),
      ),
      body: VisibilityDetector(
        key: const Key('my-report-page'),
        onVisibilityChanged: (info) {
          if (info.visibleFraction > 0.5) {
            setState(() {
              _loadReport();
            });
          }
        },
        child: RefreshIndicator(
          onRefresh: () async {
            setState(() {
              _loadReport();
            });
            try {
              await _reportFuture;
            } catch (_) {}
          },
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: FutureBuilder<TermReportEntity>(
                  future: _reportFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const AppLoadingIndicator(
                          message: 'Loading report...');
                    }

                    if (snapshot.hasError) {
                      return _ErrorView(
                        message: snapshot.error.toString(),
                      );
                    }

                    if (!snapshot.hasData) {
                      return const Center(child: Text('No data found.'));
                    }

                    final report = snapshot.data!;

                    return Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Term Summary: ${report.termName}',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 16),
                          _SummaryGrid(summary: report.summary),
                          const SizedBox(height: 32),
                          Text(
                            'Monthly Breakdown',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 16),
                          ...report.months.map((m) => _MonthCard(month: m)),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SummaryGrid extends StatelessWidget {
  final ReportSummary summary;

  const _SummaryGrid({required this.summary});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 2,
      children: [
        _StatCard(
          label: 'Days Worked',
          value: '${summary.daysWorked}',
          icon: Icons.work_history_rounded,
          color: Colors.green,
        ),
        _StatCard(
          label: 'Absences',
          value: '${summary.daysAbsent}',
          icon: Icons.event_busy_rounded,
          color: Colors.red,
        ),
        _StatCard(
          label: 'Lateness',
          value: '${summary.daysLate}d',
          subtitle: _formatMins(summary.totalLateMinutes),
          icon: Icons.warning_rounded,
          color: Colors.orange,
        ),
        _StatCard(
          label: 'Early Outs',
          value: '${summary.daysEarlyDeparture}d',
          subtitle: _formatMins(summary.totalEarlyOutMinutes),
          icon: Icons.directions_run_rounded,
          color: Colors.purple,
        ),
        _StatCard(
          label: 'Total Hours',
          value: '${summary.totalHours.toStringAsFixed(1)}h',
          icon: Icons.timer_rounded,
          color: Colors.blue,
        ),
        _StatCard(
          label: 'Forgot Out',
          value: '${summary.daysForgotClockOut}d',
          icon: Icons.running_with_errors_rounded,
          color: Colors.brown,
        ),
      ],
    );
  }

  String _formatMins(int mins) {
    if (mins < 60) return '${mins}m';
    final h = mins ~/ 60;
    final m = mins % 60;
    return m > 0 ? '${h}h ${m}m' : '${h}h';
  }
}

class _MonthCard extends StatelessWidget {
  final MonthSummary month;

  const _MonthCard({required this.month});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final summary = month.summary;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => MonthlyDetailsPage(monthSummary: month),
              ),
            );
          },
          child: Card(
            margin: EdgeInsets.zero,
            elevation: 0,
            shape: RoundedRectangleBorder(
              side: BorderSide(
                  color: colorScheme.outlineVariant.withValues(alpha: 0.4)),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: colorScheme.primaryContainer.withValues(alpha: 0.5),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
              border: Border(
                bottom: BorderSide(
                  color: colorScheme.outlineVariant.withValues(alpha: 0.4),
                ),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.calendar_month_rounded,
                    size: 20, color: colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  month.name,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Left Column: Positive Stats
                Expanded(
                  child: Column(
                    children: [
                      _MonthStatRow(
                        icon: Icons.work_history_rounded,
                        color: Colors.green,
                        label: 'Days Worked',
                        value: '${summary.daysWorked}d',
                      ),
                      const SizedBox(height: 16),
                      _MonthStatRow(
                        icon: Icons.warning_rounded,
                        color: summary.daysLate > 0
                            ? Colors.orange
                            : Colors.grey.shade500,
                        label: 'Lateness',
                        value: '${summary.daysLate}d',
                      ),
                      const SizedBox(height: 16),
                      _MonthStatRow(
                        icon: Icons.timer_rounded,
                        color: Colors.blue,
                        label: 'Total Hours',
                        value: '${summary.totalHours.toStringAsFixed(1)}h',
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 1,
                  height: 60,
                  color: colorScheme.outlineVariant.withValues(alpha: 0.5),
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                ),
                // Right Column: Negative Stats
                Expanded(
                  child: Column(
                    children: [
                      _MonthStatRow(
                        icon: Icons.event_busy_rounded,
                        color: summary.daysAbsent > 0
                            ? Colors.red
                            : Colors.grey.shade500,
                        label: 'Absences',
                        value: '${summary.daysAbsent}d',
                      ),
                      const SizedBox(height: 16),
                      _MonthStatRow(
                        icon: Icons.directions_run_rounded,
                        color: summary.daysEarlyDeparture > 0
                            ? Colors.purple
                            : Colors.grey.shade500,
                        label: 'Early Out',
                        value: '${summary.daysEarlyDeparture}d',
                      ),
                      const SizedBox(height: 16),
                      _MonthStatRow(
                        icon: Icons.running_with_errors_rounded,
                        color: summary.daysForgotClockOut > 0
                            ? Colors.brown
                            : Colors.grey.shade500,
                        label: 'Forgot Out',
                        value: '${summary.daysForgotClockOut}d',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    ),
    ),
    );
  }
}

class _MonthStatRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String value;

  const _MonthStatRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.onSurface,
              ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String? subtitle;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    this.subtitle,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: color.withValues(alpha: 0.1),
      shape: RoundedRectangleBorder(
        side: BorderSide(color: color.withValues(alpha: 0.2)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 18),
            const Spacer(),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(width: 4),
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: color,
                        ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded,
                size: 56, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
