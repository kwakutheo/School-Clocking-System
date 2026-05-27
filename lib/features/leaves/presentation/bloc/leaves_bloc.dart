import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:tk_clocking_system/features/leaves/domain/repositories/leaves_repository.dart';
import 'package:tk_clocking_system/features/leaves/presentation/bloc/leaves_event.dart';
import 'package:tk_clocking_system/features/leaves/presentation/bloc/leaves_state.dart';

class LeavesBloc extends Bloc<LeavesEvent, LeavesState> {
  final LeavesRepository repository;

  LeavesBloc({required this.repository}) : super(LeavesInitial()) {
    on<LoadMyLeaves>(_onLoadMyLeaves);
    on<SubmitLeaveRequest>(_onSubmitLeaveRequest);
    on<CancelLeaveRequest>(_onCancelLeaveRequest);
  }

  Future<void> _onLoadMyLeaves(LoadMyLeaves event, Emitter<LeavesState> emit) async {
    emit(LeavesLoading());
    final result = await repository.getMyLeaves();
    result.fold(
      (failure) => emit(LeavesError(failure)),
      (leaves) => emit(LeavesLoaded(leaves)),
    );
  }

  Future<void> _onSubmitLeaveRequest(SubmitLeaveRequest event, Emitter<LeavesState> emit) async {
    emit(LeaveSubmissionInProgress());
    final result = await repository.requestLeave(
      leaveType: event.leaveType,
      startDate: event.startDate,
      endDate: event.endDate,
      reason: event.reason,
    );
    result.fold(
      (failure) => emit(LeaveSubmissionFailure(failure)),
      (leave) {
        emit(LeaveSubmissionSuccess());
        add(LoadMyLeaves()); // Reload the list after success
      },
    );
  }

  Future<void> _onCancelLeaveRequest(CancelLeaveRequest event, Emitter<LeavesState> emit) async {
    emit(LeaveSubmissionInProgress());
    final result = await repository.cancelLeave(event.leaveId);
    result.fold(
      (failure) => emit(LeaveSubmissionFailure(failure)),
      (_) {
        emit(LeaveSubmissionSuccess());
        add(LoadMyLeaves()); // Reload the list after cancellation
      },
    );
  }
}
