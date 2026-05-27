import 'dart:convert';

import 'package:crypto/crypto.dart';

import 'package:dio/dio.dart';
import 'package:dartz/dartz.dart';

import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/core/network/api_endpoints.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/features/auth/data/models/user_model.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/login_result.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';
import 'package:tk_clocking_system/features/auth/domain/repositories/auth_repository.dart';

/// Concrete implementation of [AuthRepository].
class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl({
    required ApiClient apiClient,
    required StorageService storage,
  })  : _api = apiClient,
        _storage = storage;

  final ApiClient _api;
  final StorageService _storage;

  @override
  Future<Either<Failure, LoginResult>> login({
    required String username,
    required String password,
  }) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        ApiEndpoints.login,
        data: {'identifier': username, 'password': password},
      );

      final data = response.data!;
      final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);

      await _storage.saveAccessToken(data['access_token'] as String);
      await _storage.saveRefreshToken(data['refresh_token'] as String);
      await _storage.saveUserJson(user.toJsonString());

      // Persist the school tenant ID for automatic header injection
      if (user.tenantId != null) {
        await _storage.saveTenantId(user.tenantId!);
      }

      // Cache credentials hash for offline login fallback
      final identifier = username.trim().toLowerCase();
      await _storage.saveOfflineIdentifier(identifier);
      await _storage.saveOfflinePasswordHash(_hashPassword(password));

      return Right(LoginResult(user: user));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        // Extract the actual reason from the backend response body.
        // The backend sends e.g: { "message": "Your account has been deactivated..." }
        final responseData = e.response?.data;
        String errorMessage = 'Invalid username or password.';
        if (responseData is Map<String, dynamic> &&
            responseData['message'] is String) {
          errorMessage = responseData['message'] as String;
        }
        return Left(InvalidCredentialsFailure(errorMessage));
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return await _tryOfflineLogin(username, password);
      }
      if (e.type == DioExceptionType.connectionError) {
        return await _tryOfflineLogin(username, password);
      }
      return const Left(ServerFailure('Unable to connect to the server. Please check your network or server IP.'));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  // ── Offline login fallback ────────────────────────────────────────────────
  Future<Either<Failure, LoginResult>> _tryOfflineLogin(
    String username,
    String password,
  ) async {
    final cachedIdentifier = _storage.getOfflineIdentifier();
    final cachedHash = _storage.getOfflinePasswordHash();
    final cachedUserJson = _storage.getUserJson();

    if (cachedIdentifier == null ||
        cachedHash == null ||
        cachedUserJson == null) {
      return const Left(
        NetworkFailure(
          'No internet connection. Please connect and sign in at least once.',
        ),
      );
    }

    final identifier = username.trim().toLowerCase();
    if (identifier != cachedIdentifier ||
        _hashPassword(password) != cachedHash) {
      return const Left(
        InvalidCredentialsFailure(
          'Invalid username or password (offline mode).',
        ),
      );
    }

    final user = UserModel.fromJsonString(cachedUserJson);
    return Right(LoginResult(user: user, isOffline: true));
  }

  String _hashPassword(String password) {
    final bytes = utf8.encode(password);
    return sha256.convert(bytes).toString();
  }

  @override
  Future<Either<Failure, void>> logout() async {
    try {
      await _storage.clearSession();
      await _storage.clearOfflineCredentials();
      return const Right(null);
    } catch (_) {
      return const Left(CacheFailure());
    }
  }

  @override
  Future<Either<Failure, UserEntity?>> getCachedUser() async {
    try {
      final json = _storage.getUserJson();
      if (json == null) return const Right(null);
      return Right(UserModel.fromJsonString(json));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }

  @override
  Future<Either<Failure, UserEntity>> syncProfile() async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.employeeMe,
      );
      final data = response.data!;

      // /employees/me returns the Employee entity directly.
      // The user details live under data['user'], and employment details
      // (branch, department, position, hireDate) are at the top level.
      final userMap = (data['user'] as Map<String, dynamic>?) ?? data;

      // Merge employee-level fields into the user map so UserModel.fromJson
      // can pick up branch/department names, position, and hire date.
      // NOTE: userMap['tenant'] is now included by the backend (user.tenant join).
      final merged = <String, dynamic>{
        ...userMap,
        'employee_id': data['id'] ?? userMap['employee_id'],
        'employee_code': data['employeeCode'] ?? userMap['employee_code'],
        'branch': data['branch'],
        'department': data['department'],
        'position': data['position'],
        'hire_date': data['hireDate'],
      };

      // Safety net: if the server still omits tenant, fall back to cached values
      if (merged['tenant'] == null && merged['tenantId'] == null) {
        final cachedJsonStr = _storage.getUserJson();
        if (cachedJsonStr != null) {
          try {
            final cachedUser = UserModel.fromJsonString(cachedJsonStr);
            merged['tenantId'] = cachedUser.tenantId;
            merged['schoolName'] = cachedUser.schoolName;
          } catch (_) {}
        }
      }

      final user = UserModel.fromJson(merged);
      await _storage.saveUserJson(user.toJsonString());
      return Right(user);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        return const Left(InvalidCredentialsFailure());
      }
      return Left(ServerFailure(e.message ?? 'Server error.'));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, void>> updateFcmToken(String token) async {
    try {
      await _api.patch(
        '/auth/me/fcm-token',
        data: {'token': token},
      );
      return const Right(null);
    } on DioException catch (e) {
      return Left(ServerFailure(e.message ?? 'Server error.'));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
