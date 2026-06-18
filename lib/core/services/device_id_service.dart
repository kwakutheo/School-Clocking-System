import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

/// Provides a stable device identifier for the attendance restriction system.
///
/// ## Strategy (most stable → least stable):
/// 1. **Android**: Uses `ANDROID_ID` — a hardware-backed 64-bit identifier
///    that survives app reinstalls and persists until a factory reset.
/// 2. **iOS**: Uses `identifierForVendor` — a per-vendor UUID that persists
///    unless ALL apps from this vendor are uninstalled simultaneously.
/// 3. **Fallback**: If neither is available (emulators, unsupported platforms),
///    generates a UUID v4 the first time and persists it in SharedPreferences.
///    This fallback DOES reset on app reinstall, which is the known trade-off.
///
/// ## Why not use SharedPreferences UUID as primary?
/// A UUID stored in SharedPreferences is cleared when the app is uninstalled.
/// An employee could bypass the device restriction by reinstalling the app and
/// getting a new UUID, effectively appearing as a "different device" each time.
/// Hardware-backed IDs prevent this loophole.
///
/// ## Offline sync note:
/// `DeviceIdService` is synchronous after the first call. The deviceId is
/// fetched once per clocking action in the bloc before the API call, so it
/// adds no latency to the clocking UI.
class DeviceIdService {
  DeviceIdService(this._prefs);

  final SharedPreferences _prefs;
  final _deviceInfo = DeviceInfoPlugin();

  static const _fallbackKey = 'device_install_id';

  /// Returns the stable device ID.
  ///
  /// Tries hardware-backed ID first; falls back to a persisted UUID.
  Future<String> getDeviceId() async {
    // 1. Try hardware-backed ID
    final hardwareId = await _getHardwareId();
    if (hardwareId != null && hardwareId.isNotEmpty) return hardwareId;

    // 2. Fallback: persisted UUID (survives until app uninstall)
    final existing = _prefs.getString(_fallbackKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final newId = const Uuid().v4();
    await _prefs.setString(_fallbackKey, newId);
    return newId;
  }

  /// Attempts to retrieve a hardware-backed device identifier.
  /// Returns null if unavailable (e.g., emulator returning empty string,
  /// unsupported platform, or permission denied).
  Future<String?> _getHardwareId() async {
    try {
      if (Platform.isAndroid) {
        final info = await _deviceInfo.androidInfo;
        // ANDROID_ID: 64-bit hex string, stable across reinstalls.
        // May be null on rare Android forks; we guard with isEmpty.
        final id = info.id;
        return id.isNotEmpty ? id : null;
      }
      if (Platform.isIOS) {
        final info = await _deviceInfo.iosInfo;
        // identifierForVendor: stable unless all vendor apps are uninstalled.
        final id = info.identifierForVendor;
        return (id != null && id.isNotEmpty) ? id : null;
      }
    } catch (_) {
      // Silently fall through to UUID fallback — never crash the clocking flow.
    }
    return null;
  }
}
