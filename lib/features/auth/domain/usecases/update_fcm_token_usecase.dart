import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/auth/domain/repositories/auth_repository.dart';

/// Updates the FCM push notification token.
class UpdateFcmTokenUseCase {
  const UpdateFcmTokenUseCase(this._repository);

  final AuthRepository _repository;

  Future<Either<Failure, void>> call({required String token}) =>
      _repository.updateFcmToken(token);
}
