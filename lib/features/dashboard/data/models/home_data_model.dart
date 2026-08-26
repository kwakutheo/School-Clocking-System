import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';

/// Recursively converts a [Map<dynamic, dynamic>] (as returned by Hive)
/// into a [Map<String, dynamic>] so that [fromJson] casts don't throw.
Map<String, dynamic> deepCastMap(Map<dynamic, dynamic> map) {
  return map.map((key, value) {
    final castKey = key as String;
    final castValue = value is Map ? deepCastMap(value) : value;
    return MapEntry(castKey, castValue);
  });
}

class HomeDataModel extends HomeDataEntity {
  const HomeDataModel({
    super.lastActivityType,
    super.lastActivityTime,
    required super.isClockedIn,
    super.clockedInTime,
    super.forgotToClockOut,
    super.isLateToday,
    super.lateStatus,
    super.isShiftOver,
    super.isAbsentToday,
    required super.todayHours,
    required super.weekHours,
    required super.daysWorkedThisWeek,
    super.isHoliday,
    super.holidayName,
    super.isWeekend,
    super.isVacation,
    super.vacationName,
    super.isOnBreak,
    super.noShiftAssigned,
    super.shiftStartTime,
    super.shiftEndTime,
    super.nextShiftStartTime,
    super.nextShiftDate,
    super.upcomingHolidayName,
    super.upcomingHolidayDate,
    super.targetWeeklyHours = 40.0,
    super.targetDailyHours = 8.0,
    super.branchLat,
    super.branchLng,
    super.branchRadius,
    super.adminOverrideName,
    super.adminOverrideNote,
    super.hasClockedInToday,
  });

  factory HomeDataModel.fromJson(Map<String, dynamic> json) {
    AttendanceType? lastActivityType;
    DateTime? lastActivityTime;

    if (json['lastActivity'] != null) {
      lastActivityType = AttendanceType.fromValue(
          json['lastActivity']['type'] as String? ?? '');
      if (json['lastActivity']['timestamp'] != null) {
        lastActivityTime =
            DateTime.tryParse(json['lastActivity']['timestamp'].toString());
      }
    }

    DateTime? clockedInTime;
    if (json['clockedInTime'] != null) {
      clockedInTime = DateTime.tryParse(json['clockedInTime'].toString());
    }

    final bool hasClockedInToday = json['hasClockedInToday'] as bool? ?? false;

    // Parse lateStatus from backend string value
    LateStatus lateStatus = LateStatus.none;
    final rawLateStatus = json['lateStatus'] as String?;
    if (rawLateStatus == 'late') {
      lateStatus = LateStatus.late;
    } else if (rawLateStatus == 'persistent_late' ||
        rawLateStatus == 'persistentLate') {
      lateStatus = LateStatus.persistentLate;
    }

    return HomeDataModel(
      lastActivityType: lastActivityType,
      lastActivityTime: lastActivityTime,
      isClockedIn: json['isClockedIn'] as bool? ?? false,
      clockedInTime: clockedInTime,
      forgotToClockOut: json['forgotToClockOut'] as bool? ?? false,
      hasClockedInToday: hasClockedInToday,
      isLateToday: json['isLateToday'] as bool? ?? false,
      lateStatus: lateStatus,
      isShiftOver: json['isShiftOver'] as bool? ?? false,
      isAbsentToday: json['isAbsentToday'] as bool? ?? false,
      todayHours: (json['todayHours'] as num?)?.toDouble() ?? 0.0,
      weekHours: (json['weekHours'] as num?)?.toDouble() ?? 0.0,
      daysWorkedThisWeek: (json['daysWorkedThisWeek'] as num?)?.toInt() ?? 0,
      isHoliday: json['isHoliday'] as bool? ?? false,
      holidayName: json['holidayName'] as String?,
      isWeekend: json['isWeekend'] as bool? ?? false,
      isVacation: json['isVacation'] as bool? ?? false,
      vacationName: json['vacationName'] as String?,
      noShiftAssigned: json['noShiftAssigned'] as bool? ?? false,
      shiftStartTime: json['shiftStartTime'] as String?,
      shiftEndTime: json['shiftEndTime'] as String?,
      nextShiftStartTime: json['nextShiftStartTime'] as String?,
      nextShiftDate: json['nextShiftDate'] != null
          ? DateTime.tryParse(json['nextShiftDate'].toString())
          : null,
      upcomingHolidayName: json['upcomingHolidayName'] as String?,
      upcomingHolidayDate: json['upcomingHolidayDate'] != null
          ? DateTime.tryParse(json['upcomingHolidayDate'].toString())
          : null,
      targetWeeklyHours:
          (json['targetWeeklyHours'] as num?)?.toDouble() ?? 40.0,
      targetDailyHours: (json['targetDailyHours'] as num?)?.toDouble() ?? 8.0,
      branchLat: (json['branchLat'] as num?)?.toDouble(),
      branchLng: (json['branchLng'] as num?)?.toDouble(),
      branchRadius: (json['branchRadius'] as num?)?.toDouble(),
      adminOverrideName: json['adminOverride'] != null
          ? json['adminOverride']['adminName'] as String?
          : null,
      adminOverrideNote: json['adminOverride'] != null
          ? json['adminOverride']['note'] as String?
          : null,
    );
  }

  Map<String, dynamic> toJson({DateTime? now}) {
    // Record the calendar date this snapshot was created for.
    // Uses the trusted NTP-synced time passed in by the caller (TimeService),
    // NOT DateTime.now(), so that device clock tampering has no effect.
    final safeNow = (now ?? DateTime.now()).toUtc();
    final cacheDate =
        '${safeNow.year.toString().padLeft(4, '0')}-${safeNow.month.toString().padLeft(2, '0')}-${safeNow.day.toString().padLeft(2, '0')}';
    return {
      'lastActivity': lastActivityType != null
          ? {
              'type': lastActivityType!.name,
              'timestamp': lastActivityTime?.toIso8601String(),
            }
          : null,
      'isClockedIn': isClockedIn,
      'clockedInTime': clockedInTime?.toIso8601String(),
      'isOnBreak': isOnBreak,
      'forgotToClockOut': forgotToClockOut,
      'isLateToday': isLateToday,
      'lateStatus': lateStatus.name,
      'hasClockedInToday': hasClockedInToday,
      'isShiftOver': isShiftOver,
      'isAbsentToday': isAbsentToday,
      'isWeekend': isWeekend,
      'isVacation': isVacation,
      'vacationName': vacationName,
      'noShiftAssigned': noShiftAssigned,
      'todayHours': todayHours,
      'weekHours': weekHours,
      'daysWorkedThisWeek': daysWorkedThisWeek,
      'isHoliday': isHoliday,
      'holidayName': holidayName,
      'shiftStartTime': shiftStartTime,
      'shiftEndTime': shiftEndTime,
      'nextShiftStartTime': nextShiftStartTime,
      'nextShiftDate': nextShiftDate?.toIso8601String(),
      'upcomingHolidayName': upcomingHolidayName,
      'upcomingHolidayDate': upcomingHolidayDate?.toIso8601String(),
      'targetWeeklyHours': targetWeeklyHours,
      'targetDailyHours': targetDailyHours,
      'branchLat': branchLat,
      'branchLng': branchLng,
      'branchRadius': branchRadius,
      // Must match fromJson's nested structure exactly so the cache round-trips correctly
      'adminOverride': (adminOverrideName != null)
          ? {
              'adminName': adminOverrideName,
              'note': adminOverrideNote ?? '',
            }
          : null,
      'cacheDate': cacheDate,
      'cacheTimestamp': safeNow.toIso8601String(),
    };
  }
}
