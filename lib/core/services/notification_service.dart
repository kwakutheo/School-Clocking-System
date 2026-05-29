import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Notification IDs (reserved ranges)
// 100 : legacy clock-out reminder (kept for backward compat)
// 200 : shift starting soon — 2-hour warning
// 201 : shift starting soon — 30-minute warning
// 202 : shift started    — clock-in nudge (late banner)
// 203 : persistent late  — 2-hour escalation
// 204 : forgot clock-out — 1-hour post-shift-end
// ─────────────────────────────────────────────────────────────────────────────

/// Timezone name used throughout the app.
/// Ghana operates on GMT+0 (Africa/Accra) all year — no DST.
const _kGhanaTz = 'Africa/Accra';

/// Channel IDs / names
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

  Future<void> init() async {
    tz.initializeTimeZones();

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

  // ── Foreground FCM display ──────────────────────────────────────────────────

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

  /// Parses a "HH:mm" or "HH:mm:ss" string into a [tz.TZDateTime] for today
  /// in the Ghana timezone.  Returns null if the string is malformed.
  tz.TZDateTime? _todayAt(String rawTime, tz.TZDateTime trueNow) {
    try {
      final ghanaZone = tz.getLocation(_kGhanaTz);
      final parts = rawTime.split(':');
      if (parts.length < 2) return null;
      final hour = int.tryParse(parts[0]);
      final minute = int.tryParse(parts[1]);
      if (hour == null || minute == null) return null;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
      return tz.TZDateTime(ghanaZone, trueNow.year, trueNow.month, trueNow.day, hour, minute);
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

  /// Schedules (or re-schedules) all shift reminder notifications based on the
  /// current [data] fetched from the server / cache.
  ///
  /// This is safe to call on every home-data refresh:
  /// - Skips past times gracefully (no exception, no spurious notification).
  /// - Cancels irrelevant alerts automatically based on current work state.
  Future<void> scheduleShiftReminders(HomeDataEntity data) async {
    // Always start by cancelling any previously scheduled reminders so we
    // never have stale or duplicate notifications.
    await cancelShiftReminders();

    // Don't schedule on weekends, holidays, or vacation days.
    if (data.isWeekend || data.isHoliday || data.isVacation) {
      debugPrint('[NOTIF] Skipping shift reminders — not a working day.');
      return;
    }

    // Don't schedule if no shift is assigned.
    if (data.noShiftAssigned || data.shiftStartTime == null) {
      debugPrint('[NOTIF] Skipping shift reminders — no shift assigned.');
      return;
    }

    final ghanaZone = tz.getLocation(_kGhanaTz);
    
    // Calculate the difference between device OS time and the app's True Time.
    // The OS scheduler ONLY understands the local OS clock. If the user tampers
    // with their phone clock, we must translate our True Time target into OS Time.
    final trueTimeUtc = await sl<TimeService>().getGhanaTimeAsync();
    final trueNow = tz.TZDateTime.from(trueTimeUtc, ghanaZone);
    final osNow = tz.TZDateTime.now(ghanaZone);
    final osOffset = osNow.difference(trueNow);

    final shiftStart = _todayAt(data.shiftStartTime!, trueNow);
    if (shiftStart == null) {
      debugPrint('[NOTIF] Could not parse shiftStartTime: ${data.shiftStartTime}');
      return;
    }

    // ── 1. Shift Starting Soon — 2-hour warning (ID 200) ────────────────────
    // Only schedule if employee hasn't clocked in and shift hasn't started yet.
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
          body: 'Your shift starts in 30 minutes. Head to work now!',
          scheduledDate: thirtyMinWarning.add(osOffset),
        );
      }

      // ── 3. Shift Started — late clock-in nudge (ID 202) ───────────────────
      // Fires exactly at shift start (or as soon as possible if already past).
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
          body:
              'Your attendance is at risk. Please clock in immediately!',
          scheduledDate: persistentLateTime.add(osOffset),
        );
      }
    } else {
      debugPrint(
          '[NOTIF] Skipping pre-shift reminders (already clocked in today).');
    }

    // ── 5. Forgot to Clock Out — 10 minutes after shift end (ID 204) ────────
    // Only schedule if employee is currently clocked in (or was marked as forgot)
    // and we know when the shift ends.
    if (data.shiftEndTime != null &&
        (data.isClockedIn || data.forgotToClockOut)) {
      final shiftEnd = _todayAt(data.shiftEndTime!, trueNow);
      if (shiftEnd != null) {
        final clockOutReminder = shiftEnd.add(const Duration(minutes: 10));

        if (clockOutReminder.isAfter(trueNow)) {
          // 10-minute mark is still in the future — schedule it normally.
          await _schedule(
            id: 204,
            title: '❗ Did You Forget to Clock Out?',
            body: 'It looks like you never clocked out. Please do so immediately.',
            scheduledDate: clockOutReminder.add(osOffset),
          );
        } else {
          // 10-minute mark has already passed (forgotToClockOut == true or
          // app was opened late). Fire an immediate notification right now.
          debugPrint('[NOTIF] Forgot-clock-out window already elapsed — showing immediately.');
          await _notifications.show(
            204,
            '❗ Did You Forget to Clock Out?',
            'It looks like you never clocked out. Please do so immediately.',
            _reminderDetails,
          );
        }
      }
    }

    debugPrint('[NOTIF] scheduleShiftReminders complete.');
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
        // The OS-adjusted time is already in the past — fire immediately.
        debugPrint(
            '[NOTIF] #$id "$title" is in the past ($scheduledDate <= $osNow) — showing immediately.');
        await _notifications.show(id, title, body, _reminderDetails, payload: payload);
        return;
      }

      await _notifications.zonedSchedule(
        id,
        title,
        body,
        scheduledDate,
        _reminderDetails,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        payload: payload,
      );
      debugPrint('[NOTIF] Scheduled #$id "$title" at $scheduledDate (OS now: $osNow)');
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

  /// Cancels only the "forgot to clock out" notification (ID 204).
  /// Call this after a successful Clock Out action.
  Future<void> cancelClockOutReminder() async {
    await _notifications.cancel(204);
    debugPrint('[NOTIF] Cancelled clock-out reminder (ID 204).');
  }

  /// Cancels only the pre-shift and late reminders (IDs 200–203).
  /// Call this immediately after a successful Clock In so the employee
  /// is not nagged to clock in when they already have.
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
