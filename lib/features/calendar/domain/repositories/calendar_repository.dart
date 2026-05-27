import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/features/calendar/domain/entities/calendar_entities.dart';

abstract class CalendarRepository {
  Future<Either<String, List<AcademicTermEntity>>> getTerms();
  Future<Either<String, List<HolidayEntity>>> getHolidays();
}
