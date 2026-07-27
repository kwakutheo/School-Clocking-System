import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart' as di;
import 'package:tk_clocking_system/core/services/connectivity_service.dart';
import 'package:tk_clocking_system/core/services/notification_service.dart';
import 'package:tk_clocking_system/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:tk_clocking_system/features/attendance/domain/usecases/sync_pending_attendance_usecase.dart';

Future<void> initBackgroundService() async {
  final service = FlutterBackgroundService();

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onBackgroundTaskStart,
      autoStart: true,
      isForegroundMode: true,
      autoStartOnBoot: true,
      notificationChannelId: 'high_importance_channel',
      initialNotificationTitle: 'TK Clocking System',
      initialNotificationContent: 'Background service active',
      foregroundServiceNotificationId: 888,
    ),
    iosConfiguration: IosConfiguration(
      autoStart: true,
      onForeground: onBackgroundTaskStart,
      onBackground: onIosBackgroundEvent,
    ),
  );
}

@pragma('vm:entry-point')
void onBackgroundTaskStart(ServiceInstance service) async {
  // Must initialize bindings first in every background isolate.
  DartPluginRegistrant.ensureInitialized();
  WidgetsFlutterBinding.ensureInitialized();

  // Re-initialize Firebase in this separate isolate.
  await Firebase.initializeApp();

  // Guard: only initialize DI if not already done in this isolate.
  if (!di.sl.isRegistered<ConnectivityService>()) {
    await di.init();
  }

  // Get the notification service instance (already registered by di.init()).
  final notificationService = di.sl<NotificationService>();
  await notificationService.initForBackgroundIsolate();

  final connectivity = di.sl<ConnectivityService>();
  final syncUsecase = di.sl<SyncPendingAttendanceUseCase>();
  final attendanceRepo = di.sl<AttendanceRepository>();

  // Run background tasks every 10 minutes.
  Timer.periodic(const Duration(minutes: 10), (timer) async {
    try {
      debugPrint('[BackgroundService] Waking up for periodic task...');

      if (service is AndroidServiceInstance) {
        if (await service.isForegroundService()) {
          service.setForegroundNotificationInfo(
            title: 'TK Clocking System',
            content: 'Syncing records...',
          );
        }
      }

      if (connectivity.isOnline) {
        debugPrint('[BackgroundService] Online. Running background tasks.');

        // Task 1: Sync any pending offline attendance records to the server.
        final syncResult = await syncUsecase();
        syncResult.fold(
          (failure) => debugPrint(
              '[BackgroundService] Sync failed: ${failure.toString()}'),
          (count) => debugPrint(
              '[BackgroundService] Synced $count record(s) successfully.'),
        );

        final homeDataResult = await attendanceRepo.getHomeData();
        homeDataResult.fold(
          (failure) => debugPrint(
              '[BackgroundService] Failed to fetch home data for reminders: ${failure.toString()}'),
          (homeData) async {
            debugPrint(
                '[BackgroundService] Fetched shift data. Re-scheduling shift reminders.');
            await notificationService.scheduleShiftReminders(homeData);
          },
        );
      } else {
        debugPrint(
            '[BackgroundService] Offline. Skipping sync, will retry next tick.');
      }

      if (service is AndroidServiceInstance) {
        if (await service.isForegroundService()) {
          service.setForegroundNotificationInfo(
            title: 'TK Clocking System',
            content: 'Background service active',
          );
        }
      }
    } catch (e) {
      debugPrint('[BackgroundService] Error during periodic task: $e');
    }
  });
}

@pragma('vm:entry-point')
bool onIosBackgroundEvent(ServiceInstance service) {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  debugPrint('[BackgroundService] iOS background fetch triggered.');
  return true;
}
