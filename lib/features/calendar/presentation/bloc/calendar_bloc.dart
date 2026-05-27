import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:tk_clocking_system/features/calendar/domain/entities/calendar_entities.dart';
import 'package:tk_clocking_system/features/calendar/domain/repositories/calendar_repository.dart';
import 'package:tk_clocking_system/features/calendar/presentation/bloc/calendar_event.dart';
import 'package:tk_clocking_system/features/calendar/presentation/bloc/calendar_state.dart';

class CalendarBloc extends Bloc<CalendarEvent, CalendarState> {
  final CalendarRepository repository;

  CalendarBloc({required this.repository}) : super(CalendarInitial()) {
    on<CalendarLoadEvent>(_onLoad);
  }

  Future<void> _onLoad(
      CalendarLoadEvent event, Emitter<CalendarState> emit) async {
    emit(CalendarLoading());

    final termsResult = await repository.getTerms();
    final holidaysResult = await repository.getHolidays();

    String? error;

    final List<AcademicTermEntity> terms = termsResult.fold(
      (err) {
        error = err;
        return <AcademicTermEntity>[];
      },
      (data) => data,
    );

    final List<HolidayEntity> holidays = holidaysResult.fold(
      (err) {
        error ??= err;
        return <HolidayEntity>[];
      },
      (data) => data,
    );

    if (error != null && terms.isEmpty && holidays.isEmpty) {
      emit(CalendarFailure(error!));
    } else {
      emit(CalendarLoaded(terms: terms, holidays: holidays));
    }
  }
}
