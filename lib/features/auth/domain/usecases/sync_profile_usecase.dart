import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';
import 'package:tk_clocking_system/features/auth/domain/repositories/auth_repository.dart';

class SyncProfileUseCase {
  const SyncProfileUseCase(this.repository);

  final AuthRepository repository;

  Future<Either<Failure, UserEntity>> call() async {
    return repository.syncProfile();
  }
}
