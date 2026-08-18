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
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (FlutterErrorDetails details) {
    if (kDebugMode) {
      FlutterError.presentError(details);
    } else {
      debugPrint('[FlutterError] ${details.exceptionAsString()}');
    }
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[PlatformError] Uncaught error: $error\n$stack');
    return true;
  };

  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint('[Startup] Firebase init failed: $e');
  }

  try {
    await di.init();
  } catch (e) {
    debugPrint('[Startup] DI init failed: $e');
    runApp(const App());
    return;
  }

  try {
    final notificationService = di.sl<NotificationService>();
    await notificationService.init();
    notificationService.scheduleCachedShiftReminders().ignore();
  } catch (e) {
    debugPrint('[Startup] Notification service init failed: $e');
  }

  try {
    final timeService = di.sl<TimeService>();
    timeService.syncTime().ignore();
  } catch (e) {
    debugPrint('[Startup] Time service sync failed: $e');
  }

  try {
    final storage = di.sl<StorageService>();
    final savedUrl = storage.getServerUrl();
    if (savedUrl != null && savedUrl.isNotEmpty) {
      AppConstants.baseUrl = savedUrl;
    }
  } catch (e) {
    debugPrint('[Startup] Storage read failed: $e');
  }

  runApp(const App());
}
