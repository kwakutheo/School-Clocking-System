import 'package:equatable/equatable.dart';

class TermBreakEntity extends Equatable {
  final String id;
  final String name;
  final String startDate;
  final String endDate;

  const TermBreakEntity({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
  });

  @override
  List<Object?> get props => [id, name, startDate, endDate];
}

class AcademicTermEntity extends Equatable {
  final String id;
  final String name;
  final String startDate;
  final String endDate;
  final String? academicYear;
  final bool? isActive;
  final List<TermBreakEntity> breaks;

  const AcademicTermEntity({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    this.academicYear,
    this.isActive,
    required this.breaks,
  });

  @override
  List<Object?> get props => [id, name, startDate, endDate, academicYear, isActive, breaks];
}

class HolidayEntity extends Equatable {
  final String id;
  final String name;
  final String date;
  final bool isRecurring;

  const HolidayEntity({
    required this.id,
    required this.name,
    required this.date,
    required this.isRecurring,
  });

  @override
  List<Object?> get props => [id, name, date, isRecurring];
}
