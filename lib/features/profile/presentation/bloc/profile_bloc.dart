import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:tk_clocking_system/features/profile/domain/repositories/profile_repository.dart';
import 'package:tk_clocking_system/features/profile/presentation/bloc/profile_event.dart';
import 'package:tk_clocking_system/features/profile/presentation/bloc/profile_state.dart';

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final ProfileRepository _repository;

  ProfileBloc({required ProfileRepository repository})
      : _repository = repository,
        super(const ProfileInitial()) {
    on<LoadWorkHistoryEvent>(_onLoadWorkHistory);
  }

  Future<void> _onLoadWorkHistory(
    LoadWorkHistoryEvent event,
    Emitter<ProfileState> emit,
  ) async {
    emit(const ProfileLoading());

    final result = await _repository.getWorkHistory(employeeId: event.employeeId);

    result.fold(
      (failure) => emit(ProfileError(failure.message)),
      (history) => emit(ProfileHistoryLoaded(history: history)),
    );
  }
}
