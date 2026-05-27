import 'package:equatable/equatable.dart';
import 'package:tk_clocking_system/features/profile/domain/entities/employee_status_log_entity.dart';

abstract class ProfileState extends Equatable {
  const ProfileState();

  @override
  List<Object?> get props => [];
}

class ProfileInitial extends ProfileState {
  const ProfileInitial();
}

class ProfileLoading extends ProfileState {
  const ProfileLoading();
}

class ProfileHistoryLoaded extends ProfileState {
  final List<EmployeeStatusLogEntity> history;

  const ProfileHistoryLoaded({required this.history});

  @override
  List<Object?> get props => [history];
}

class ProfileError extends ProfileState {
  final String message;

  const ProfileError(this.message);

  @override
  List<Object?> get props => [message];
}
