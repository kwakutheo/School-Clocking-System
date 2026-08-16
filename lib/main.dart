
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';

import 'package:tk_clocking_system/app.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart' as di;
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/core/services/notification_service.dart';

void main() async {
  // ── Global error handlers ──────────────────────────────────────────────────
  // Catch Flutter framework errors (widget build failures, layout overflows,
  // rendering exceptions) so they never silently crash the app in production.
  FlutterError.onError = (FlutterErrorDetails details) {
    if (kDebugMode) {
      FlutterError.presentError(details); // show red screen in debug
    } else {
      debugPrint('[FlutterError] ${details.exceptionAsString()}');
    }
  };

  // Catch all uncaught async / Platform-channel errors outside the widget tree.
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[PlatformError] Uncaught error: $error\n$stack');
    return true; // "handled" — prevents OS-level crash dialog
  };

  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  // Initialize dependency injection
  await di.init();

  // Initialize notification service FIRST so channels are created
  final notificationService = di.sl<NotificationService>();
  await notificationService.init();

  // Initialize time service — runs in background so it never blocks app launch.
  // The time service has a safe fallback (cached offset) if NTP is slow or offline.
  final timeService = di.sl<TimeService>();
  timeService.syncTime().ignore();
  notificationService.scheduleCachedShiftReminders().ignore();

  final storage = di.sl<StorageService>();
  final savedUrl = storage.getServerUrl();
  if (savedUrl != null && savedUrl.isNotEmpty) {
    AppConstants.baseUrl = savedUrl;
  }

  runApp(const App());
}
