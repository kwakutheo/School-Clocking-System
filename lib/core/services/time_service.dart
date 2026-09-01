import 'dart:async';
import 'package:ntp/ntp.dart';
import 'package:tk_clocking_system/core/services/connectivity_service.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/core/services/uptime_service.dart';

class TimeService {
  TimeService({
    required StorageService storage,
    required ConnectivityService connectivity,
    required UptimeService uptime,
  })  : _storage = storage,
        _connectivity = connectivity,
        _uptime = uptime;

  final StorageService _storage;
  final ConnectivityService _connectivity;
  final UptimeService _uptime;

  final _trueTimeController = StreamController<DateTime>.broadcast();
  Timer? _ticker;

  /// Ticks every second with the guaranteed tamper-proof time.
  Stream<DateTime> get trueTimeStream {
    _startTickerIfNeeded();
    return _trueTimeController.stream;
  }

  void _startTickerIfNeeded() {
    if (_ticker == null || !_ticker!.isActive) {
      getGhanaTimeAsync().then((now) => _trueTimeController.add(now));

      _ticker = Timer.periodic(const Duration(seconds: 1), (_) async {
        final now = await getGhanaTimeAsync();
        _trueTimeController.add(now);
      });
    }
  }

  Future<void> syncTime() async {
    try {
      final ntpTime = await NTP.now(timeout: const Duration(seconds: 10));
      final deviceTime = DateTime.now();

      final offsetMillis =
          ntpTime.millisecondsSinceEpoch - deviceTime.millisecondsSinceEpoch;

      await _storage.saveLastKnownTimeOffset(offsetMillis);
      await _storage.saveLastKnownTrueTime(ntpTime);

      final currentUptime = await _uptime.getUptimeMs();
      if (currentUptime > 0) {
        final validatedBootTime =
            ntpTime.millisecondsSinceEpoch - currentUptime;
        await _storage.saveValidatedBootTime(validatedBootTime);
        await _storage.saveLastSavedUptime(currentUptime);
      }
    } catch (_) {}
  }

  Future<DateTime> getSafeDateTime() async {
    final trueTime = await getGhanaTimeAsync();
    final deviceTime = DateTime.now().toUtc();
    final diffMins = deviceTime.difference(trueTime).inMinutes.abs();

    if (diffMins > 30) {}

    return trueTime;
  }

  /// Synchronously returns the current true network time in Ghana (UTC) as a fallback.
  DateTime get currentGhanaTime {
    final offsetMillis = _storage.getLastKnownTimeOffset() ?? 0;
    return DateTime.now().add(Duration(milliseconds: offsetMillis)).toUtc();
  }

  Future<DateTime> getGhanaTimeAsync() async {
    try {
      final currentUptime = await _uptime.getUptimeMs();
      final isOnline = _connectivity.isOnline;

      // 1. Try NTP online to anchor our monotonic clock
      if (isOnline) {
        try {
          final ntpTime = await NTP.now(timeout: const Duration(seconds: 3));
          if (currentUptime > 0) {
            // Anchor the monotonic clock securely
            await _storage.saveValidatedBootTime(
                ntpTime.millisecondsSinceEpoch - currentUptime);
            await _storage.saveLastSavedUptime(currentUptime);
            await _storage.saveLastKnownTrueTime(ntpTime);
          }
          return ntpTime.toUtc();
        } catch (_) {
          // Ignore network errors and fall back to monotonic offline checks
        }
      }

      // --- OFFLINE from here ---

      final validatedBootTime = _storage.getValidatedBootTime();
      final lastSavedUptime = _storage.getLastSavedUptime();

      // 2. Same boot session: uptime has only gone up
      //    Formula: trueNow = (ntpTime_at_sync - uptime_at_sync) + currentUptime
      if (validatedBootTime != null &&
          lastSavedUptime != null &&
          currentUptime > 0) {
        if (currentUptime >= lastSavedUptime) {
          final trueTime = DateTime.fromMillisecondsSinceEpoch(
                  validatedBootTime + currentUptime)
              .toUtc();
          // Keep the saved uptime current so future ticks use the latest reference
          await _storage.saveLastSavedUptime(currentUptime);
          await _storage.saveLastKnownTrueTime(trueTime);
          return trueTime;
        }
      }

      // 3. POST-REBOOT OFFLINE: currentUptime < lastSavedUptime means the device rebooted.
      //    We no longer have a continuous uptime anchor to the original boot.
      if (lastSavedUptime != null && currentUptime < lastSavedUptime) {
        final lastKnownTrueTime = _storage.getLastKnownTrueTime();
        if (lastKnownTrueTime != null) {
          // We know the phone rebooted after lastKnownTrueTime.
          // The best we can do is: lastKnownTrueTime + currentUptime (time since this boot).
          final estimatedTime =
              lastKnownTrueTime.add(Duration(milliseconds: currentUptime));
          return estimatedTime.toUtc();
        }
      }
    } catch (_) {
      // Ignore and fall through
    }

    // 4. Last resort: vulnerable to clock changes, but this path is rarely reached
    return currentGhanaTime;
  }
}
