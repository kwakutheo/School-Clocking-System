import 'package:flutter/services.dart';

class UptimeService {
  static const MethodChannel _channel = MethodChannel('tk_clocking_system/uptime');

  /// Returns the system uptime in milliseconds since the device booted.
  /// This value is monotonic and cannot be altered by changing the system clock.
  Future<int> getUptimeMs() async {
    try {
      final int? uptime = await _channel.invokeMethod('getUptime');
      return uptime ?? 0;
    } catch (e) {
      return 0;
    }
  }
}
