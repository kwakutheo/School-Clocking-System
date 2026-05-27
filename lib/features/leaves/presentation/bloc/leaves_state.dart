import 'package:equatable/equatable.dart';
import 'package:tk_clocking_system/features/leaves/data/models/leave_request_model.dart';

abstract class LeavesState extends Equatable {
  const LeavesState();

  @override
  List<Object?> get props => [];
}

class LeavesInitial extends LeavesState {}

class LeavesLoading extends LeavesState {}

class LeavesLoaded extends LeavesState {
  final List<LeaveRequestModel> leaves;

  const LeavesLoaded(this.leaves);

  @override
  List<Object?> get props => [leaves];
}

class LeavesError extends LeavesState {
  final String message;

  const LeavesError(this.message);

  @override
  List<Object?> get props => [message];
}

class LeaveSubmissionInProgress extends LeavesState {}

class LeaveSubmissionSuccess extends LeavesState {}

class LeaveSubmissionFailure extends LeavesState {
  final String message;

  const LeaveSubmissionFailure(this.message);

  @override
  List<Object?> get props => [message];
}
