
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/auth/domain/usecases/get_cached_user_usecase.dart';
import 'package:tk_clocking_system/features/auth/domain/usecases/login_usecase.dart';
import 'package:tk_clocking_system/features/auth/domain/usecases/logout_usecase.dart';
import 'package:tk_clocking_system/features/auth/domain/usecases/sync_profile_usecase.dart';
import 'package:tk_clocking_system/features/auth/domain/usecases/update_fcm_token_usecase.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_event.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_state.dart';

/// Manages authentication state across the entire application.
///
/// Listens for [AuthEvent]s and emits [AuthState]s that drive
/// both the router redirect logic and the login UI.
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({
    required LoginUseCase loginUseCase,
    required LogoutUseCase logoutUseCase,
    required GetCachedUserUseCase getCachedUserUseCase,
    required SyncProfileUseCase syncProfileUseCase,
    required UpdateFcmTokenUseCase updateFcmTokenUseCase,
  })  : _login = loginUseCase,
        _logout = logoutUseCase,
        _getCachedUser = getCachedUserUseCase,
        _syncProfile = syncProfileUseCase,
        _updateFcmToken = updateFcmTokenUseCase,
        super(const AuthInitial()) {
    on<AuthCheckSessionEvent>(_onCheckSession);
    on<AuthLoginEvent>(_onLogin);
    on<AuthLogoutEvent>(_onLogout);
    on<AuthSyncProfileEvent>(_onSyncProfile);
    on<AuthUpdateFcmTokenEvent>(_onUpdateFcmToken);
  }

  final LoginUseCase _login;
  final LogoutUseCase _logout;
  final GetCachedUserUseCase _getCachedUser;
  final SyncProfileUseCase _syncProfile;
  final UpdateFcmTokenUseCase _updateFcmToken;

  // ── Session restore ───────────────────────────────────────────────────────
  Future<void> _onCheckSession(
    AuthCheckSessionEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    final result = await _getCachedUser();
    result.fold(
      (failure) => emit(const AuthUnauthenticated()),
      (user) => user != null
          ? emit(AuthAuthenticated(user))
          : emit(const AuthUnauthenticated()),
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  Future<void> _onLogin(
    AuthLoginEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());

    final result = await _login(
      username: event.username,
      password: event.password,
    );

    if (result.isLeft()) {
      emit(AuthFailure(result.swap().getOrElse(() => const ServerFailure()).message));
      return;
    }

    final loginResult = result.getOrElse(() => throw Exception('Should not happen'));

    // 1. Emit shallow user immediately so navigation can happen
    emit(AuthAuthenticated(loginResult.user, isOffline: loginResult.isOffline));

    // 2. If online, sync full profile in the background to fill in the gaps
    if (!loginResult.isOffline) {
      final syncResult = await _syncProfile();
      syncResult.fold(
        (failure) => null, // Log or ignore, we already have the basic user
        (syncedUser) => emit(AuthAuthenticated(syncedUser)),
      );
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  Future<void> _onLogout(
    AuthLogoutEvent event,
    Emitter<AuthState> emit,
  ) async {
    await _logout();
    emit(const AuthUnauthenticated());
  }

  // ── Sync Profile ──────────────────────────────────────────────────────────
  Future<void> _onSyncProfile(
    AuthSyncProfileEvent event,
    Emitter<AuthState> emit,
  ) async {
    final result = await _syncProfile();
    result.fold(
      (failure) {
        // If it fails, just keep the current state (don't log out)
        // Optionally, we could emit an error state, but for a background refresh
        // it's usually better to just ignore the failure.
      },
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  // ── Update FCM Token ──────────────────────────────────────────────────────
  Future<void> _onUpdateFcmToken(
    AuthUpdateFcmTokenEvent event,
    Emitter<AuthState> emit,
  ) async {
    // We do not change the current state, just fire and forget the token update.
    await _updateFcmToken(token: event.token);
  }
}
