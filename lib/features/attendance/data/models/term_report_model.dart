import 'package:tk_clocking_system/features/attendance/domain/entities/term_report_entity.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/daily_log_entity.dart';

class ReportSummaryModel extends ReportSummary {
  const ReportSummaryModel({
    required super.totalHours,
    required super.daysWorked,
    required super.daysAbsent,
    required super.daysLate,
    required super.totalLateMinutes,
    required super.daysEarlyDeparture,
    required super.totalEarlyOutMinutes,
    required super.daysForgotClockOut,
  });

  factory ReportSummaryModel.fromJson(Map<String, dynamic> json) {
    return ReportSummaryModel(
      totalHours: (json['totalHours'] as num?)?.toDouble() ?? 0.0,
      daysWorked: json['daysWorked'] as int? ?? 0,
      daysAbsent: json['daysAbsent'] as int? ?? 0,
      daysLate: json['daysLate'] as int? ?? 0,
      totalLateMinutes: json['totalLateMinutes'] as int? ?? 0,
      daysEarlyDeparture: json['daysEarlyDeparture'] as int? ?? 0,
      totalEarlyOutMinutes: json['totalEarlyOutMinutes'] as int? ?? 0,
      daysForgotClockOut: json['daysForgotClockOut'] as int? ?? 0,
    );
  }
}

class DailyLogModel extends DailyLogEntity {
  const DailyLogModel({
    required super.date,
    required super.status,
    required super.hours,
    required super.isLate,
    required super.lateMinutes,
    required super.isEarlyOut,
    required super.earlyOutMinutes,
    required super.missingClockIn,
    required super.missingClockOut,
    super.clockIn,
    super.clockOut,
  });

  factory DailyLogModel.fromJson(Map<String, dynamic> json) {
    return DailyLogModel(
      date: json['date'] as String? ?? '',
      status: json['status'] as String? ?? 'UNKNOWN',
      hours: (json['hours'] as num?)?.toDouble() ?? 0.0,
      isLate: json['isLate'] as bool? ?? false,
      lateMinutes: json['lateMinutes'] as int? ?? 0,
      isEarlyOut: json['isEarlyOut'] as bool? ?? false,
      earlyOutMinutes: json['earlyOutMinutes'] as int? ?? 0,
      missingClockIn: json['missingClockIn'] as bool? ?? false,
      missingClockOut: json['missingClockOut'] as bool? ?? false,
      clockIn: json['clockIn'] as String?,
      clockOut: json['clockOut'] as String?,
    );
  }
}

class MonthSummaryModel extends MonthSummary {
  const MonthSummaryModel({
    required super.name,
    required super.summary,
    required super.days,
  });

  factory MonthSummaryModel.fromJson(Map<String, dynamic> json) {
    final daysList = json['days'] as List<dynamic>? ?? [];
    return MonthSummaryModel(
      name: json['name'] as String? ?? '',
      summary: ReportSummaryModel.fromJson(json['summary'] as Map<String, dynamic>? ?? {}),
      days: daysList.cast<Map<String, dynamic>>().map(DailyLogModel.fromJson).toList(),
    );
  }
}

class TermReportModel extends TermReportEntity {
  const TermReportModel({
    required super.termName,
    required super.summary,
    required super.months,
  });

  factory TermReportModel.fromJson(Map<String, dynamic> json) {
    final termName = (json['term'] as Map<String, dynamic>?)?['name'] as String? ?? 'Current Term';
    
    final summary = ReportSummaryModel.fromJson(json['summary'] as Map<String, dynamic>? ?? {});
    
    final monthsList = json['months'] as List<dynamic>? ?? [];
    final months = monthsList
        .cast<Map<String, dynamic>>()
        .map(MonthSummaryModel.fromJson)
        .toList();

    return TermReportModel(
      termName: termName,
      summary: summary,
      months: months,
    );
  }
}
