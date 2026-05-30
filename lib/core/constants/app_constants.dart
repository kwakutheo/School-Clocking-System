/// Application-wide constants.
abstract final class AppConstants {
  // ── API ───────────────────────────────────────────────────────────────────
  static String baseUrl = const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://school-clocking-system.onrender.com/api/v1',
  ); // Cloud backend
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // ── Storage keys ─────────────────────────────────────────────────────────
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey = 'current_user';
  static const String themeKey = 'app_theme';
  static const String serverUrlKey = 'server_url';
  static const String tenantIdKey = 'tenant_id';

  // ── Offline login keys ───────────────────────────────────────────────────
  static const String offlineIdentifierKey = 'offline_identifier';
  static const String offlinePasswordHashKey = 'offline_password_hash';

  // ── Time Tampering keys ──────────────────────────────────────────────────
  static const String lastKnownTimeOffsetKey = 'last_known_time_offset';
  static const String lastKnownTrueTimeKey = 'last_known_true_time';
  static const String validatedBootTimeKey = 'validated_boot_time';
  static const String lastSavedUptimeKey = 'last_saved_uptime';

  // ── Hive boxes ───────────────────────────────────────────────────────────
  static const String attendanceBox = 'attendance_box';
  static const String userBox = 'user_box';

  // ── GPS ───────────────────────────────────────────────────────────────────
  /// Default geofence radius in meters used when the branch has none set.
  static const int defaultGeofenceRadius = 50;

  // ── Pagination ────────────────────────────────────────────────────────────
  static const int defaultPageSize = 20;

  // ── Retry ─────────────────────────────────────────────────────────────────
  static const int maxSyncRetries = 3;
}















































