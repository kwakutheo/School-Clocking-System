import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/attendance_entity.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/term_report_entity.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';

/// Contract for all attendance data operations.
abstract interface class AttendanceRepository {
  /// Submits an attendance event (clock in/out/break).
  ///
  /// When offline, saves locally and queues for sync.
  Future<Either<Failure, AttendanceEntity>> recordAttendance({
    required String employeeId,
    required AttendanceType type,
    required double latitude,
    required double longitude,
    String? branchId,
    String? deviceId,
    bool forceEarlyOut = false,
  });

  /// Returns paginated attendance history for [employeeId].
  Future<Either<Failure, List<AttendanceEntity>>> getHistory({
    required String employeeId,
    int page = 1,
  });

  /// Pushes all pending offline records to the backend.
  Future<Either<Failure, int>> syncPendingRecords();

  Future<Either<Failure, TermReportEntity>> getMyTermReport();

  Future<Either<Failure, HomeDataEntity>> getHomeData();

  /// Records attendance via QR code scan (no GPS required).
  Future<Either<Failure, AttendanceEntity>> recordViaQr({
    required String qrCode,
    required AttendanceType type,
    required double latitude,
    required double longitude,
    bool forceEarlyOut = false,
  });
}
