import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';

/// Result of a login attempt, carrying both the user and offline status.
class LoginResult {
  const LoginResult({required this.user, this.isOffline = false});

  final UserEntity user;

  /// Whether the login was performed using cached offline credentials
  /// because the server was unreachable.
  final bool isOffline;
}
