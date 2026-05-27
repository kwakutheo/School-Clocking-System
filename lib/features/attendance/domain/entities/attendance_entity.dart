import 'package:equatable/equatable.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';
import 'package:tk_clocking_system/shared/enums/sync_status.dart';

/// Domain entity for a single attendance event.
class AttendanceEntity extends Equatable {
  const AttendanceEntity({
    required this.id,
    required this.employeeId,
    required this.type,
    required this.timestamp,
    required this.syncStatus,
    this.branchId,
    this.latitude,
    this.longitude,
    this.selfieUrl,
    this.deviceId,
    this.uptimeAtClockIn,
    this.calculatedBootTime,
  });

  final String id;
  final String employeeId;
  final AttendanceType type;
  final DateTime timestamp;
  final SyncStatus syncStatus;
  final String? branchId;
  final double? latitude;
  final double? longitude;
  final String? selfieUrl;
  final String? deviceId;
  final int? uptimeAtClockIn;
  final int? calculatedBootTime;

  @override
  List<Object?> get props => [id, employeeId, type, timestamp];
}
