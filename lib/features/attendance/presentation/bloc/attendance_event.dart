import 'package:equatable/equatable.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';

abstract class AttendanceEvent extends Equatable {
  const AttendanceEvent();

  @override
  List<Object?> get props => [];
}

class AttendanceRecordEvent extends AttendanceEvent {
  const AttendanceRecordEvent({
    required this.employeeId,
    required this.type,
    this.branchId,
    this.deviceId,
    this.forceEarlyOut = false,
  });

  final String employeeId;
  final AttendanceType type;
  final String? branchId;
  final String? deviceId;
  final bool forceEarlyOut;

  @override
  List<Object?> get props => [employeeId, type, forceEarlyOut];
}

class AttendanceLoadHistoryEvent extends AttendanceEvent {
  const AttendanceLoadHistoryEvent({
    required this.employeeId,
    this.page = 1,
  });

  final String employeeId;
  final int page;

  @override
  List<Object?> get props => [employeeId, page];
}

class AttendanceSyncEvent extends AttendanceEvent {
  const AttendanceSyncEvent();
}

class AttendanceQrRecordEvent extends AttendanceEvent {
  const AttendanceQrRecordEvent({
    required this.qrCode,
    required this.type,
    this.forceEarlyOut = false,
  });

  final String qrCode;
  final AttendanceType type;
  final bool forceEarlyOut;

  @override
  List<Object?> get props => [qrCode, type, forceEarlyOut];
}
