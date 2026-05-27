import 'package:equatable/equatable.dart';

/// Base class for all domain-layer failures.
///
/// Using [Failure] instead of raw exceptions lets the presentation layer
/// display user-friendly messages without catching raw [Exception]s.
abstract class Failure extends Equatable {
  const Failure(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

// ── Network failures ──────────────────────────────────────────────────────────
class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'No internet connection.']);
}

class ServerFailure extends Failure {
  const ServerFailure(
      [super.message = 'Something went wrong. Please try again.']);
}

class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure(
      [super.message = 'Session expired. Please log in again.']);
}

class TimeoutFailure extends Failure {
  const TimeoutFailure(
      [super.message = 'Request timed out. Check your connection.']);
}

// ── Auth failures ─────────────────────────────────────────────────────────────
class InvalidCredentialsFailure extends Failure {
  const InvalidCredentialsFailure(
      [super.message = 'Invalid username or password.']);
}

// ── Location failures ─────────────────────────────────────────────────────────
class LocationPermissionFailure extends Failure {
  const LocationPermissionFailure(
      [super.message = 'Location permission denied.']);
}

class LocationServiceFailure extends Failure {
  const LocationServiceFailure(
      [super.message = 'Location service is disabled.']);
}

class GeofenceFailure extends Failure {
  const GeofenceFailure(
      [super.message = 'You are not within the branch location.']);
}

// ── Cache failures ────────────────────────────────────────────────────────────
class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Local data error.']);
}

// ── Attendance soft-block failures ────────────────────────────────────────────
/// Returned when the user tries to clock out before their shift ends.
/// Carry [remainingMinutes] so the UI can show the precise time left.
class EarlyClockOutFailure extends Failure {
  const EarlyClockOutFailure(super.message, this.remainingMinutes);

  final int remainingMinutes;

  @override
  List<Object?> get props => [message, remainingMinutes];
}

class TimeTamperingFailure extends Failure {
  const TimeTamperingFailure(
      [super.message = 'Device time has been manipulated. Please correct your system clock.']);
}
