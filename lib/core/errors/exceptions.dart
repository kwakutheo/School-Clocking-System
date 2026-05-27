/// Raw exceptions thrown in the data layer.
///
/// These are mapped to [Failure] subtypes in repositories so that
/// the domain layer never sees raw exceptions.
class ServerException implements Exception {
  const ServerException([this.message = 'Server error.']);
  final String message;
}

class UnauthorizedException implements Exception {
  const UnauthorizedException([this.message = 'Unauthorized.']);
  final String message;
}

class NetworkException implements Exception {
  const NetworkException([this.message = 'No internet connection.']);
  final String message;
}

class TimeoutException implements Exception {
  const TimeoutException([this.message = 'Request timed out.']);
  final String message;
}

class CacheException implements Exception {
  const CacheException([this.message = 'Cache error.']);
  final String message;
}

class LocationException implements Exception {
  const LocationException([this.message = 'Location error.']);
  final String message;
}

class GeofenceException implements Exception {
  const GeofenceException([this.message = 'Outside branch radius.']);
  final String message;
}

class TimeTamperingException implements Exception {
  const TimeTamperingException([this.message = 'Device time tampered.']);
  final String message;
}
