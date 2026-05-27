import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/features/profile/data/models/employee_status_log_model.dart';
import 'package:tk_clocking_system/features/profile/domain/entities/employee_status_log_entity.dart';
import 'package:tk_clocking_system/features/profile/domain/repositories/profile_repository.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  final ApiClient _apiClient;

  ProfileRepositoryImpl({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<Either<Failure, List<EmployeeStatusLogEntity>>> getWorkHistory({String? employeeId}) async {
    final cacheKey = employeeId != null ? 'work_history_cache_$employeeId' : 'work_history_cache_me';
    try {
      final endpoint = employeeId != null ? '/employees/$employeeId/history' : '/employees/me/history';
      final response = await _apiClient.get<List<dynamic>>(endpoint);

      final data = response.data;
      if (data == null) {
        return const Right([]);
      }

      // Save to local cache safely
      try {
        final box = Hive.box<Map>(AppConstants.userBox);
        await box.put(cacheKey, {'data': data});
      } catch (cacheError) {
        // Safe fallback - don't crash the user flow if cache fails
      }

      final history = data
          .map((json) => EmployeeStatusLogModel.fromJson(json as Map<String, dynamic>))
          .toList();

      return Right(history);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError ||
          e.response == null) {
        // Try reading from cache on network failure
        try {
          final box = Hive.box<Map>(AppConstants.userBox);
          final cached = box.get(cacheKey);
          if (cached != null && cached['data'] is List) {
            final cachedData = cached['data'] as List;
            final history = cachedData
                .map((json) => EmployeeStatusLogModel.fromJson(Map<String, dynamic>.from(json as Map)))
                .toList();
            return Right(history);
          }
        } catch (_) {
          // If reading cache fails, proceed to fallback NetworkFailure
        }
        return const Left(NetworkFailure());
      }
      return Left(ServerFailure(e.message ?? 'Failed to fetch work history.'));
    } catch (e) {
      // Catch all fallback (e.g. SocketException) - try cache first
      try {
        final box = Hive.box<Map>(AppConstants.userBox);
        final cached = box.get(cacheKey);
        if (cached != null && cached['data'] is List) {
          final cachedData = cached['data'] as List;
          final history = cachedData
              .map((json) => EmployeeStatusLogModel.fromJson(Map<String, dynamic>.from(json as Map)))
              .toList();
          return Right(history);
        }
      } catch (_) {}
      return Left(ServerFailure(e.toString()));
    }
  }
}
