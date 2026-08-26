import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';

/// Handles all local data persistence.
///
/// Uses [FlutterSecureStorage] for sensitive tokens and [SharedPreferences]
/// for non-sensitive preferences.
class StorageService {
  StorageService({
    required SharedPreferences prefs,
    required FlutterSecureStorage secureStorage,
  })  : _prefs = prefs,
        _secure = secureStorage;

  final SharedPreferences _prefs;
  final FlutterSecureStorage _secure;

  // ── Tokens (secure) ───────────────────────────────────────────────────────
  Future<void> saveAccessToken(String token) =>
      _secure.write(key: AppConstants.accessTokenKey, value: token);

  Future<String?> getAccessToken() =>
      _secure.read(key: AppConstants.accessTokenKey);

  Future<void> saveRefreshToken(String token) =>
      _secure.write(key: AppConstants.refreshTokenKey, value: token);

  Future<String?> getRefreshToken() =>
      _secure.read(key: AppConstants.refreshTokenKey);

  Future<void> clearSession() async {
    await Future.wait([
      _secure.delete(key: AppConstants.accessTokenKey),
      _secure.delete(key: AppConstants.refreshTokenKey),
      _prefs.remove(AppConstants.userKey),
      _prefs.remove(AppConstants.tenantIdKey),
    ]);
  }

  // ── User JSON (prefs) ─────────────────────────────────────────────────────
  Future<void> saveUserJson(String json) =>
      _prefs.setString(AppConstants.userKey, json);

  String? getUserJson() => _prefs.getString(AppConstants.userKey);

  // ── Theme preference ──────────────────────────────────────────────────────
  Future<void> saveTheme(String mode) =>
      _prefs.setString(AppConstants.themeKey, mode);

  String? getTheme() => _prefs.getString(AppConstants.themeKey);

  bool get isLoggedIn => getUserJson() != null;

  // ── Server URL ────────────────────────────────────────────────────────────
  Future<void> saveServerUrl(String url) =>
      _prefs.setString(AppConstants.serverUrlKey, url);

  String? getServerUrl() => _prefs.getString(AppConstants.serverUrlKey);

  // ── Tenant (school) identity ──────────────────────────────────────────────
  Future<void> saveTenantId(String id) =>
      _prefs.setString(AppConstants.tenantIdKey, id);

  String? getTenantId() => _prefs.getString(AppConstants.tenantIdKey);

  Future<void> saveSubdomainSlug(String slug) =>
      _prefs.setString(AppConstants.subdomainSlugKey, slug);

  String? getSubdomainSlug() => _prefs.getString(AppConstants.subdomainSlugKey);

  // ── Notifications ─────────────────────────────────────────────────────────
  Future<void> saveNotificationsEnabled(bool enabled) =>
      _prefs.setBool(AppConstants.notificationsEnabledKey, enabled);

  bool? getNotificationsEnabled() => _prefs.getBool(AppConstants.notificationsEnabledKey);

  // ── App update reminders ─────────────────────────────────────────────────
  Future<void> snoozeAppUpdate({
    required int versionCode,
    required DateTime until,
  }) async {
    await Future.wait([
      _prefs.setInt(AppConstants.appUpdateSnoozedVersionCodeKey, versionCode),
      _prefs.setString(
        AppConstants.appUpdateSnoozedUntilKey,
        until.toIso8601String(),
      ),
    ]);
  }

  bool isAppUpdateSnoozed(int versionCode) {
    final snoozedVersion =
        _prefs.getInt(AppConstants.appUpdateSnoozedVersionCodeKey);
    final snoozedUntilRaw =
        _prefs.getString(AppConstants.appUpdateSnoozedUntilKey);
    final snoozedUntil = snoozedUntilRaw == null
        ? null
        : DateTime.tryParse(snoozedUntilRaw);

    return snoozedVersion == versionCode &&
        snoozedUntil != null &&
        DateTime.now().isBefore(snoozedUntil);
  }

  // ── Offline login credentials (non-sensitive hash, prefs) ─────────────────
  Future<void> saveOfflineIdentifier(String identifier) =>
      _prefs.setString(AppConstants.offlineIdentifierKey, identifier);

  String? getOfflineIdentifier() =>
      _prefs.getString(AppConstants.offlineIdentifierKey);

  Future<void> saveOfflinePasswordHash(String hash) =>
      _prefs.setString(AppConstants.offlinePasswordHashKey, hash);

  String? getOfflinePasswordHash() =>
      _prefs.getString(AppConstants.offlinePasswordHashKey);

  Future<void> saveOfflineUserJson(String json) =>
      _prefs.setString(AppConstants.offlineUserKey, json);

  String? getOfflineUserJson() => _prefs.getString(AppConstants.offlineUserKey);

  Future<void> clearOfflineCredentials() async {
    await Future.wait([
      _prefs.remove(AppConstants.offlineIdentifierKey),
      _prefs.remove(AppConstants.offlinePasswordHashKey),
      _prefs.remove(AppConstants.offlineUserKey),
    ]);
  }

  // ── Biometric login credentials (secure storage) ──────────────────────────
  Future<void> saveSecureIdentifier(String identifier) =>
      _secure.write(key: AppConstants.secureIdentifierKey, value: identifier);

  Future<String?> getSecureIdentifier() =>
      _secure.read(key: AppConstants.secureIdentifierKey);

  Future<void> saveSecurePassword(String password) =>
      _secure.write(key: AppConstants.securePasswordKey, value: password);

  Future<String?> getSecurePassword() =>
      _secure.read(key: AppConstants.securePasswordKey);

  Future<void> clearSecureCredentials() async {
    await Future.wait([
      _secure.delete(key: AppConstants.secureIdentifierKey),
      _secure.delete(key: AppConstants.securePasswordKey),
    ]);
  }

  // ── Biometric Preference (prefs) ──────────────────────────────────────────
  Future<void> saveBiometricEnabled(bool enabled) =>
      _prefs.setBool(AppConstants.biometricEnabledKey, enabled);

  bool? getBiometricEnabled() =>
      _prefs.getBool(AppConstants.biometricEnabledKey);

  // ── Time Tampering ────────────────────────────────────────────────────────
  Future<void> saveLastKnownTimeOffset(int offsetMillis) =>
      _prefs.setInt(AppConstants.lastKnownTimeOffsetKey, offsetMillis);

  int? getLastKnownTimeOffset() =>
      _prefs.getInt(AppConstants.lastKnownTimeOffsetKey);

  Future<void> saveLastKnownTrueTime(DateTime time) => _prefs.setString(
      AppConstants.lastKnownTrueTimeKey, time.toIso8601String());

  DateTime? getLastKnownTrueTime() {
    final str = _prefs.getString(AppConstants.lastKnownTrueTimeKey);
    if (str == null) return null;
    return DateTime.tryParse(str);
  }

  Future<void> saveValidatedBootTime(int bootTimeMs) =>
      _prefs.setInt(AppConstants.validatedBootTimeKey, bootTimeMs);

  int? getValidatedBootTime() =>
      _prefs.getInt(AppConstants.validatedBootTimeKey);

  Future<void> saveLastSavedUptime(int uptimeMs) =>
      _prefs.setInt(AppConstants.lastSavedUptimeKey, uptimeMs);

  int? getLastSavedUptime() => _prefs.getInt(AppConstants.lastSavedUptimeKey);
}
