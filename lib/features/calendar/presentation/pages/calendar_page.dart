import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/presentation/widgets/error_state_view.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/features/calendar/domain/entities/calendar_entities.dart';
import 'package:tk_clocking_system/features/calendar/presentation/bloc/calendar_bloc.dart';
import 'package:tk_clocking_system/features/calendar/presentation/bloc/calendar_event.dart';
import 'package:tk_clocking_system/features/calendar/presentation/bloc/calendar_state.dart';
import 'package:tk_clocking_system/shared/widgets/loading_indicator.dart';

class CalendarPage extends StatelessWidget {
  const CalendarPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => sl<CalendarBloc>()..add(CalendarLoadEvent()),
      child: const _CalendarView(),
    );
  }
}

class _CalendarView extends StatelessWidget {
  const _CalendarView();

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Calendar'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Academic Terms'),
              Tab(text: 'Public Holidays'),
            ],
          ),
        ),
        body: BlocBuilder<CalendarBloc, CalendarState>(
          builder: (context, state) {
            if (state is CalendarLoading || state is CalendarInitial) {
              return const AppLoadingIndicator(message: 'Loading calendar...');
            }

            if (state is CalendarFailure) {
              return ErrorStateView(
                message: state.message,
                onRetry: () {
                  context.read<CalendarBloc>().add(CalendarLoadEvent());
                },
              );
            }

            if (state is CalendarLoaded) {
              return TabBarView(
                children: [
                  _TermsList(terms: state.terms),
                  _HolidaysList(holidays: state.holidays),
                ],
              );
            }

            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}

class _TermsList extends StatelessWidget {
  final List<AcademicTermEntity> terms;

  const _TermsList({required this.terms});

  @override
  Widget build(BuildContext context) {
    if (terms.isEmpty) {
      return const Center(child: Text('No academic terms configured.'));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: terms.length,
      separatorBuilder: (_, __) => const SizedBox(height: 16),
      itemBuilder: (context, index) {
        final term = terms[index];
        final start = DateTime.tryParse(term.startDate);
        final end = DateTime.tryParse(term.endDate);
        final dateRange = start != null && end != null
            ? '${DateFormat('MMM d, yyyy').format(start)} - ${DateFormat('MMM d, yyyy').format(end)}'
            : '${term.startDate} - ${term.endDate}';

        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            side: BorderSide(
                color: Theme.of(context)
                    .colorScheme
                    .outlineVariant
                    .withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(16),
          ),
          child: ExpansionTile(
            title: Text(
              term.name,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle:
                Text(dateRange, style: const TextStyle(color: Colors.grey)),
            leading: const CircleAvatar(
              backgroundColor: Colors.blueAccent,
              child: Icon(Icons.school, color: Colors.white, size: 20),
            ),
            children: term.breaks.isEmpty
                ? [
                    const Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Text('No breaks scheduled.'),
                    )
                  ]
                : term.breaks.map((b) {
                    final bStart = DateTime.tryParse(b.startDate);
                    final bEnd = DateTime.tryParse(b.endDate);
                    final bRange = bStart != null && bEnd != null
                        ? '${DateFormat('MMM d').format(bStart)} - ${DateFormat('MMM d').format(bEnd)}'
                        : '${b.startDate} - ${b.endDate}';

                    return ListTile(
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 32),
                      title: Text(b.name, style: const TextStyle(fontSize: 14)),
                      trailing: Text(bRange,
                          style: const TextStyle(
                              fontSize: 12, color: Colors.grey)),
                      leading: const Icon(Icons.free_breakfast,
                          size: 16, color: Colors.orange),
                    );
                  }).toList(),
          ),
        );
      },
    );
  }
}

class _HolidaysList extends StatelessWidget {
  final List<HolidayEntity> holidays;

  const _HolidaysList({required this.holidays});

  @override
  Widget build(BuildContext context) {
    if (holidays.isEmpty) {
      return const Center(child: Text('No public holidays configured.'));
    }

    return StreamBuilder<DateTime>(
      stream: sl<TimeService>().trueTimeStream,
      initialData: sl<TimeService>().currentGhanaTime,
      builder: (context, snapshot) {
        final now = snapshot.data ?? sl<TimeService>().currentGhanaTime;
        final year = now.year;
        return ListView.separated(
          padding: const EdgeInsets.all(16),
      itemCount: holidays.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final holiday = holidays[index];
        DateTime? date;
        String dateStr = holiday.date;

        // Handle recurring dates like "MM-DD"
        if (holiday.date.length == 5) {
          date = DateTime.tryParse('$year-${holiday.date}');
        } else {
          date = DateTime.tryParse(holiday.date);
        }

        if (date != null) {
          dateStr = DateFormat('MMMM d').format(date);
        }

        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            side: BorderSide(
                color: Theme.of(context)
                    .colorScheme
                    .outlineVariant
                    .withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(16),
          ),
          child: ListTile(
            leading: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.event, color: Colors.green),
            ),
            title: Text(
              holiday.name,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Text(
              holiday.isRecurring ? 'Recurring Annually' : 'Date may change',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
            trailing: Text(
              dateStr,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: Colors.green,
              ),
            ),
          ),
        );
          },
        );
      },
    );
  }
}
