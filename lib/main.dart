import 'package:flutter/material.dart';
import 'package:tk_clocking_system/app.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart' as di;

import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/core/services/notification_service.dart';

import 'package:firebase_core/firebase_core.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  // Initialize dependency injection
  await di.init();

  // Initialize notification service
  final notificationService = di.sl<NotificationService>();
  await notificationService.init();

  // Initialize time service
  final timeService = di.sl<TimeService>();
  await timeService.syncTime();

  final storage = di.sl<StorageService>();
  final savedUrl = storage.getServerUrl();
  if (savedUrl != null && savedUrl.isNotEmpty) {
    AppConstants.baseUrl = savedUrl;
  }

  runApp(const App());
}
