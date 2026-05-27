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
      _secure.deleteAll(),
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

  // ── Offline login credentials (non-sensitive hash, prefs) ─────────────────
  Future<void> saveOfflineIdentifier(String identifier) =>
      _prefs.setString(AppConstants.offlineIdentifierKey, identifier);

  String? getOfflineIdentifier() =>
      _prefs.getString(AppConstants.offlineIdentifierKey);

  Future<void> saveOfflinePasswordHash(String hash) =>
      _prefs.setString(AppConstants.offlinePasswordHashKey, hash);

  String? getOfflinePasswordHash() =>
      _prefs.getString(AppConstants.offlinePasswordHashKey);

  Future<void> clearOfflineCredentials() async {
    await Future.wait([
      _prefs.remove(AppConstants.offlineIdentifierKey),
      _prefs.remove(AppConstants.offlinePasswordHashKey),
    ]);
  }

  // ── Time Tampering ────────────────────────────────────────────────────────
  Future<void> saveLastKnownTimeOffset(int offsetMillis) =>
      _prefs.setInt(AppConstants.lastKnownTimeOffsetKey, offsetMillis);

  int? getLastKnownTimeOffset() =>
      _prefs.getInt(AppConstants.lastKnownTimeOffsetKey);

  Future<void> saveLastKnownTrueTime(DateTime time) =>
      _prefs.setString(AppConstants.lastKnownTrueTimeKey, time.toIso8601String());

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

  int? getLastSavedUptime() =>
      _prefs.getInt(AppConstants.lastSavedUptimeKey);
}
