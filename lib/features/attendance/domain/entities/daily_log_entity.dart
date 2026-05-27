import 'package:equatable/equatable.dart';

class DailyLogEntity extends Equatable {
  final String date;
  final String status;
  final double hours;
  final bool isLate;
  final int lateMinutes;
  final bool isEarlyOut;
  final int earlyOutMinutes;
  final bool missingClockIn;
  final bool missingClockOut;
  final String? clockIn;
  final String? clockOut;

  const DailyLogEntity({
    required this.date,
    required this.status,
    required this.hours,
    required this.isLate,
    required this.lateMinutes,
    required this.isEarlyOut,
    required this.earlyOutMinutes,
    required this.missingClockIn,
    required this.missingClockOut,
    this.clockIn,
    this.clockOut,
  });

  @override
  List<Object?> get props => [
        date,
        status,
        hours,
        isLate,
        lateMinutes,
        isEarlyOut,
        earlyOutMinutes,
        missingClockIn,
        missingClockOut,
        clockIn,
        clockOut,
      ];
}
