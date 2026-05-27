import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

/// Fired at app startup to restore session from local storage.
class AuthCheckSessionEvent extends AuthEvent {
  const AuthCheckSessionEvent();
}

/// Fired when the user submits the login form.
class AuthLoginEvent extends AuthEvent {
  const AuthLoginEvent({
    required this.username,
    required this.password,
  });

  final String username;
  final String password;

  @override
  List<Object?> get props => [username, password];
}

/// Fired when the user taps the logout button.
class AuthLogoutEvent extends AuthEvent {
  const AuthLogoutEvent();
}

/// Fired to manually refresh the user's profile from the backend.
class AuthSyncProfileEvent extends AuthEvent {
  const AuthSyncProfileEvent();
}

/// Fired to update the user's FCM token on the backend.
class AuthUpdateFcmTokenEvent extends AuthEvent {
  const AuthUpdateFcmTokenEvent({required this.token});

  final String token;

  @override
  List<Object?> get props => [token];
}
