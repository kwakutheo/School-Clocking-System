import 'dart:convert';
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/errors/exceptions.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/core/network/api_endpoints.dart';
import 'package:tk_clocking_system/core/services/connectivity_service.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/core/services/uptime_service.dart';
import 'package:tk_clocking_system/features/attendance/data/models/attendance_model.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/attendance_entity.dart';
import 'package:tk_clocking_system/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';
import 'package:tk_clocking_system/shared/enums/sync_status.dart';
import 'package:tk_clocking_system/features/attendance/data/models/academic_term_model.dart';
import 'package:tk_clocking_system/features/attendance/data/models/term_report_model.dart';
import 'package:tk_clocking_system/features/attendance/domain/entities/term_report_entity.dart';
import 'package:tk_clocking_system/features/dashboard/data/models/home_data_model.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';

/// Concrete implementation of [AttendanceRepository].
///
/// Strategy:
/// - Online  → POST to backend, mark as synced.
/// - Offline → Save to Hive with [SyncStatus.pending]; sync later.
class AttendanceRepositoryImpl implements AttendanceRepository {
  const AttendanceRepositoryImpl({
    required ApiClient apiClient,
    required ConnectivityService connectivity,
    required TimeService timeService,
    required UptimeService uptimeService,
  })  : _api = apiClient,
        _connectivity = connectivity,
        _time = timeService,
        _uptime = uptimeService;

  final ApiClient _api;
  final ConnectivityService _connectivity;
  final TimeService _time;
  final UptimeService _uptime;

  Box<Map> get _box => Hive.box<Map>(AppConstants.attendanceBox);

  // ── Record attendance ─────────────────────────────────────────────────────
  @override
  Future<Either<Failure, AttendanceEntity>> recordAttendance({
    required String employeeId,
    required AttendanceType type,
    required double latitude,
    required double longitude,
    String? branchId,
    String? deviceId,
    bool forceEarlyOut = false,
  }) async {
    late DateTime safeTimestamp;
    try {
      safeTimestamp = await _time.getSafeDateTime();
    } on TimeTamperingException catch (e) {
      return Left(TimeTamperingFailure(e.message));
    }

    final currentUptime = await _uptime.getUptimeMs();
    final calculatedBootTime = currentUptime > 0 
        ? DateTime.now().millisecondsSinceEpoch - currentUptime 
        : null;

    final pending = AttendanceModel.pending(
      employeeId: employeeId,
      type: type,
      latitude: latitude,
      longitude: longitude,
      timestamp: safeTimestamp,
      branchId: branchId,
      deviceId: deviceId,
      uptimeAtClockIn: currentUptime > 0 ? currentUptime : null,
      calculatedBootTime: calculatedBootTime,
    );

    final isOnline = _connectivity.isOnline;

    if (!isOnline) {
      await _box.put(pending.id, pending.toJson());
      return Right(pending);
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        ApiEndpoints.clockIn,
        data: {
          ...pending.toApiJson(),
          if (forceEarlyOut) 'forceEarlyOut': true,
        },
      );
      final synced = AttendanceModel.fromJson(
        response.data as Map<String, dynamic>,
      );
      return Right(synced);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        // No reachability to backend — save offline for later sync.
        await _box.put(pending.id, pending.toJson());
        return Right(pending);
      }
      // Extract the actual server error message (e.g. geofence / duplicate).
      final rawMsg = e.response?.data?['message'];
      final serverMsg = rawMsg is String
          ? rawMsg
          : rawMsg is List
              ? rawMsg.join(', ')
              : e.message ?? 'Server error.';

      // Check for structured early-clock-out warning.
      try {
        final decoded = Map<String, dynamic>.from(
          // backend stringifies the JSON as the error message
          _tryDecodeJson(serverMsg) ?? {},
        );
        if (decoded['code'] == 'EARLY_CLOCK_OUT') {
          return Left(EarlyClockOutFailure(
            decoded['message'] as String,
            decoded['remainingMinutes'] as int? ?? 0,
          ));
        }
      } catch (_) {}

      return Left(ServerFailure(serverMsg));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  // ── History ───────────────────────────────────────────────────────────────
  @override
  Future<Either<Failure, List<AttendanceEntity>>> getHistory({
    required String employeeId,
    int page = 1,
  }) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.attendanceHistory,
        queryParameters: {
          'employee_id': employeeId,
          'page': page,
          'limit': AppConstants.defaultPageSize,
        },
      );
      final dataList = response.data?['data'] as List? ?? [];
      final records = dataList
          .cast<Map<String, dynamic>>()
          .map(AttendanceModel.fromJson)
          .toList();
      return Right(records);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return const Left(NetworkFailure());
      }
      return Left(ServerFailure(e.message ?? 'Server error.'));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  @override
  Future<Either<Failure, TermReportEntity>> getMyTermReport() async {
    try {
      // 1. Fetch terms to find the active one.
      // Use <dynamic> — Dio does not correctly handle List<dynamic> as a
      // generic type parameter; the raw response.data will already be a
      // List<dynamic> when the server returns a JSON array.
      final termsResponse = await _api.get<dynamic>(ApiEndpoints.terms);
      final rawTerms = termsResponse.data;
      final termsList = rawTerms is List ? rawTerms : <dynamic>[];
      final terms = termsList
          .cast<Map<String, dynamic>>()
          .map(AcademicTermModel.fromJson)
          .toList();

      // Pick the term that contains today's date.
      // All terms have isActive:true by default (backend default), so sorting
      // by isActive alone is unreliable — we'd end up with the newest term,
      // which may be in the future.  Instead we prefer the term whose date
      // range actually contains today, then fall back to the most-recent past
      // term, then whatever is first in the list.
      final now = await _time.getGhanaTimeAsync();

      AcademicTermModel? activeTerm = terms.cast<AcademicTermModel?>().firstWhere(
            (t) => t?.containsDate(now) == true,
            orElse: () => null,
          );
      activeTerm ??= terms.cast<AcademicTermModel?>().firstWhere(
            (t) => t != null && t.endDate.isNotEmpty && t.endDate.compareTo(
              now.toIso8601String().substring(0, 10)) < 0,
            orElse: () => terms.isNotEmpty ? terms.first : null,
          );

      if (activeTerm == null) {
        return const Left(ServerFailure('No active term found.'));
      }

      // 2. Fetch the report for the active term.
      final reportResponse = await _api.get<dynamic>(
        ApiEndpoints.myReportTerm(activeTerm.id),
      );

      final rawReport = reportResponse.data;
      if (rawReport == null || rawReport is! Map<String, dynamic>) {
        return const Left(ServerFailure('Empty or malformed report data.'));
      }

      final report = TermReportModel.fromJson(rawReport);
      return Right(report);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return const Left(NetworkFailure());
      }
      return Left(ServerFailure(e.message ?? 'Server error.'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, HomeDataEntity>> getHomeData() async {
    try {
      final response =
          await _api.get<Map<String, dynamic>>(ApiEndpoints.homeData);
      if (response.data == null) {
        return const Left(ServerFailure('Empty home data.'));
      }
      final model = HomeDataModel.fromJson(response.data!);
      return Right(model);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return const Left(NetworkFailure());
      }
      return Left(ServerFailure(e.message ?? 'Server error.'));
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  // ── Sync pending ──────────────────────────────────────────────────────────
  @override
  Future<Either<Failure, int>> syncPendingRecords() async {
    var synced = 0;
    String? firstError;

    final keys = _box.keys.toList();

    for (final key in keys) {
      final raw = _box.get(key);
      if (raw == null) continue;

      final model = AttendanceModel.fromJson(Map<String, dynamic>.from(raw));
      if (model.syncStatus != SyncStatus.pending) continue;

      try {
        final currentUptime = await _uptime.getUptimeMs();
        final calculatedBootTime = currentUptime > 0 
            ? DateTime.now().millisecondsSinceEpoch - currentUptime 
            : null;

        await _api.post<void>(
          ApiEndpoints.syncOffline,
          data: {
            'records': [model.toApiJson()],
            'syncUptime': currentUptime > 0 ? currentUptime : null,
            'syncBootTime': calculatedBootTime,
          },
        );
        await _box.delete(key);
        synced++;
      } on DioException catch (e) {
        if (e.type == DioExceptionType.connectionError ||
            e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout) {
          // Network error, leave it pending and stop syncing
          firstError ??= 'Network error while syncing.';
          break;
        }

        final rawMsg = e.response?.data?['message'];
        final serverMsg = rawMsg is String
            ? rawMsg
            : rawMsg is List
                ? rawMsg.join(', ')
                : e.message ?? 'Server error.';

        firstError ??= serverMsg;

        // If it's a 4xx error (business rule rejection like weekend clocking),
        // delete it from local storage so it doesn't get stuck forever.
        if (e.response?.statusCode != null &&
            e.response!.statusCode! >= 400 &&
            e.response!.statusCode! < 500) {
          await _box.delete(key);
        }
      } catch (e) {
        firstError ??= e.toString();
      }
    }

    if (firstError != null) {
      return Left(ServerFailure(firstError));
    }

    return Right(synced);
  }

  // ── QR clock-in ───────────────────────────────────────────────────────────
  @override
  Future<Either<Failure, AttendanceEntity>> recordViaQr({
    required String qrCode,
    required AttendanceType type,
    required double latitude,
    required double longitude,
    bool forceEarlyOut = false,
  }) async {
    late DateTime safeTimestamp;
    try {
      safeTimestamp = await _time.getSafeDateTime();
    } on TimeTamperingException catch (e) {
      return Left(TimeTamperingFailure(e.message));
    }

    final currentUptime = await _uptime.getUptimeMs();
    final calculatedBootTime = currentUptime > 0 
        ? DateTime.now().millisecondsSinceEpoch - currentUptime 
        : null;

    final pending = AttendanceModel.pending(
      employeeId: '', // Will be resolved server-side from JWT
      type: type,
      latitude: latitude,
      longitude: longitude,
      timestamp: safeTimestamp,
      uptimeAtClockIn: currentUptime > 0 ? currentUptime : null,
      calculatedBootTime: calculatedBootTime,
    );

    final isOnline = _connectivity.isOnline;

    if (!isOnline) {
      // QR clock-ins still need online validation, so we can't fully support
      // offline QR scans. Save with a flag indicating it needs QR validation.
      await _box.put(pending.id, pending.toJson());
      return Right(pending);
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        ApiEndpoints.qrClock,
        data: {
          'qrCode': qrCode,
          'type': type.value,
          'latitude': latitude,
          'longitude': longitude,
          if (forceEarlyOut) 'forceEarlyOut': true,
        },
      );
      final synced = AttendanceModel.fromJson(
        response.data as Map<String, dynamic>,
      );
      return Right(synced);
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        await _box.put(pending.id, pending.toJson());
        return Right(pending);
      }
      final rawMsg = e.response?.data?['message'];
      final serverMsg = rawMsg is String
          ? rawMsg
          : rawMsg is List
              ? rawMsg.join(', ')
              : e.message ?? 'Server error.';

      // Check for structured early-clock-out warning.
      try {
        final decoded = Map<String, dynamic>.from(
          _tryDecodeJson(serverMsg) ?? {},
        );
        if (decoded['code'] == 'EARLY_CLOCK_OUT') {
          return Left(EarlyClockOutFailure(
            decoded['message'] as String,
            decoded['remainingMinutes'] as int? ?? 0,
          ));
        }
      } catch (_) {}

      return Left(ServerFailure(serverMsg));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  /// Tries to parse [s] as JSON. Returns the decoded map or null.
  Map<String, dynamic>? _tryDecodeJson(String s) {
    try {
      final decoded = jsonDecode(s);
      if (decoded is Map<String, dynamic>) return decoded;
    } catch (_) {}
    return null;
  }
}
