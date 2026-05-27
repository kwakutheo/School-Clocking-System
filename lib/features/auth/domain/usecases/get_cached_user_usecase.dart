import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';
import 'package:tk_clocking_system/features/auth/domain/repositories/auth_repository.dart';

/// Returns the locally cached user if a session exists.
///
/// Used at app startup to decide whether to show the login screen
/// or the home screen.
class GetCachedUserUseCase {
  const GetCachedUserUseCase(this._repository);

  final AuthRepository _repository;

  Future<Either<Failure, UserEntity?>> call() => _repository.getCachedUser();
}
