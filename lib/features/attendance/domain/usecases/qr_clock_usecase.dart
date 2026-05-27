import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/attendance_entity.dart';
import 'package:tk_clocking_system/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';

/// Records attendance via QR code scan (bypasses GPS geofence).
class QrClockUseCase {
  const QrClockUseCase(this._repository);

  final AttendanceRepository _repository;

  Future<Either<Failure, AttendanceEntity>> call({
    required String qrCode,
    required AttendanceType type,
    required double latitude,
    required double longitude,
    bool forceEarlyOut = false,
  }) =>
      _repository.recordViaQr(
        qrCode: qrCode,
        type: type,
        latitude: latitude,
        longitude: longitude,
        forceEarlyOut: forceEarlyOut,
      );
}
