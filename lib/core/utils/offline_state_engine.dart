import 'package:hive_flutter/hive_flutter.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/features/attendance/data/models/attendance_model.dart';
import 'package:tk_clocking_system/features/calendar/data/models/calendar_models.dart';
import 'package:tk_clocking_system/features/dashboard/data/models/home_data_model.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';

class OfflineStateEngine {
  static HomeDataModel recomputeForOfflineDay(
      HomeDataModel stale, DateTime now) {
    bool isHoliday = false;
    String? holidayName;
    final userBox = Hive.box<Map>(AppConstants.userBox);
    final cachedData = userBox.get(AppConstants.holidaysCacheKey);

    if (cachedData != null && cachedData.containsKey('data')) {
      final cachedHolidays = cachedData['data'] as List<dynamic>?;
      if (cachedHolidays != null) {
        final nowStr =
            '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
        final nowStrNoYear =
            '${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

        final holidays = cachedHolidays
            .whereType<Map>()
            .map((json) => HolidayModel.fromJson(
                  Map<String, dynamic>.from(json),
                ))
            .toList();

        for (final holiday in holidays) {
          final hDateStr = holiday.date.split('T').first;
          final hDateStrNoYear =
              hDateStr.length >= 10 ? hDateStr.substring(5, 10) : hDateStr;
          if (hDateStr == nowStr ||
              (holiday.isRecurring && hDateStrNoYear == nowStrNoYear)) {
            isHoliday = true;
            holidayName = holiday.name;
            break;
          }
        }
      }
    }

    final isWeekend =
        now.weekday == DateTime.saturday || now.weekday == DateTime.sunday;

    DateTime? shiftStart;
    DateTime? shiftEnd;

    if (stale.shiftStartTime != null) {
      final parts = stale.shiftStartTime!.split(':');
      if (parts.length >= 2) {
        final hour = int.tryParse(parts[0]);
        final minute = int.tryParse(parts[1]);
        if (hour != null && minute != null) {
          shiftStart = DateTime.utc(now.year, now.month, now.day, hour, minute);
        }
      }
    }

    if (stale.shiftEndTime != null) {
      final parts = stale.shiftEndTime!.split(':');
      if (parts.length >= 2) {
        final hour = int.tryParse(parts[0]);
        final minute = int.tryParse(parts[1]);
        if (hour != null && minute != null) {
          shiftEnd = DateTime.utc(now.year, now.month, now.day, hour, minute);
        }
      }
    }

    final attendanceBox = Hive.box<Map>(AppConstants.attendanceBox);
    final todayRecords = attendanceBox.values
        .map((e) => AttendanceModel.fromJson(Map<String, dynamic>.from(e)))
        .where((record) {
      final t = record.timestamp;
      return t.year == now.year && t.month == now.month && t.day == now.day;
    }).toList();

    todayRecords.sort((a, b) => a.timestamp.compareTo(b.timestamp));

    final bool hasActivityTimestampToday = stale.lastActivityTime != null &&
        stale.lastActivityTime!.year == now.year &&
        stale.lastActivityTime!.month == now.month &&
        stale.lastActivityTime!.day == now.day;

    final bool isStaleFromToday = hasActivityTimestampToday ||
        (stale.isClockedIn &&
            stale.clockedInTime != null &&
            stale.clockedInTime!.year == now.year &&
            stale.clockedInTime!.month == now.month &&
            stale.clockedInTime!.day == now.day);

    final validIncrementalRecords = todayRecords.where((record) {
      if (isStaleFromToday && stale.lastActivityTime != null) {
        final staleWithBuffer =
            stale.lastActivityTime!.add(const Duration(seconds: 2));
        if (record.timestamp.isAfter(staleWithBuffer)) return true;
        return false;
      }
      return true;
    }).toList();

    bool hasClockedInToday = isStaleFromToday ? stale.hasClockedInToday : false;
    bool isClockedIn = isStaleFromToday ? stale.isClockedIn : false;
    bool isOnBreak = isStaleFromToday ? stale.isOnBreak : false;

    bool forgotToClockOut = stale.forgotToClockOut;
    if (stale.isClockedIn &&
        stale.clockedInTime != null &&
        (stale.clockedInTime!.year != now.year ||
            stale.clockedInTime!.month != now.month ||
            stale.clockedInTime!.day != now.day)) {
      forgotToClockOut = true;
    }

    DateTime? clockedInTime = isStaleFromToday ? stale.clockedInTime : null;
    AttendanceType? lastActivityType =
        isStaleFromToday ? stale.lastActivityType : null;
    DateTime? lastActivityTime =
        isStaleFromToday ? stale.lastActivityTime : null;
    double todayHours = isStaleFromToday ? stale.todayHours : 0.0;

    DateTime? calcStart;

    final cacheMap = userBox.get('home_data_cache');
    final cacheTimestampStr = cacheMap?['cacheTimestamp'] as String?;
    final cacheTime =
        cacheTimestampStr != null ? DateTime.tryParse(cacheTimestampStr) : null;

    if (isStaleFromToday && isClockedIn && !isOnBreak) {
      calcStart = cacheTime ?? clockedInTime;
    }

    for (final record in validIncrementalRecords) {
      lastActivityType = record.type;
      lastActivityTime = record.timestamp;

      if (record.type == AttendanceType.clockIn) {
        hasClockedInToday = true;
        isClockedIn = true;
        isOnBreak = false;
        clockedInTime = record.timestamp;

        DateTime start = record.timestamp;
        if (shiftStart != null && start.isBefore(shiftStart)) {
          start = shiftStart;
        }
        calcStart = start;
      } else if (record.type == AttendanceType.clockOut) {
        isClockedIn = false;
        isOnBreak = false;
        forgotToClockOut = false;

        if (calcStart != null) {
          DateTime calcEnd = record.timestamp;
          if (shiftEnd != null && calcEnd.isAfter(shiftEnd)) {
            calcEnd = shiftEnd;
          }
          if (calcEnd.isAfter(calcStart)) {
            todayHours += calcEnd.difference(calcStart).inMinutes / 60.0;
          }
          calcStart = null;
        }
      } else if (record.type == AttendanceType.breakIn) {
        isOnBreak = true;
        isClockedIn = true;

        // Stop the clock
        if (calcStart != null) {
          DateTime calcEnd = record.timestamp;
          if (shiftEnd != null && calcEnd.isAfter(shiftEnd)) {
            calcEnd = shiftEnd;
          }
          if (calcEnd.isAfter(calcStart)) {
            todayHours += calcEnd.difference(calcStart).inMinutes / 60.0;
          }
          calcStart = null;
        }
      } else if (record.type == AttendanceType.breakOut) {
        isOnBreak = false;
        isClockedIn = true;

        // Restart the clock
        calcStart = record.timestamp;
        if (shiftStart != null && calcStart.isBefore(shiftStart)) {
          calcStart = shiftStart;
        }
      }
    }

    if (isClockedIn && !isOnBreak && calcStart != null) {
      DateTime calcEnd = now;
      if (shiftEnd != null && calcEnd.isAfter(shiftEnd)) {
        calcEnd = shiftEnd;
      }
      if (calcEnd.isAfter(calcStart)) {
        todayHours += calcEnd.difference(calcStart).inMinutes / 60.0;
      }
    }

    bool isShiftOver = false;
    if (shiftEnd != null) {
      isShiftOver = now.isAfter(shiftEnd);
    }

    if (isClockedIn && hasClockedInToday && shiftEnd != null) {
      if (now.isAfter(shiftEnd.add(const Duration(minutes: 10)))) {
        forgotToClockOut = true;
        isClockedIn = false;
      }
    }

    final isWorkingDay =
        !isWeekend && !isHoliday && !stale.isVacation && !stale.noShiftAssigned;
    bool isAbsentToday = isWorkingDay && !hasClockedInToday && isShiftOver;

    bool isLateToday = false;
    LateStatus lateStatus = LateStatus.none;

    if (hasClockedInToday && shiftStart != null && clockedInTime != null) {
      if (clockedInTime.isAfter(shiftStart)) {
        isLateToday = true;
        final minutesLate = clockedInTime.difference(shiftStart).inMinutes;
        lateStatus =
            minutesLate > 180 ? LateStatus.persistentLate : LateStatus.late;
      }
    } else if (!hasClockedInToday &&
        shiftStart != null &&
        shiftEnd != null &&
        isWorkingDay) {
      if (now.isAfter(shiftStart) &&
          (now.isBefore(shiftEnd) || now.isAtSameMomentAs(shiftEnd))) {
        final minutesLate = now.difference(shiftStart).inMinutes;
        lateStatus =
            minutesLate > 180 ? LateStatus.persistentLate : LateStatus.late;
      }
    }

    final isVacation = stale.isVacation;
    final vacationName = stale.vacationName;

    if (isVacation) {
      isAbsentToday = false;
      isLateToday = false;
    }

    return HomeDataModel(
      lastActivityType: lastActivityType,
      lastActivityTime: lastActivityTime,
      isClockedIn: isClockedIn,
      isOnBreak: isOnBreak,
      clockedInTime: clockedInTime,
      forgotToClockOut: forgotToClockOut,
      hasClockedInToday: hasClockedInToday,
      isLateToday: isLateToday,
      lateStatus: lateStatus,
      isShiftOver: isShiftOver,
      isAbsentToday: isAbsentToday,
      todayHours: todayHours,
      weekHours: stale.weekHours,
      daysWorkedThisWeek: stale.daysWorkedThisWeek,
      isHoliday: isHoliday,
      holidayName: holidayName,
      isWeekend: isWeekend,
      isVacation: isVacation,
      vacationName: vacationName,
      noShiftAssigned: stale.noShiftAssigned,
      shiftStartTime: stale.shiftStartTime,
      shiftEndTime: stale.shiftEndTime,
      nextShiftStartTime: stale.nextShiftStartTime,
      nextShiftDate: stale.nextShiftDate,
      upcomingHolidayName: stale.upcomingHolidayName,
      upcomingHolidayDate: stale.upcomingHolidayDate,
      targetWeeklyHours: stale.targetWeeklyHours,
      targetDailyHours: stale.targetDailyHours,
      branchLat: stale.branchLat,
      branchLng: stale.branchLng,
      branchRadius: stale.branchRadius,
      adminOverrideName: isStaleFromToday ? stale.adminOverrideName : null,
      adminOverrideNote: isStaleFromToday ? stale.adminOverrideNote : null,
    );
  }
}
