import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';

const _kGhanaTz = 'Africa/Accra';
const _kReminderChannelId = 'shift_reminders';
const _kReminderChannelName = 'Shift Reminders';
const _kReminderChannelDesc =
    'Reminders to clock in and clock out at the right times';

const _kHighChannelId = 'high_importance_channel';
const _kHighChannelName = 'High Importance Notifications';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM-BG] Handling background message: ${message.messageId}');
}

class NotificationService {
  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();

  // Stream to broadcast silent data events to the app (e.g., to refresh UI)
  final _syncEventController =
      StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onSyncEvent => _syncEventController.stream;

  // ── Initialisation ──────────────────────────────────────────────────────────

  Future<void> initForBackgroundIsolate() async {
    tz.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation(_kGhanaTz));

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);
    await _notifications.initialize(initSettings);
    debugPrint('[NOTIF] Background isolate notification service initialized.');
  }

  Future<void> init() async {
    tz.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation(_kGhanaTz));

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings =
        InitializationSettings(android: androidInit, iOS: iosInit);

    await _notifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        debugPrint('[NOTIF] Tapped: ${details.payload}');
      },
    );

    if (Platform.isAndroid) {
      // Create required channels manually so background service can use them
      final androidImplementation =
          _notifications.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidImplementation != null) {
        // High importance channel
        await androidImplementation.createNotificationChannel(
          const AndroidNotificationChannel(
            _kHighChannelId,
            _kHighChannelName,
            description: 'This channel is used for important notifications.',
            importance: Importance.max,
          ),
        );
        // Reminder channel
        await androidImplementation.createNotificationChannel(
          const AndroidNotificationChannel(
            _kReminderChannelId,
            _kReminderChannelName,
            description: _kReminderChannelDesc,
            importance: Importance.high,
          ),
        );
      }

      // Request POST_NOTIFICATIONS (Android 13+)
      final notifStatus = await Permission.notification.status;
      if (!notifStatus.isGranted) {
        await Permission.notification.request();
      }

      final exactStatus = await Permission.scheduleExactAlarm.status;
      if (!exactStatus.isGranted) {
        await Permission.scheduleExactAlarm.request();
      }
    }

    // Firebase Messaging setup
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Handle foreground FCM messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[FCM] Message received in foreground');
      debugPrint('[FCM] Data: ${message.data}');

      if (message.data.containsKey('action')) {
        _syncEventController.add(message.data);
      }

      if (message.notification != null) {
        _showForegroundNotification(message);
      }
    });
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final android = message.notification?.android;

    if (notification != null && android != null) {
      await _notifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _kHighChannelId,
            _kHighChannelName,
            channelDescription:
                'This channel is used for important notifications.',
            icon: '@mipmap/ic_launcher',
            importance: Importance.max,
            priority: Priority.high,
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
      );
    }
  }

  // ── FCM token ──────────────────────────────────────────────────────────────

  Future<String?> getFcmToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      debugPrint('[NOTIF] Failed to get FCM token: $e');
      return null;
    }
  }

  // ── Shift reminder scheduling ───────────────────────────────────────────────

  /// Parses a "HH:mm", "HH:mm:ss", "hh:mm AM", etc. string into a [tz.TZDateTime]
  /// for today in the Ghana timezone. Returns null if the string is malformed.
  tz.TZDateTime? _todayAt(String rawTime, tz.TZDateTime trueNow) {
    try {
      final ghanaZone = tz.getLocation(_kGhanaTz);
      final normalizedTime = rawTime.trim().toLowerCase();
      final isPm = normalizedTime.contains('pm');
      final isAm = normalizedTime.contains('am');

      final timePart = normalizedTime.replaceAll(RegExp(r'[a-z\s]'), '');
      final parts = timePart.split(':');
      if (parts.length < 2) return null;

      int? hour = int.tryParse(parts[0]);
      final int? minute = int.tryParse(parts[1]);

      if (hour == null || minute == null) return null;

      if (isPm && hour < 12) hour += 12;
      if (isAm && hour == 12) hour = 0;

      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

      return tz.TZDateTime(
          ghanaZone, trueNow.year, trueNow.month, trueNow.day, hour, minute);
    } catch (e) {
      debugPrint('[NOTIF] _todayAt parse error: $e');
      return null;
    }
  }

  /// Shared notification details for shift reminders.
  NotificationDetails get _reminderDetails => const NotificationDetails(
        android: AndroidNotificationDetails(
          _kReminderChannelId,
          _kReminderChannelName,
          channelDescription: _kReminderChannelDesc,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          // Keep notification visible on lock screen
          visibility: NotificationVisibility.public,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      );

  Future<void> scheduleShiftReminders(HomeDataEntity data) async {
    try {
      // Always start by cancelling any previously scheduled reminders so we
      // never have stale or duplicate notifications.
      await cancelShiftReminders();

      // Don't schedule on weekends, holidays, or vacation days.
      if (data.isWeekend || data.isHoliday || data.isVacation) return;

      // Don't schedule if no shift is assigned.
      if (data.noShiftAssigned || data.shiftStartTime == null) return;

      final ghanaZone = tz.getLocation(_kGhanaTz);

      // Calculate the difference between device OS time and the app's True Time.
      final trueTimeUtc = await sl<TimeService>().getGhanaTimeAsync();
      final trueNow = tz.TZDateTime.from(trueTimeUtc, ghanaZone);
      final osNow = tz.TZDateTime.now(ghanaZone);
      final osOffset = osNow.difference(trueNow);

      final shiftStart = _todayAt(data.shiftStartTime!, trueNow);
      if (shiftStart == null) return;
      // ── 1. Shift Starting Soon — 2-hour warning (ID 200) ────────────────────
      if (!data.hasClockedInToday && !data.forgotToClockOut) {
        final twoHourWarning = shiftStart.subtract(const Duration(hours: 2));
        if (twoHourWarning.isAfter(trueNow)) {
          await _schedule(
            id: 200,
            title: '⏰ Shift Starting Soon',
            body: 'Your shift starts in 2 hours. Prepare to head to work!',
            scheduledDate: twoHourWarning.add(osOffset),
          );
        }

        // ── 2. Shift Starting Soon — 30-minute warning (ID 201) ───────────────
        final thirtyMinWarning = shiftStart.subtract(const Duration(minutes: 30));
        if (thirtyMinWarning.isAfter(trueNow)) {
          await _schedule(
            id: 201,
            title: '⏰ Shift Starting Soon',
            body: 'Your shift starts in 30 minutes. Make sure you clock in.',
            scheduledDate: thirtyMinWarning.add(osOffset),
          );
        }

        // ── 3. Shift Started — late clock-in nudge (ID 202) ───────────────────
        if (shiftStart.isAfter(trueNow)) {
          await _schedule(
            id: 202,
            title: '🔔 Your Shift Has Started',
            body: 'Please clock in as soon as possible.',
            scheduledDate: shiftStart.add(osOffset),
          );
        }

        // ── 4. Persistent Late — 2-hour escalation (ID 203) ───────────────────
        final persistentLateTime = shiftStart.add(const Duration(hours: 2));
        if (persistentLateTime.isAfter(trueNow)) {
          await _schedule(
            id: 203,
            title: '🚨 Still Not Clocked In',
            body: 'Your attendance is at risk. Please clock in immediately!',
            scheduledDate: persistentLateTime.add(osOffset),
          );
        }
      }

      // ── 5. Forgot to Clock Out — 10 minutes after shift end (ID 204) ────────
      if (data.shiftEndTime != null &&
          (data.isClockedIn || data.forgotToClockOut)) {
        final shiftEnd = _todayAt(data.shiftEndTime!, trueNow);
        if (shiftEnd != null) {
          final clockOutReminder = shiftEnd.add(const Duration(minutes: 5));

          if (clockOutReminder.isAfter(trueNow)) {
            await _schedule(
              id: 204,
              title: '⏰ Clock Out Reminder',
              body: 'Your shift has ended. Make sure you clock out.',
              scheduledDate: clockOutReminder.add(osOffset),
            );
          } else {
            await _notifications.show(
              204,
              '❗ Did You Forget to Clock Out?',
              'It looks like you never clocked out. Please do so immediately.',
              _reminderDetails,
            );
          }
        }
      }
    } catch (e) {
      // Silently catch exceptions to prevent crashing the app.
    }
  }

  /// Schedules a single notification. Swallows errors so a scheduling
  /// failure never crashes the app.
  ///
  /// IMPORTANT: If [scheduledDate] is already in the past from the OS
  /// clock's perspective, `zonedSchedule` silently drops it without firing.
  /// We guard against this by immediately showing the notification instead.
  Future<void> _schedule({
    required int id,
    required String title,
    required String body,
    required tz.TZDateTime scheduledDate,
    String? payload,
  }) async {
    try {
      final osNow = tz.TZDateTime.now(scheduledDate.location);

      if (!scheduledDate.isAfter(osNow)) {
        debugPrint(
            '[NOTIF] #$id "$title" is in the past ($scheduledDate <= $osNow) — showing immediately.');
        await _notifications.show(id, title, body, _reminderDetails,
            payload: payload);
        return;
      }

      AndroidScheduleMode scheduleMode =
          AndroidScheduleMode.inexactAllowWhileIdle;
      if (Platform.isAndroid) {
        final androidPlugin =
            _notifications.resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin>();
        final canExact =
            await androidPlugin?.canScheduleExactNotifications() ?? false;
        if (canExact) {
          scheduleMode = AndroidScheduleMode.exactAllowWhileIdle;
          debugPrint('[NOTIF] Using exact alarm scheduling for #$id.');
        } else {
          debugPrint(
              '[NOTIF] Exact alarm not permitted — using inexact fallback for #$id.');
        }
      }

      await _notifications.zonedSchedule(
        id,
        title,
        body,
        scheduledDate,
        _reminderDetails,
        androidScheduleMode: scheduleMode,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        payload: payload,
      );
      debugPrint(
          '[NOTIF] Scheduled #$id "$title" at $scheduledDate (OS now: $osNow)');
    } catch (e) {
      debugPrint('[NOTIF] Failed to schedule #$id: $e');
    }
  }

  // ── Cancellation helpers ────────────────────────────────────────────────────

  /// Cancels ALL shift reminder notifications (200–204).
  /// Call this whenever a clock-in or clock-out happens so stale alerts
  /// are never shown to the user.
  Future<void> cancelShiftReminders() async {
    for (final id in [200, 201, 202, 203, 204]) {
      await _notifications.cancel(id);
    }
    debugPrint('[NOTIF] Cancelled all shift reminders (IDs 200-204).');
  }

  Future<void> cancelClockOutReminder() async {
    await _notifications.cancel(204);
    debugPrint('[NOTIF] Cancelled clock-out reminder (ID 204).');
  }

  Future<void> cancelPreShiftReminders() async {
    for (final id in [200, 201, 202, 203]) {
      await _notifications.cancel(id);
    }
    debugPrint('[NOTIF] Cancelled pre-shift reminders (IDs 200-203).');
  }

  // ── Legacy method (kept for backward compat) ────────────────────────────────

  /// @deprecated  Use [scheduleShiftReminders] instead.
  Future<void> scheduleClockOutReminder({
    int hour = 17,
    int minute = 30,
  }) async {
    try {
      final ghanaZone = tz.getLocation(_kGhanaTz);
      final now = tz.TZDateTime.now(ghanaZone);
      final scheduledDate =
          tz.TZDateTime(ghanaZone, now.year, now.month, now.day, hour, minute);

      if (scheduledDate.isBefore(now)) return;

      await _schedule(
        id: 101,
        title: 'Clock Out Reminder',
        body: "Hey! It's past your shift end. Did you forget to clock out?",
        scheduledDate: scheduledDate,
      );
    } catch (e) {
      debugPrint('[NOTIF] Error scheduling legacy clock-out reminder: $e');
    }
  }

  void dispose() {
    _syncEventController.close();
  }
}
