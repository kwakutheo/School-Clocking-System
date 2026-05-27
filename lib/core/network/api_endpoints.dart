/// Defines all backend REST API endpoint paths.
///
/// Keep every URL string in one place so that a backend change only
/// requires editing this file.
abstract final class ApiEndpoints {
  // ── Auth ──────────────────────────────────────────────────────────────────
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String logout = '/auth/logout';
  static const String refreshToken = '/auth/refresh';
  static const String me = '/auth/me';

  // ── Attendance ────────────────────────────────────────────────────────────
  static const String clockIn = '/attendance/clock-in';
  static const String clockOut = '/attendance/clock-out';
  static const String breakStart = '/attendance/break-start';
  static const String breakEnd = '/attendance/break-end';
  static const String attendanceHistory = '/attendance/history';
  static const String liveAttendance = '/attendance/live';

  // ── Sync ─────────────────────────────────────────────────────────────────
  static const String syncOffline = '/attendance/sync';

  // ── QR Clock ──────────────────────────────────────────────────────────────
  static const String qrClock = '/attendance/qr-clock';

  // ── Reports ───────────────────────────────────────────────────────────────
  static String myReportTerm(String termId) => '/attendance/my-report/term/$termId';
  static const String homeData = '/attendance/home-data';

  // ── Terms ─────────────────────────────────────────────────────────────────
  static const String terms = '/academic-calendar/terms';

  // ── Employees ────────────────────────────────────────────────────────────
  static const String employees = '/employees';
  static String employee(String id) => '/employees/$id';
  static const String employeeMe = '/employees/me';
  static const String employeeMeUpdate = '/employees/me';

  // ── Branches ─────────────────────────────────────────────────────────────
  static const String branches = '/branches';
}
