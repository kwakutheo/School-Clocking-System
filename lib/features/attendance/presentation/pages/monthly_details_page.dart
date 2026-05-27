import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/daily_log_entity.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/term_report_entity.dart';

class MonthlyDetailsPage extends StatelessWidget {
  final MonthSummary monthSummary;

  const MonthlyDetailsPage({super.key, required this.monthSummary});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${monthSummary.name} Details'),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: monthSummary.days.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          return _DailyLogCard(log: monthSummary.days[index]);
        },
      ),
    );
  }
}

class _DailyLogCard extends StatelessWidget {
  final DailyLogEntity log;

  const _DailyLogCard({required this.log});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isWeekend = log.status == 'WEEKEND';
    final isAbsent = log.status == 'ABSENT';
    final isHoliday = log.status.startsWith('HOLIDAY');
    final isLeave = log.status.startsWith('LEAVE');
    final isPresent = log.status == 'PRESENT' || log.status == 'IN PROGRESS';

    Color bgColor = theme.colorScheme.surface;
    Color borderColor = theme.colorScheme.outlineVariant.withValues(alpha: 0.5);
    Color statusColor = Colors.grey;

    if (isWeekend || isHoliday) {
      bgColor = Colors.grey.withValues(alpha: 0.05);
    } else if (isAbsent) {
      bgColor = Colors.red.withValues(alpha: 0.05);
      borderColor = Colors.red.withValues(alpha: 0.3);
      statusColor = Colors.red;
    } else if (isLeave) {
      bgColor = Colors.purple.withValues(alpha: 0.05);
      borderColor = Colors.purple.withValues(alpha: 0.3);
      statusColor = Colors.purple;
    } else if (isPresent) {
      if (log.isLate || log.isEarlyOut || log.missingClockOut || log.missingClockIn) {
        bgColor = Colors.orange.withValues(alpha: 0.05);
        borderColor = Colors.orange.withValues(alpha: 0.3);
        statusColor = Colors.orange;
      } else {
        bgColor = Colors.green.withValues(alpha: 0.05);
        borderColor = Colors.green.withValues(alpha: 0.3);
        statusColor = Colors.green;
      }
    }

    final date = DateTime.tryParse(log.date);
    final dayStr = date != null ? DateFormat('EEE, d MMM').format(date) : log.date;

    return Card(
      elevation: 0,
      color: bgColor,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: borderColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  dayStr,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: statusColor.withValues(alpha: 0.5)),
                  ),
                  child: Text(
                    log.status,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: statusColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            if (isPresent) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  _TimeIndicator(
                    label: 'In',
                    timeStr: _formatTime(log.clockIn),
                    isWarning: log.missingClockIn || log.isLate,
                    warningIcon: log.isLate ? Icons.timer_off : null,
                  ),
                  const SizedBox(width: 16),
                  _TimeIndicator(
                    label: 'Out',
                    timeStr: _formatTime(log.clockOut),
                    isWarning: log.missingClockOut || log.isEarlyOut,
                    warningIcon: log.isEarlyOut ? Icons.directions_run : null,
                  ),
                  const Spacer(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Hours', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      Text(
                        '${log.hours}h',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ],
                  )
                ],
              ),
              if (log.isLate) ...[
                const SizedBox(height: 8),
                Text(
                  'Late by ${log.lateMinutes} mins',
                  style: const TextStyle(color: Colors.orange, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ],
              if (log.isEarlyOut) ...[
                const SizedBox(height: 4),
                Text(
                  'Early departure by ${log.earlyOutMinutes} mins',
                  style: const TextStyle(color: Colors.orange, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ],
              if (log.missingClockOut) ...[
                const SizedBox(height: 4),
                const Text(
                  'Missing clock out',
                  style: TextStyle(color: Colors.orange, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ]
            ],
          ],
        ),
      ),
    );
  }

  String _formatTime(String? isoString) {
    if (isoString == null) return '--:--';
    final dt = DateTime.tryParse(isoString);
    if (dt == null) return '--:--';
    return DateFormat('h:mm a').format(dt.toUtc());
  }
}

class _TimeIndicator extends StatelessWidget {
  final String label;
  final String timeStr;
  final bool isWarning;
  final IconData? warningIcon;

  const _TimeIndicator({
    required this.label,
    required this.timeStr,
    required this.isWarning,
    this.warningIcon,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        Row(
          children: [
            Text(
              timeStr,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isWarning ? Colors.orange : null,
              ),
            ),
            if (isWarning && warningIcon != null) ...[
              const SizedBox(width: 4),
              Icon(warningIcon, size: 14, color: Colors.orange),
            ]
          ],
        )
      ],
    );
  }
}
