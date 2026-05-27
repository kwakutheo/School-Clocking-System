import 'package:equatable/equatable.dart';

abstract class LeavesEvent extends Equatable {
  const LeavesEvent();

  @override
  List<Object?> get props => [];
}

class LoadMyLeaves extends LeavesEvent {}

class SubmitLeaveRequest extends LeavesEvent {
  final String leaveType;
  final DateTime startDate;
  final DateTime endDate;
  final String? reason;

  const SubmitLeaveRequest({
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    this.reason,
  });

  @override
  List<Object?> get props => [leaveType, startDate, endDate, reason];
}

class CancelLeaveRequest extends LeavesEvent {
  final String leaveId;

  const CancelLeaveRequest(this.leaveId);

  @override
  List<Object?> get props => [leaveId];
}
