import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/attendance_entity.dart';
import 'package:tk_clocking_system/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';

/// Records a single attendance event (clock-in, clock-out, break).
class RecordAttendanceUseCase {
  const RecordAttendanceUseCase(this._repository);

  final AttendanceRepository _repository;

  Future<Either<Failure, AttendanceEntity>> call({
    required String employeeId,
    required AttendanceType type,
    required double latitude,
    required double longitude,
    String? branchId,
    String? deviceId,
    bool forceEarlyOut = false,
  }) =>
      _repository.recordAttendance(
        employeeId: employeeId,
        type: type,
        latitude: latitude,
        longitude: longitude,
        branchId: branchId,
        deviceId: deviceId,
        forceEarlyOut: forceEarlyOut,
      );
}
