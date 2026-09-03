import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/features/leaves/data/models/leave_request_model.dart';
import 'package:tk_clocking_system/features/leaves/domain/repositories/leaves_repository.dart';

class LeavesRepositoryImpl implements LeavesRepository {
  final ApiClient apiClient;

  LeavesRepositoryImpl({required this.apiClient});

  @override
  Future<Either<String, List<LeaveRequestModel>>> getMyLeaves() async {
    final box = Hive.box<Map>(AppConstants.userBox);
    try {
      final response = await apiClient.get('/leaves/my');
      final data = response.data as List;
      final leaves = data.map((e) => LeaveRequestModel.fromJson(e)).toList();

      await box.put(
        AppConstants.leavesCacheKey,
        {'data': leaves.map((l) => l.toJson()).toList()},
      );

      return Right(leaves);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.unknown) {
        final cached = box.get(AppConstants.leavesCacheKey);
        if (cached != null && cached.containsKey('data')) {
          final list = cached['data'] as List<dynamic>;
          final leaves = list
              .whereType<Map>()
              .map((e) => LeaveRequestModel.fromJson(Map<String, dynamic>.from(e)))
              .toList();
          return Right(leaves);
        }
      }
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
