import 'package:dio/dio.dart';

class NetworkException implements Exception {
  final String message;
  final String? errorType;
  final int? statusCode;
  final int? retryAfterSeconds;

  NetworkException({
    required this.message,
    this.errorType,
    this.statusCode,
    this.retryAfterSeconds,
  });

  factory NetworkException.fromDioError(DioException dioError) {
    String message = 'An unexpected error occurred.';
    String? errorType;
    int? statusCode = dioError.response?.statusCode;
    int? retryAfterSeconds;

    switch (dioError.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        message = 'Connection timed out. Please check your internet connection.';
        errorType = 'TimeoutError';
        break;
      case DioExceptionType.badResponse:
        final data = dioError.response?.data;
        if (data is Map<String, dynamic>) {
          // Extract retryAfterSeconds for HTTP 429 (ACCOUNT_LOCKED)
          if (statusCode == 429) {
            errorType = data['code'] as String? ?? 'ACCOUNT_LOCKED';
            retryAfterSeconds = data['retryAfterSeconds'] as int?;
            final msg = data['message'];
            message = msg is String ? msg : 'Too many failed attempts. Account temporarily locked.';
          } else {
            final msg = data['message'];
            if (msg is List) {
              message = msg.join(', ');
            } else if (msg is String) {
              message = msg;
            } else {
              message = 'Received invalid status code: $statusCode';
            }
            errorType = data['error'];
          }
        } else {
          message = 'Received invalid status code: $statusCode';
        }
        break;
      case DioExceptionType.connectionError:
        message = 'No internet connection. Please check your network.';
        errorType = 'ConnectionError';
        break;
      default:
        message = 'Network error occurred. Please try again.';
        errorType = 'UnknownError';
        break;
    }

    return NetworkException(
      message: message,
      errorType: errorType,
      statusCode: statusCode,
      retryAfterSeconds: retryAfterSeconds,
    );
  }

  bool get isAccountLocked => statusCode == 429 && errorType == 'ACCOUNT_LOCKED';

  @override
  String toString() => message;
}
