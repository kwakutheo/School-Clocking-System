import 'package:dartz/dartz.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/login_result.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';

/// Contract for all authentication data operations.
///
/// Implemented in the data layer; consumed only by use cases.
abstract interface class AuthRepository {
  /// Authenticates the user and persists the session tokens.
  Future<Either<Failure, LoginResult>> login({
    required String username,
    required String password,
  });

  /// Clears all session data from secure storage.
  Future<Either<Failure, void>> logout();

  /// Returns the locally cached user, or null if no session exists.
  Future<Either<Failure, UserEntity?>> getCachedUser();

  /// Fetches the latest user profile from the backend and updates the cache.
  Future<Either<Failure, UserEntity>> syncProfile();

  /// Updates the FCM push notification token on the backend.
  Future<Either<Failure, void>> updateFcmToken(String token);
}
