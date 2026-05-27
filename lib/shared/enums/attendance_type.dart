/// Attendance event types used across mobile, backend, and local DB.
enum AttendanceType {
  clockIn('clock_in'),
  clockOut('clock_out'),
  breakIn('break_in'),
  breakOut('break_out');

  const AttendanceType(this.value);

  /// JSON / backend string value.
  final String value;

  static AttendanceType fromValue(String value) {
    final normalized = value.toLowerCase();
    
    // Backward compatibility for old values
    if (normalized == 'break_start' || normalized == 'breakstart') {
      return AttendanceType.breakIn;
    }
    if (normalized == 'break_end' || normalized == 'breakend') {
      return AttendanceType.breakOut;
    }

    return AttendanceType.values.firstWhere(
      (e) => e.value == normalized || e.value.replaceAll('_', '') == normalized.replaceAll('_', ''),
      orElse: () => AttendanceType.clockIn, // Fallback to avoid crashes
    );
  }
}
