import 'dart:io';

import 'package:android_id/android_id.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Provides a stable, per-device identifier for the attendance restriction
/// system.
///
/// ## ID Strategy (most stable → least stable)
///
/// ### Android — `ANDROID_ID`
/// Retrieved via the `android_id` package (`Settings.Secure.ANDROID_ID`).
/// This is a 64-bit hex string that is:
/// * ✅ Unique per physical device + app signing key (Android 8+)
/// * ✅ **Survives app reinstalls**
/// * ✅ **Survives clearing app data**  ← key advantage over SharedPrefs/SecureStorage
/// * ✅ Survives logouts and account switches
/// * ❌ Resets only on factory reset (acceptable — factory reset wipes everything)
///
/// ### iOS — `identifierForVendor`
/// Retrieved via `device_info_plus`. Per-vendor UUID that:
/// * ✅ Unique per device + vendor bundle group
/// * ✅ Survives app reinstalls in most cases
/// * ❌ Resets if ALL apps from this vendor are uninstalled simultaneously
///
/// ### Fallback — UUID in `flutter_secure_storage`
/// Used when the above are unavailable (emulators, unsupported platforms,
/// permission denied). Survives restarts but resets on full app uninstall or
/// data clear. This is the last resort and carries that known trade-off.
///
/// ## Daily device-lock rule
/// The backend enforces a per-calendar-day rule: once a device is used by
/// Employee A, it is locked to Employee A until midnight, and no other employee
/// can use it on the same day. The rule resets at midnight automatically.
///
/// Because the ID is tied to the physical device and survives account switches,
/// logging out and logging in as a different user on the same phone does NOT
/// generate a new device ID — so the daily lock is correctly enforced across
/// account switches.
class DeviceIdService {
  DeviceIdService(this._secure);

  final FlutterSecureStorage _secure;
  final _androidId = const AndroidId();
  final _deviceInfo = DeviceInfoPlugin();

  static const _fallbackKey = 'device_install_id';

  /// Returns the stable device ID for this installation.
  ///
  /// Tries hardware/OS-backed IDs first; falls back to a persisted UUID.
  /// Never returns null or an empty string.
  Future<String> getDeviceId() async {
    // 1. Try OS-backed ID (survives reinstalls + data clears on Android).
    final osId = await _getOsBackedId();
    if (osId != null && osId.isNotEmpty) return osId;

    // 2. Fallback: UUID in secure storage (survives restarts but not uninstalls).
    final existing = await _secure.read(key: _fallbackKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final newId = const Uuid().v4();
    await _secure.write(key: _fallbackKey, value: newId);
    return newId;
  }

  /// Returns null if unavailable (e.g. emulator, unsupported platform,
  /// permission denied), so the caller can fall through to the UUID fallback.
  Future<String?> _getOsBackedId() async {
    try {
      if (Platform.isAndroid) {
        // ANDROID_ID: stored in the Android Settings database (not app data),
        // so it survives both app reinstalls and "Clear App Data" from Settings.
        // Scoped to app signing key on Android 8+, so it is unique per device.
        final id = await _androidId.getId();
        return (id != null && id.isNotEmpty) ? id : null;
      }

      if (Platform.isIOS) {
        // identifierForVendor: stable per-vendor UUID stored by iOS.
        // Resets only if all apps from this vendor bundle group are removed.
        final info = await _deviceInfo.iosInfo;
        final id = info.identifierForVendor;
        return (id != null && id.isNotEmpty) ? id : null;
      }
    } catch (_) {
      // Silently fall through to UUID fallback — never crash the clocking flow.
    }
    return null;
  }
}
