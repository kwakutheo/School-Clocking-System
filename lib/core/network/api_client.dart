import 'dart:async';

import 'package:dio/dio.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';

/// Configured [Dio] HTTP client for all backend communication.
///
/// Automatically attaches the JWT Bearer token to every request and
/// handles 401 responses by clearing the session.
class ApiClient {
  ApiClient({required StorageService storage}) : _storage = storage {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    );

    _dio.interceptors.addAll([
      _authInterceptor(),
      PrettyDioLogger(
        requestHeader: false,
        requestBody: true,
        responseBody: true,
        compact: true,
      ),
    ]);
  }

  late final Dio _dio;
  final StorageService _storage;
  final _unauthorizedController = StreamController<void>.broadcast();

  Dio get dio => _dio;

  Stream<void> get onUnauthorized => _unauthorizedController.stream;

  void updateBaseUrl(String newUrl) {
    _dio.options.baseUrl = newUrl;
  }

  // ── Auth interceptor ──────────────────────────────────────────────────────
  InterceptorsWrapper _authInterceptor() => InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.getAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          // Attach the school tenant ID so the backend always resolves
          // the correct school context, even before JWT is decoded.
          final tenantId = _storage.getTenantId();
          if (tenantId != null) {
            options.headers['x-tenant-id'] = tenantId;
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            // Prevent infinite loop if the refresh token endpoint itself returns 401
            if (error.requestOptions.path.contains('/auth/refresh')) {
              await _storage.clearSession();
              _unauthorizedController.add(null);
              return handler.next(error);
            }

            // Guard against infinite retry loops: if this request was already a
            // retry, don't attempt to refresh again — just pass the error through.
            if (error.requestOptions.extra['_isRetry'] == true) {
              return handler.next(error);
            }

            final refreshToken = await _storage.getRefreshToken();
            if (refreshToken != null) {
              try {
                // Attempt to get a new access token using the refresh token
                final refreshResponse = await Dio(
                  BaseOptions(
                    baseUrl: _dio.options.baseUrl,
                    headers: {
                      'Content-Type': 'application/json',
                      if (_storage.getTenantId() != null)
                        'x-tenant-id': _storage.getTenantId(),
                    },
                  ),
                ).post(
                  '/auth/refresh',
                  data: {'refreshToken': refreshToken},
                );

                final newAccessToken = refreshResponse.data['access_token'];
                final newRefreshToken = refreshResponse.data['refresh_token'];

                if (newAccessToken != null) {
                  // Save the new tokens
                  await _storage.saveAccessToken(newAccessToken);
                  if (newRefreshToken != null) {
                    await _storage.saveRefreshToken(newRefreshToken);
                  }

                  // Retry the original request with the new token.
                  // Mark as a retry so the interceptor doesn't loop if it
                  // gets another 401 (e.g. server issue with fresh token).
                  final retryOptions = error.requestOptions;
                  retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';
                  retryOptions.extra['_isRetry'] = true;
                  
                  try {
                    final retryResponse = await _dio.fetch(retryOptions);
                    return handler.resolve(retryResponse);
                  } on DioException catch (e) {
                    return handler.reject(e);
                  }
                }
              } catch (_) {
                // If refresh fails, fall through to login fallback below
              }
            }

            // FALLBACK: Auto-login using secure credentials if refresh failed or no refresh token.
            // This is crucial for users who logged in offline and therefore have no valid tokens.
            try {
              final username = await _storage.getSecureIdentifier();
              final password = await _storage.getSecurePassword();

              if (username != null && password != null) {
                final loginResponse = await Dio(
                  BaseOptions(
                    baseUrl: _dio.options.baseUrl,
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  ),
                ).post(
                  '/auth/login',
                  data: {'identifier': username, 'password': password},
                );

                final data = loginResponse.data;
                if (data is Map<String, dynamic>) {
                  final newAccessToken = data['access_token'];
                  final newRefreshToken = data['refresh_token'];

                  if (newAccessToken != null) {
                    await _storage.saveAccessToken(newAccessToken as String);
                    if (newRefreshToken != null) {
                      await _storage.saveRefreshToken(newRefreshToken as String);
                    }

                    // Also capture tenant ID if available
                    final userJson = data['user'];
                    String? newTenantId;
                    if (userJson is Map<String, dynamic> && userJson['tenantId'] != null) {
                      newTenantId = userJson['tenantId'] as String;
                      await _storage.saveTenantId(newTenantId);
                    }

                    final retryOptions = error.requestOptions;
                    retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';
                    if (newTenantId != null) {
                      retryOptions.headers['x-tenant-id'] = newTenantId;
                    }
                    retryOptions.extra['_isRetry'] = true;
                    
                    try {
                      final retryResponse = await _dio.fetch(retryOptions);
                      return handler.resolve(retryResponse);
                    } on DioException catch (e) {
                      return handler.reject(e);
                    }
                  }
                }
              }
            } catch (_) {
              // If auto-login fails, fall through to normal failure/logout handling
            }

            // Refresh and auto-login both failed. Only force-logout for
            // user-facing critical paths. Background tasks (sync, profile
            // refresh, home-data polling) must NOT kick the user out —
            // they should just silently fail and retry next cycle.
            final path = error.requestOptions.path;
            final isBackgroundRequest =
                path.contains('/attendance/sync') ||
                path.contains('/employees/me') ||
                path.contains('/attendance/home-data') ||
                path.contains('/attendance/history') ||
                path.contains('/attendance/my-report') ||
                path.contains('/attendance/live') ||
                path.contains('/academic-calendar') ||
                path.contains('/auth/me/fcm-token');

            if (!isBackgroundRequest) {
              await _storage.clearSession();
              _unauthorizedController.add(null);
            }
          }
          handler.next(error);
        },
      );

  // ── HTTP helpers ──────────────────────────────────────────────────────────
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) =>
      _dio.get<T>(path, queryParameters: queryParameters);

  Future<Response<T>> post<T>(
    String path, {
    Object? data,
  }) =>
      _dio.post<T>(path, data: data);

  Future<Response<T>> put<T>(
    String path, {
    Object? data,
  }) =>
      _dio.put<T>(path, data: data);

  Future<Response<T>> patch<T>(
    String path, {
    Object? data,
  }) =>
      _dio.patch<T>(path, data: data);

  Future<Response<T>> delete<T>(String path) => _dio.delete<T>(path);
}
