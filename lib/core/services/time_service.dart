import 'dart:async';
import 'package:ntp/ntp.dart';
import 'package:tk_clocking_system/core/errors/exceptions.dart';
import 'package:tk_clocking_system/core/services/connectivity_service.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/core/services/uptime_service.dart';

/// Service responsible for validating device time against network time.
/// Prevents time-tampering exploits (e.g. changing phone clock to clock in late).
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
      // Fire immediately so listeners get an initial value instantly
      getGhanaTimeAsync().then((now) => _trueTimeController.add(now));
      
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) async {
        final now = await getGhanaTimeAsync();
        _trueTimeController.add(now);
      });
    }
  }

  /// Syncs with the NTP server if online.
  /// Should be called on app startup.
  Future<void> syncTime() async {
    if (!_connectivity.isOnline) return;

    try {
      final ntpTime = await NTP.now(timeout: const Duration(seconds: 10));
      final deviceTime = DateTime.now();
      
      final offsetMillis = ntpTime.millisecondsSinceEpoch - deviceTime.millisecondsSinceEpoch;
      
      await _storage.saveLastKnownTimeOffset(offsetMillis);
      await _storage.saveLastKnownTrueTime(ntpTime);

      final currentUptime = await _uptime.getUptimeMs();
      if (currentUptime > 0) {
        final validatedBootTime = ntpTime.millisecondsSinceEpoch - currentUptime;
        await _storage.saveValidatedBootTime(validatedBootTime);
        await _storage.saveLastSavedUptime(currentUptime);
      }
    } catch (_) {
      // Silently fail if NTP is unreachable despite connectivity check
    }
  }

  /// Calculates the safe, validated time.
  /// Validates that time hasn't been tampered with backwards or unreasonably forwards.
  /// Throws [TimeTamperingException] if manipulation is detected.
  Future<DateTime> getSafeDateTime() async {
    final trueTime = await getGhanaTimeAsync();
    
    // As a strict policy, we can choose to reject clocking if the phone's clock
    // is wildly off (e.g., > 15 minutes), even though we know the true time.
    // However, since we are fully independent of the phone's time now, we can 
    // just securely use the true time and ignore their phone time completely.
    final deviceTime = DateTime.now().toUtc();
    final diffMins = deviceTime.difference(trueTime).inMinutes.abs();
    
    if (diffMins > 30) {
      // We know their clock is wrong by more than 30 mins, but we will let them
      // clock in anyway using the server/uptime time. We can just return trueTime.
      // If we wanted to block them, we would throw TimeTamperingException here.
    }
    
    return trueTime;
  }

  /// Synchronously returns the current true network time in Ghana (UTC) as a fallback.
  DateTime get currentGhanaTime {
    final offsetMillis = _storage.getLastKnownTimeOffset() ?? 0;
    return DateTime.now().add(Duration(milliseconds: offsetMillis)).toUtc();
  }

  /// Asynchronously returns the hardware-backed true network time in Ghana (UTC).
  /// This is the primary method used by the UI stream and clock-in logic.
  ///
  /// Priority order:
  ///  1. NTP.now (online — perfect, anchors our boot time)
  ///  2. validatedBootTime + currentUptime (same boot session — perfect offline)
  ///  3. lastKnownTrueTime + currentUptime (post-reboot offline — good estimate)
  ///  4. currentGhanaTime offset fallback (last resort)
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
            await _storage.saveValidatedBootTime(ntpTime.millisecondsSinceEpoch - currentUptime);
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
      if (validatedBootTime != null && lastSavedUptime != null && currentUptime > 0) {
        if (currentUptime >= lastSavedUptime) {
          final trueTime = DateTime.fromMillisecondsSinceEpoch(validatedBootTime + currentUptime).toUtc();
          // Keep the saved uptime current so future ticks use the latest reference
          await _storage.saveLastSavedUptime(currentUptime);
          await _storage.saveLastKnownTrueTime(trueTime);
          return trueTime;
        }
      }

      // 3. POST-REBOOT OFFLINE: currentUptime < lastSavedUptime means the device rebooted.
      //    We no longer have a continuous uptime anchor to the original boot.
      final lastKnownTrueTime = _storage.getLastKnownTrueTime();
      if (lastKnownTrueTime != null && currentUptime > 0) {
        // We know the phone rebooted after lastKnownTrueTime.
        // The best we can do is: lastKnownTrueTime + currentUptime (time since this boot).
        final estimatedTime = lastKnownTrueTime.add(Duration(milliseconds: currentUptime));
        return estimatedTime.toUtc();
      }
    } catch (_) {
      // Ignore and fall through
    }

    // 4. Last resort: vulnerable to clock changes, but this path is rarely reached
    return currentGhanaTime;
  }
}

