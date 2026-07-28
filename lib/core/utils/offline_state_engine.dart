import 'package:hive_flutter/hive_flutter.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/features/attendance/data/models/attendance_model.dart';
import 'package:tk_clocking_system/features/calendar/data/models/calendar_models.dart';
import 'package:tk_clocking_system/features/dashboard/data/models/home_data_model.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';

class OfflineStateEngine {
  /// Recomputes a stale [HomeDataModel] for the current offline day.
  static HomeDataModel recomputeForOfflineDay(
      HomeDataModel stale, DateTime now) {
    
    // 1. Check local holidays cache
    bool isHoliday = false;
    String? holidayName;
    final userBox = Hive.box<Map>(AppConstants.userBox);
    final cachedData = userBox.get(AppConstants.holidaysCacheKey);
    
    if (cachedData != null && cachedData.containsKey('data')) {
      final cachedHolidays = cachedData['data'] as List<dynamic>?;
      if (cachedHolidays != null) {
        final nowStr = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
        final nowStrNoYear = '${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
        
        final holidays = cachedHolidays
            .cast<Map<String, dynamic>>()
            .map((json) => HolidayModel.fromJson(json))
            .toList();
          
      for (final holiday in holidays) {
        if (holiday.date == nowStr || (holiday.isRecurring && holiday.date == nowStrNoYear)) {
          isHoliday = true;
          holidayName = holiday.name;
          break;
        }
      }
      }
    }

    final isWeekend = now.weekday == DateTime.saturday || now.weekday == DateTime.sunday;
    
    // Check local attendance box for today's offline events
    final attendanceBox = Hive.box<Map>(AppConstants.attendanceBox);
    final todayRecords = attendanceBox.values
        .map((e) => AttendanceModel.fromJson(Map<String, dynamic>.from(e)))
        .where((record) {
      final t = record.timestamp;
      return t.year == now.year && t.month == now.month && t.day == now.day;
    }).toList();
    
    todayRecords.sort((a, b) => a.timestamp.compareTo(b.timestamp));

    bool hasClockedInToday = false;
    bool isClockedIn = false;
    bool forgotToClockOut = false;
    DateTime? clockedInTime;
    double todayHours = 0.0;
    AttendanceType? lastActivityType;
    DateTime? lastActivityTime;

    DateTime? currentInTime;

    for (final record in todayRecords) {
      lastActivityType = record.type;
      lastActivityTime = record.timestamp;
      
      if (record.type == AttendanceType.clockIn) {
        hasClockedInToday = true;
        isClockedIn = true;
        clockedInTime = record.timestamp;
        currentInTime = record.timestamp;
      } else if (record.type == AttendanceType.clockOut) {
        isClockedIn = false;
        if (currentInTime != null) {
          todayHours += record.timestamp.difference(currentInTime).inMinutes / 60.0;
          currentInTime = null;
        }
      } else if (record.type == AttendanceType.breakIn) {
        // Break doesn't clock you out, but it stops counting hours
        if (currentInTime != null) {
          todayHours += record.timestamp.difference(currentInTime).inMinutes / 60.0;
          currentInTime = null;
        }
      } else if (record.type == AttendanceType.breakOut) {
        currentInTime = record.timestamp;
      }
    }
    
    // Add pending hours if currently clocked in
    if (isClockedIn && currentInTime != null) {
      todayHours += now.difference(currentInTime).inMinutes / 60.0;
    }

    // Determine shift start and end
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

    bool isShiftOver = false;
    if (shiftEnd != null) {
      isShiftOver = now.isAfter(shiftEnd);
    }
    
    if (isClockedIn && isShiftOver && shiftEnd != null) {
      if (now.difference(shiftEnd).inHours > 2) {
        forgotToClockOut = true;
      }
    }

    bool isAbsentToday = !hasClockedInToday && isShiftOver;
    
    bool isLateToday = false;
    LateStatus lateStatus = LateStatus.none;
    
    if (hasClockedInToday && shiftStart != null && clockedInTime != null) {
      if (clockedInTime.isAfter(shiftStart)) {
        isLateToday = true;
        final minutesLate = clockedInTime.difference(shiftStart).inMinutes;
        lateStatus = minutesLate > 120 ? LateStatus.persistentLate : LateStatus.late;
      }
    }

    // Preserve vacation state from cache
    final isVacation = stale.isVacation;
    final vacationName = stale.vacationName;
    
    // If on vacation, they can't be absent or late
    if (isVacation) {
      isAbsentToday = false;
      isLateToday = false;
    }

    return HomeDataModel(
      lastActivityType: lastActivityType,
      lastActivityTime: lastActivityTime,
      isClockedIn: isClockedIn,
      clockedInTime: clockedInTime,
      forgotToClockOut: forgotToClockOut,
      hasClockedInToday: hasClockedInToday,
      isLateToday: isLateToday,
      lateStatus: lateStatus,
      isShiftOver: isShiftOver,
      isAbsentToday: isAbsentToday,
      todayHours: todayHours,
      weekHours: stale.weekHours, // Keep stale
      daysWorkedThisWeek: stale.daysWorkedThisWeek, // Keep stale
      isHoliday: isHoliday,
      holidayName: holidayName,
      isWeekend: isWeekend,
      isVacation: isVacation,
      vacationName: vacationName,
      noShiftAssigned: stale.noShiftAssigned, // Keep stale (assume schedule repeats)
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
      adminOverrideName: null, // Reset for new day
      adminOverrideNote: null, // Reset for new day
    );
  }
}
