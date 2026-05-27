import 'package:equatable/equatable.dart';

class AcademicTermEntity extends Equatable {
  final String id;
  final String name;
  final String academicYear;
  final bool isActive;
  /// ISO-8601 date string, e.g. '2026-01-15'
  final String startDate;
  /// ISO-8601 date string, e.g. '2026-06-30'
  final String endDate;

  const AcademicTermEntity({
    required this.id,
    required this.name,
    required this.academicYear,
    required this.isActive,
    required this.startDate,
    required this.endDate,
  });

  /// Returns true when the given date falls within [startDate] .. [endDate] (inclusive).
  bool containsDate(DateTime date) {
    final dateStr =
        '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    return dateStr.compareTo(startDate) >= 0 && dateStr.compareTo(endDate) <= 0;
  }

  @override
  List<Object?> get props => [id, name, academicYear, isActive, startDate, endDate];
}
