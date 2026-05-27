import 'package:equatable/equatable.dart';

abstract class ProfileEvent extends Equatable {
  const ProfileEvent();

  @override
  List<Object?> get props => [];
}

class LoadWorkHistoryEvent extends ProfileEvent {
  final String? employeeId;

  const LoadWorkHistoryEvent({this.employeeId});

  @override
  List<Object?> get props => [employeeId];
}
