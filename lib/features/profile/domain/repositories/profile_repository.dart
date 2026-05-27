import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/profile/domain/entities/employee_status_log_entity.dart';

abstract class ProfileRepository {
  Future<Either<Failure, List<EmployeeStatusLogEntity>>> getWorkHistory({String? employeeId});
}
