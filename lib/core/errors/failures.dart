import 'package:equatable/equatable.dart';

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

class AccountLockedFailure extends Failure {
  const AccountLockedFailure(super.message, this.retryAfterSeconds);

  final int retryAfterSeconds;

  @override
  List<Object?> get props => [message, retryAfterSeconds];
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
class EarlyClockOutFailure extends Failure {
  const EarlyClockOutFailure(super.message, this.remainingMinutes);

  final int remainingMinutes;

  @override
  List<Object?> get props => [message, remainingMinutes];
}

class TimeTamperingFailure extends Failure {
  const TimeTamperingFailure(
      [super.message =
          'Device time has been manipulated. Please correct your system clock.']);
}

class WeekendFailure extends Failure {
  const WeekendFailure(
      [super.message =
          'Clocking is not allowed on weekends. Enjoy your day off!']);
}

class HolidayFailure extends Failure {
  const HolidayFailure(
      [super.message = 'Clocking is not allowed on a public holiday.']);
}

class LeaveOrVacationFailure extends Failure {
  const LeaveOrVacationFailure(
      [super.message =
          'Clocking is not allowed while you are on leave or vacation.']);
}

class DuplicateClockInFailure extends Failure {
  const DuplicateClockInFailure(
      [super.message = 'You have already clocked in today.']);
}

class NoShiftAssignedFailure extends Failure {
  const NoShiftAssignedFailure(
      [super.message =
          'You have not been assigned a work shift. Please contact HR to assign you a shift before clocking in.']);
}

class OutsideShiftHoursFailure extends Failure {
  const OutsideShiftHoursFailure(
      [super.message =
          'You can only clock in within your assigned shift hours (or up to 2 hours before).']);
}

class NotClockedInFailure extends Failure {
  const NotClockedInFailure(
      [super.message = 'You must clock in first before taking this action.']);
}

class AlreadyOnBreakFailure extends Failure {
  const AlreadyOnBreakFailure([super.message = 'You are already on a break.']);
}

class NotOnBreakFailure extends Failure {
  const NotOnBreakFailure(
      [super.message = 'You are not currently on a break.']);
}

class InvalidQrCodeFailure extends Failure {
  const InvalidQrCodeFailure(
      [super.message =
          'This QR code seems to be invalid or does not belong to your school.\nPlease turn on your internet and try again for proper verification.']);
}

class OutsideGeofenceFailure extends Failure {
  const OutsideGeofenceFailure(
      [super.message = 'You are outside the assigned work zone.']);
}
