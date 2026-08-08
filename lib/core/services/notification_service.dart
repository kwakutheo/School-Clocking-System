import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/core/utils/offline_state_engine.dart';
import 'package:tk_clocking_system/features/dashboard/data/models/home_data_model.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';

const _kGhanaTz = 'Africa/Accra';
const _kReminderChannelId = 'shift_reminders';
const _kReminderChannelName = 'Shift Reminders';
const _kReminderChannelDesc =
    'Reminders to clock in and clock out at the right times';

const _kHighChannelId = 'high_importance_channel';
const _kHighChannelName = 'High Importance Notifications';

const _kScheduleDaysAhead = 14;
const _kCancelLookBackDays = 2;
const _kLegacyClockOutReminderId = 101;
const _kReminderIdSeed = 200000000;

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM-BG] Handling background message: ${message.messageId}');
}

class _ReminderJob {
  const _ReminderJob({
    required this.id,
    required this.title,
    required this.body,
    required this.scheduledDate,
  });

  final int id;
  final String title;
  final String body;
  final tz.TZDateTime scheduledDate;
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
    await _createAndroidChannels();
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

    await _createAndroidChannels();
    await ensureReminderPermissions();

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

  Future<void> _createAndroidChannels() async {
    if (!Platform.isAndroid) return;

    final androidImplementation =
        _notifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    if (androidImplementation == null) return;

    await androidImplementation.createNotificationChannel(
      const AndroidNotificationChannel(
        _kHighChannelId,
        _kHighChannelName,
        description: 'This channel is used for important notifications.',
        importance: Importance.max,
      ),
    );

    await androidImplementation.createNotificationChannel(
      const AndroidNotificationChannel(
        _kReminderChannelId,
        _kReminderChannelName,
        description: _kReminderChannelDesc,
        importance: Importance.high,
      ),
    );
  }

  Future<bool> ensureReminderPermissions() async {
    if (!Platform.isAndroid) {
      final ios = _notifications.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      final macos = _notifications.resolvePlatformSpecificImplementation<
          MacOSFlutterLocalNotificationsPlugin>();
      final iosGranted = await ios?.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          ) ??
          true;
      final macosGranted = await macos?.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          ) ??
          true;
      return iosGranted && macosGranted;
    }

    final androidImplementation =
        _notifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    final pluginGranted =
        await androidImplementation?.requestNotificationsPermission();
    if (pluginGranted == false) {
      debugPrint('[NOTIF] Notification permission denied by user.');
      return false;
    }

    final notifStatus = await Permission.notification.status;
    if (!notifStatus.isGranted) {
      final requested = await Permission.notification.request();
      if (!requested.isGranted) {
        debugPrint('[NOTIF] Android notification permission is not granted.');
        return false;
      }
    }

    final canExact =
        await androidImplementation?.canScheduleExactNotifications() ?? false;
    if (!canExact) {
      await androidImplementation?.requestExactAlarmsPermission();
    }

    return true;
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
  /// for the date represented by [baseDate]. Returns null if malformed.
  tz.TZDateTime? _atDate(String rawTime, tz.TZDateTime baseDate) {
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
          ghanaZone, baseDate.year, baseDate.month, baseDate.day, hour, minute);
    } catch (e) {
      debugPrint('[NOTIF] _atDate parse error: $e');
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
      final canNotify = await ensureReminderPermissions();
      if (!canNotify) return;

      final ghanaZone = tz.getLocation(_kGhanaTz);

      // Calculate the difference between device OS time and the app's True Time.
      final trueTimeUtc = await sl<TimeService>().getGhanaTimeAsync();
      final trueNow = tz.TZDateTime.from(trueTimeUtc, ghanaZone);
      final osNow = tz.TZDateTime.now(ghanaZone);
      final osOffset = osNow.difference(trueNow);

      final jobs = _buildReminderJobs(data, trueNow, osOffset);

      await cancelShiftReminders(referenceTime: trueNow);

      for (final job in jobs) {
        await _schedule(
          id: job.id,
          title: job.title,
          body: job.body,
          scheduledDate: job.scheduledDate,
        );
      }
      debugPrint('[NOTIF] Scheduled ${jobs.length} shift reminder(s).');
    } catch (e) {
      debugPrint('[NOTIF] Failed to schedule shift reminders: $e');
    }
  }

  Future<void> scheduleCachedShiftReminders() async {
    try {
      if (!Hive.isBoxOpen(AppConstants.userBox)) return;

      final box = Hive.box<Map>(AppConstants.userBox);
      final cached = box.get('home_data_cache');
      if (cached == null) return;

      final cachedData =
          HomeDataModel.fromJson(Map<String, dynamic>.from(cached));
      final trueNow = await sl<TimeService>().getGhanaTimeAsync();
      final effectiveData =
          OfflineStateEngine.recomputeForOfflineDay(cachedData, trueNow);

      await scheduleShiftReminders(effectiveData);
    } catch (e) {
      debugPrint('[NOTIF] Failed to schedule cached reminders: $e');
    }
  }

  List<_ReminderJob> _buildReminderJobs(
    HomeDataEntity data,
    tz.TZDateTime trueNow,
    Duration osOffset,
  ) {
    final jobs = <_ReminderJob>[];
    final ghanaZone = tz.getLocation(_kGhanaTz);
    final today =
        tz.TZDateTime(ghanaZone, trueNow.year, trueNow.month, trueNow.day);

    for (var dayOffset = 0; dayOffset <= _kScheduleDaysAhead; dayOffset++) {
      final date = today.add(Duration(days: dayOffset));
      final isToday = dayOffset == 0;

      if (!_isReminderWorkingDay(data, date, isToday)) continue;

      final shiftStartRaw = _shiftStartForDate(data, date, isToday);
      if (shiftStartRaw == null) continue;

      final shiftStart = _atDate(shiftStartRaw, date);
      if (shiftStart == null) continue;

      final shouldScheduleClockInReminders =
          isToday ? !data.hasClockedInToday && !data.forgotToClockOut : true;

      if (shouldScheduleClockInReminders) {
        jobs.addAll([
          _clockInJob(
            date,
            slot: 0,
            title: '⏰ Shift Starting Soon',
            body: 'Your shift starts in 2 hours. Prepare to head to work!',
            scheduledDate:
                shiftStart.subtract(const Duration(hours: 2)).add(osOffset),
          ),
          _clockInJob(
            date,
            slot: 1,
            title: '⏰ Shift Starting Soon',
            body: 'Your shift starts in 30 minutes. Make sure you clock in.',
            scheduledDate:
                shiftStart.subtract(const Duration(minutes: 30)).add(osOffset),
          ),
          _clockInJob(
            date,
            slot: 2,
            title: '🔔 Your Shift Has Started',
            body: 'Please clock in as soon as possible.',
            scheduledDate: shiftStart.add(osOffset),
          ),
          _clockInJob(
            date,
            slot: 3,
            title: '🚨 Still Not Clocked In',
            body: 'Your attendance is at risk. Please clock in immediately!',
            scheduledDate:
                shiftStart.add(const Duration(hours: 2)).add(osOffset),
          ),
        ].where(
            (job) => job.scheduledDate.isAfter(tz.TZDateTime.now(ghanaZone))));
      }

      if (!isToday) continue;
      if (data.shiftEndTime == null ||
          (!data.isClockedIn && !data.forgotToClockOut)) {
        continue;
      }

      final shiftEnd = _atDate(data.shiftEndTime!, date);
      if (shiftEnd == null) continue;

      final clockOutReminder =
          shiftEnd.add(const Duration(minutes: 5)).add(osOffset);
      jobs.add(
        _ReminderJob(
          id: _reminderId(date, 4),
          title: clockOutReminder.isAfter(tz.TZDateTime.now(ghanaZone))
              ? '⏰ Clock Out Reminder'
              : '❗ Did You Forget to Clock Out?',
          body: clockOutReminder.isAfter(tz.TZDateTime.now(ghanaZone))
              ? 'Your shift has ended. Make sure you clock out.'
              : 'It looks like you never clocked out. Please do so immediately.',
          scheduledDate: clockOutReminder,
        ),
      );
    }

    return jobs;
  }

  _ReminderJob _clockInJob(
    tz.TZDateTime date, {
    required int slot,
    required String title,
    required String body,
    required tz.TZDateTime scheduledDate,
  }) =>
      _ReminderJob(
        id: _reminderId(date, slot),
        title: title,
        body: body,
        scheduledDate: scheduledDate,
      );

  bool _isReminderWorkingDay(
    HomeDataEntity data,
    tz.TZDateTime date,
    bool isToday,
  ) {
    if (isToday) {
      return !data.isWeekend &&
          !data.isHoliday &&
          !data.isVacation &&
          (!data.noShiftAssigned || _hasNextShiftOnDate(data, date));
    }

    return !_isWeekend(date) &&
        !_isHolidayOn(date) &&
        (!data.noShiftAssigned || _hasNextShiftOnDate(data, date));
  }

  String? _shiftStartForDate(
    HomeDataEntity data,
    tz.TZDateTime date,
    bool isToday,
  ) {
    if (_hasNextShiftOnDate(data, date)) {
      return data.nextShiftStartTime ?? data.shiftStartTime;
    }

    if (data.noShiftAssigned) return null;
    return data.shiftStartTime;
  }

  bool _hasNextShiftOnDate(HomeDataEntity data, tz.TZDateTime date) {
    final nextShiftDate = data.nextShiftDate;
    if (nextShiftDate == null) return false;

    final next = tz.TZDateTime.from(nextShiftDate.toUtc(), date.location);
    return next.year == date.year &&
        next.month == date.month &&
        next.day == date.day;
  }

  bool _isWeekend(tz.TZDateTime date) =>
      date.weekday == DateTime.saturday || date.weekday == DateTime.sunday;

  bool _isHolidayOn(tz.TZDateTime date) {
    try {
      if (!Hive.isBoxOpen(AppConstants.userBox)) return false;

      final box = Hive.box<Map>(AppConstants.userBox);
      final cachedData = box.get(AppConstants.holidaysCacheKey);
      final rawHolidays = cachedData?['data'] as List<dynamic>?;
      if (rawHolidays == null) return false;

      final dateStr =
          '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      final recurringDateStr =
          '${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

      for (final raw in rawHolidays) {
        final holiday = Map<String, dynamic>.from(raw as Map);
        final holidayDate = holiday['date']?.toString();
        final isRecurring = holiday['isRecurring'] == true;

        if (holidayDate == dateStr ||
            (isRecurring && holidayDate == recurringDateStr)) {
          return true;
        }
      }
    } catch (e) {
      debugPrint('[NOTIF] Failed to inspect holiday cache: $e');
    }
    return false;
  }

  int _reminderId(tz.TZDateTime date, int slot) {
    final yy = date.year % 100;
    final dateKey = yy * 10000 + date.month * 100 + date.day;
    return _kReminderIdSeed + dateKey * 10 + slot;
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
  Future<void> cancelShiftReminders({tz.TZDateTime? referenceTime}) async {
    final ghanaZone = tz.getLocation(_kGhanaTz);
    final ref = referenceTime ?? tz.TZDateTime.now(ghanaZone);
    final start =
        tz.TZDateTime(ghanaZone, ref.year, ref.month, ref.day).subtract(
      const Duration(days: _kCancelLookBackDays),
    );

    for (var dayOffset = 0;
        dayOffset <= _kScheduleDaysAhead + _kCancelLookBackDays;
        dayOffset++) {
      final date = start.add(Duration(days: dayOffset));
      for (var slot = 0; slot <= 4; slot++) {
        await _notifications.cancel(_reminderId(date, slot));
      }
    }

    for (final id in [
      _kLegacyClockOutReminderId,
      200,
      201,
      202,
      203,
      204,
    ]) {
      await _notifications.cancel(id);
    }
    debugPrint('[NOTIF] Cancelled shift reminder window.');
  }

  Future<void> cancelClockOutReminder() async {
    final ghanaZone = tz.getLocation(_kGhanaTz);
    final now = tz.TZDateTime.now(ghanaZone);
    final today = tz.TZDateTime(ghanaZone, now.year, now.month, now.day);
    await _notifications.cancel(_reminderId(today, 4));
    await _notifications.cancel(204);
    await _notifications.cancel(_kLegacyClockOutReminderId);
    debugPrint('[NOTIF] Cancelled clock-out reminders.');
  }

  Future<void> cancelPreShiftReminders() async {
    final ghanaZone = tz.getLocation(_kGhanaTz);
    final now = tz.TZDateTime.now(ghanaZone);
    final today = tz.TZDateTime(ghanaZone, now.year, now.month, now.day);
    for (var slot = 0; slot <= 3; slot++) {
      await _notifications.cancel(_reminderId(today, slot));
    }

    for (final id in [200, 201, 202, 203]) {
      await _notifications.cancel(id);
    }
    debugPrint('[NOTIF] Cancelled pre-shift reminders.');
  }

  // ── Legacy method (kept for backward compat) ────────────────────────────────

  /// @deprecated  Use [scheduleShiftReminders] instead.
  Future<void> scheduleClockOutReminder({
    int hour = 17,
    int minute = 30,
  }) async {
    await scheduleCachedShiftReminders();
  }

  void dispose() {
    _syncEventController.close();
  }
}
