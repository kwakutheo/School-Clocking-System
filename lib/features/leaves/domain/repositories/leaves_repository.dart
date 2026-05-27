import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/features/leaves/data/models/leave_request_model.dart';

abstract class LeavesRepository {
  /// Fetch all leave requests for the currently authenticated employee.
  Future<Either<String, List<LeaveRequestModel>>> getMyLeaves();

  /// Submit a new leave request.
  Future<Either<String, LeaveRequestModel>> requestLeave({
    required String leaveType,
    required DateTime startDate,
    required DateTime endDate,
    String? reason,
  });

  /// Cancel a pending leave request.
  Future<Either<String, void>> cancelLeave(String leaveId);
}
