import 'package:tk_clocking_system/features/attendance/domain/entities/academic_term_entity.dart';

class AcademicTermModel extends AcademicTermEntity {
  const AcademicTermModel({
    required super.id,
    required super.name,
    required super.academicYear,
    required super.isActive,
    required super.startDate,
    required super.endDate,
  });

  factory AcademicTermModel.fromJson(Map<String, dynamic> json) {
    return AcademicTermModel(
      id: json['id'] as String,
      name: json['name'] as String,
      academicYear: json['academicYear'] as String? ?? json['academic_year'] as String? ?? '',
      isActive: json['isActive'] as bool? ?? json['is_active'] as bool? ?? false,
      startDate: json['startDate'] as String? ?? json['start_date'] as String? ?? '',
      endDate: json['endDate'] as String? ?? json['end_date'] as String? ?? '',
    );
  }
}
