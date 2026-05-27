import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/attendance_entity.dart';
import 'package:tk_clocking_system/features/attendance/domain/repositories/attendance_repository.dart';

/// Fetches paginated attendance history for the current employee.
class GetAttendanceHistoryUseCase {
  const GetAttendanceHistoryUseCase(this._repository);

  final AttendanceRepository _repository;

  Future<Either<Failure, List<AttendanceEntity>>> call({
    required String employeeId,
    int page = 1,
  }) =>
      _repository.getHistory(employeeId: employeeId, page: page);
}
