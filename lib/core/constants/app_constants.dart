/// Application-wide constants.
abstract final class AppConstants {
  // ── API ───────────────────────────────────────────────────────────────────
  static String baseUrl = const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://school-clocking-system.onrender.com/api/v1',
  ); // Cloud backend
  static const Duration connectTimeout = Duration(seconds: 8);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // ── Storage keys ─────────────────────────────────────────────────────────
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey = 'current_user';
  static const String themeKey = 'app_theme';
  static const String serverUrlKey = 'server_url';
  static const String tenantIdKey = 'tenant_id';
  static const String subdomainSlugKey = 'subdomain_slug';
  static const String notificationsEnabledKey = 'notifications_enabled';
  static const String appUpdateSnoozedVersionCodeKey =
      'app_update_snoozed_version_code';
  static const String appUpdateSnoozedUntilKey = 'app_update_snoozed_until';

  // ── Mobile app updates ───────────────────────────────────────────────────
  static const String appDownloadBaseUrl = String.fromEnvironment(
    'APP_DOWNLOAD_BASE_URL',
    defaultValue: 'https://tkclocking.online',
  );
  static const String apkMimeType = 'application/vnd.android.package-archive';

  // ── Offline login keys ───────────────────────────────────────────────────
  static const String offlineIdentifierKey = 'offline_identifier';
  static const String offlinePasswordHashKey = 'offline_password_hash';
  static const String offlineUserKey = 'offline_user';

  // ── Offline calendar cache keys (stored in userBox) ──────────────────────
  static const String holidaysCacheKey = 'holidays_cache';
  static const String vacationDatesCacheKey = 'vacation_dates_cache';

  // ── Biometric login keys (Secure Storage / Prefs) ────────────────────────
  static const String secureIdentifierKey = 'secure_identifier';
  static const String securePasswordKey = 'secure_password';
  static const String biometricEnabledKey = 'biometric_enabled';

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
