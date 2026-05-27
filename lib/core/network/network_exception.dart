import 'package:dio/dio.dart';

class NetworkException implements Exception {
  final String message;
  final String? errorType;
  final int? statusCode;

  NetworkException({
    required this.message,
    this.errorType,
    this.statusCode,
  });

  factory NetworkException.fromDioError(DioException dioError) {
    String message = 'An unexpected error occurred.';
    String? errorType;
    int? statusCode = dioError.response?.statusCode;

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
          message = data['message'] ?? 'Received invalid status code: $statusCode';
          errorType = data['error'];
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
    );
  }

  @override
  String toString() => message;
}
