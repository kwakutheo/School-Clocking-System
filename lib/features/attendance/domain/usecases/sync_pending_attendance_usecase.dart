import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/attendance/domain/repositories/attendance_repository.dart';

/// Flushes all locally stored pending attendance records to the backend.
///
/// Returns a record with the number of records [synced] and [expired].
class SyncPendingAttendanceUseCase {
  const SyncPendingAttendanceUseCase(this._repository);

  final AttendanceRepository _repository;

  Future<Either<Failure, ({int synced, int expired})>> call() =>
      _repository.syncPendingRecords();
}
