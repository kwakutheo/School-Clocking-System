import 'package:equatable/equatable.dart';
import 'package:tk_clocking_system/features/calendar/domain/entities/calendar_entities.dart';

abstract class CalendarState extends Equatable {
  const CalendarState();

  @override
  List<Object?> get props => [];
}

class CalendarInitial extends CalendarState {}

class CalendarLoading extends CalendarState {}

class CalendarLoaded extends CalendarState {
  final List<AcademicTermEntity> terms;
  final List<HolidayEntity> holidays;

  const CalendarLoaded({required this.terms, required this.holidays});

  @override
  List<Object?> get props => [terms, holidays];
}

class CalendarFailure extends CalendarState {
  final String message;

  const CalendarFailure(this.message);

  @override
  List<Object?> get props => [message];
}
