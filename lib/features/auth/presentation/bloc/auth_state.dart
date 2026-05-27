import 'package:equatable/equatable.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';

abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

/// Initial state — session check hasn't run yet.
class AuthInitial extends AuthState {
  const AuthInitial();
}

/// Session check or login request is in progress.
class AuthLoading extends AuthState {
  const AuthLoading();
}

/// User is authenticated. Carries the full user entity.
class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user, {this.isOffline = false});

  final UserEntity user;
  final bool isOffline;

  @override
  List<Object?> get props => [user, isOffline];
}

/// No valid session — router redirects to login.
class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

/// An auth operation failed. Carries a user-friendly message.
class AuthFailure extends AuthState {
  const AuthFailure(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
