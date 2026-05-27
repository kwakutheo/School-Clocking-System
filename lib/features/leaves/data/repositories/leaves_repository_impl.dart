import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/features/leaves/data/models/leave_request_model.dart';
import 'package:tk_clocking_system/features/leaves/domain/repositories/leaves_repository.dart';

class LeavesRepositoryImpl implements LeavesRepository {
  final ApiClient apiClient;

  LeavesRepositoryImpl({required this.apiClient});

  @override
  Future<Either<String, List<LeaveRequestModel>>> getMyLeaves() async {
    try {
      final response = await apiClient.get('/leaves/my');
      final data = response.data as List;
      final leaves = data.map((e) => LeaveRequestModel.fromJson(e)).toList();
      return Right(leaves);
    } on DioException catch (e) {
      return Left(e.response?.data?['message'] ?? 'Failed to load leaves');
    } catch (e) {
      return Left('An unexpected error occurred');
    }
  }

  @override
  Future<Either<String, LeaveRequestModel>> requestLeave({
    required String leaveType,
    required DateTime startDate,
    required DateTime endDate,
    String? reason,
  }) async {
    try {
      final response = await apiClient.post(
        '/leaves/request',
        data: {
          'leaveType': leaveType,
          'startDate': startDate.toIso8601String(),
          'endDate': endDate.toIso8601String(),
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
      return Right(LeaveRequestModel.fromJson(response.data));
    } on DioException catch (e) {
      return Left(e.response?.data?['message'] ?? 'Failed to submit leave request');
    } catch (e) {
      return Left('An unexpected error occurred');
    }
  }

  @override
  Future<Either<String, void>> cancelLeave(String leaveId) async {
    try {
      await apiClient.patch('/leaves/$leaveId/cancel');
      return const Right(null);
    } on DioException catch (e) {
      return Left(e.response?.data?['message'] ?? 'Failed to cancel leave');
    } catch (e) {
      return Left('An unexpected error occurred');
    }
  }
}
