import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/login_result.dart';
import 'package:tk_clocking_system/features/auth/domain/repositories/auth_repository.dart';

/// Authenticates a user with username and password.
class LoginUseCase {
  const LoginUseCase(this._repository);

  final AuthRepository _repository;

  Future<Either<Failure, LoginResult>> call({
    required String username,
    required String password,
  }) =>
      _repository.login(username: username, password: password);
}
