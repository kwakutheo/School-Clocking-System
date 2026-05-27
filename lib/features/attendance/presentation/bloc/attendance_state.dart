import 'package:equatable/equatable.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/attendance_entity.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';

abstract class AttendanceState extends Equatable {
  const AttendanceState();

  @override
  List<Object?> get props => [];
}

class AttendanceInitial extends AttendanceState {
  const AttendanceInitial();
}

class AttendanceLoading extends AttendanceState {
  const AttendanceLoading();
}

/// Emitted after a successful clock-in/out/break event.
class AttendanceRecorded extends AttendanceState {
  const AttendanceRecorded(this.record);

  final AttendanceEntity record;

  @override
  List<Object?> get props => [record];
}

/// Emitted when the history list is ready.
class AttendanceHistoryLoaded extends AttendanceState {
  const AttendanceHistoryLoaded(this.records);

  final List<AttendanceEntity> records;

  @override
  List<Object?> get props => [records];
}

/// Emitted after a sync run completes.
class AttendanceSynced extends AttendanceState {
  const AttendanceSynced(this.count);

  final int count;

  @override
  List<Object?> get props => [count];
}

class AttendanceFailure extends AttendanceState {
  const AttendanceFailure(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

class AttendanceSyncFailure extends AttendanceState {
  const AttendanceSyncFailure(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

/// Emitted when the user tries to clock out before their shift ends.
/// The UI should show a confirmation dialog; on confirm it re-dispatches
/// with [AttendanceRecordEvent.forceEarlyOut] = true.
class AttendanceEarlyClockOutWarning extends AttendanceState {
  const AttendanceEarlyClockOutWarning({
    required this.message,
    required this.remainingMinutes,
    required this.pendingEmployeeId,
    required this.pendingType,
    this.pendingBranchId,
    this.pendingDeviceId,
    this.pendingLat,
    this.pendingLng,
    this.pendingQrCode,
  });

  final String message;
  final int remainingMinutes;
  final String pendingEmployeeId;
  final AttendanceType pendingType;
  final String? pendingBranchId;
  final String? pendingDeviceId;
  final double? pendingLat;
  final double? pendingLng;
  final String? pendingQrCode;

  @override
  List<Object?> get props => [message, remainingMinutes, pendingEmployeeId, pendingQrCode];
}
