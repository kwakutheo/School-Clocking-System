import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/core/network/network_exception.dart';
import 'package:tk_clocking_system/features/calendar/data/models/calendar_models.dart';
import 'package:tk_clocking_system/features/calendar/domain/entities/calendar_entities.dart';
import 'package:tk_clocking_system/features/calendar/domain/repositories/calendar_repository.dart';

class CalendarRepositoryImpl implements CalendarRepository {
  final ApiClient apiClient;

  CalendarRepositoryImpl({required this.apiClient});

  @override
  Future<Either<String, List<AcademicTermEntity>>> getTerms() async {
    try {
      final response = await apiClient.get('/academic-calendar/terms/current-year');
      final List<dynamic> data = response.data;
      final terms = data
          .cast<Map<String, dynamic>>()
          .map((json) => AcademicTermModel.fromJson(json))
          .toList();
      return Right(terms);
    } on DioException catch (e) {
      final networkException = NetworkException.fromDioError(e);
      return Left(networkException.message);
    } catch (e) {
      return Left('An unexpected error occurred: ${e.toString()}');
    }
  }

  @override
  Future<Either<String, List<HolidayEntity>>> getHolidays() async {
    final box = Hive.box<Map>(AppConstants.userBox);
    try {
      final response = await apiClient.get('/holidays/current-year');
      final List<dynamic> data = response.data;
      final holidays = data
          .whereType<Map>()
          .map((json) => HolidayModel.fromJson(
                Map<String, dynamic>.from(json),
              ))
          .toList();

      // Cache holidays for offline state engine
      final jsonList = holidays.map((h) => h.toJson()).toList();
      await box.put(AppConstants.holidaysCacheKey, {'data': jsonList});

      return Right(holidays);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        final cached = box.get(AppConstants.holidaysCacheKey);
        if (cached != null && cached.containsKey('data')) {
          final data = cached['data'] as List<dynamic>;
          final holidays = data
              .whereType<Map>()
              .map((json) => HolidayModel.fromJson(
                    Map<String, dynamic>.from(json),
                  ))
              .toList();
          return Right(holidays);
        }
      }
      final networkException = NetworkException.fromDioError(e);
      return Left(networkException.message);
    } catch (e) {
      return Left('An unexpected error occurred: ${e.toString()}');
    }
  }
}
