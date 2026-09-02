import 'package:tk_clocking_system/features/calendar/domain/entities/calendar_entities.dart';

class TermBreakModel extends TermBreakEntity {
  const TermBreakModel({
    required super.id,
    required super.name,
    required super.startDate,
    required super.endDate,
  });

  factory TermBreakModel.fromJson(Map<String, dynamic> json) {
    return TermBreakModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'startDate': startDate,
        'endDate': endDate,
      };
}

class AcademicTermModel extends AcademicTermEntity {
  const AcademicTermModel({
    required super.id,
    required super.name,
    required super.startDate,
    required super.endDate,
    super.academicYear,
    super.isActive,
    required super.breaks,
  });

  factory AcademicTermModel.fromJson(Map<String, dynamic> json) {
    final breaksList = json['breaks'] as List<dynamic>? ?? [];
    return AcademicTermModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
      academicYear: json['academicYear'] as String?,
      isActive: json['isActive'] as bool?,
      breaks: breaksList
          .cast<Map<String, dynamic>>()
          .map(TermBreakModel.fromJson)
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'startDate': startDate,
        'endDate': endDate,
        'academicYear': academicYear,
        'isActive': isActive,
        'breaks': breaks
            .map((b) => (b as TermBreakModel).toJson())
            .toList(),
      };
}

class HolidayModel extends HolidayEntity {
  const HolidayModel({
    required super.id,
    required super.name,
    required super.date,
    required super.isRecurring,
  });

  factory HolidayModel.fromJson(Map<String, dynamic> json) {
    return HolidayModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      date: json['date'] as String? ?? '',
      isRecurring: json['isRecurring'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'date': date,
      'isRecurring': isRecurring,
    };
  }
}
