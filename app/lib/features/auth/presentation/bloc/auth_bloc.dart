import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:unleash_your_brave/core/usecase/usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/change_password_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/get_current_user_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/login_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/logout_usecase.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/register_usecase.dart';

part 'auth_event.dart';
part 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({
    required LoginUseCase loginUseCase,
    required RegisterUseCase registerUseCase,
    required GetCurrentUserUseCase getCurrentUserUseCase,
    required LogoutUseCase logoutUseCase,
    required ChangePasswordUseCase changePasswordUseCase,
  }) : _loginUseCase = loginUseCase,
       _registerUseCase = registerUseCase,
       _getCurrentUserUseCase = getCurrentUserUseCase,
       _logoutUseCase = logoutUseCase,
       _changePasswordUseCase = changePasswordUseCase,
       super(const AuthInitial()) {
    on<AuthStarted>(_onStarted);
    on<AuthLoginRequested>(_onLogin);
    on<AuthRegisterRequested>(_onRegister);
    on<AuthChangePasswordRequested>(_onChangePassword);
    on<AuthLogoutRequested>(_onLogout);
  }

  final LoginUseCase _loginUseCase;
  final RegisterUseCase _registerUseCase;
  final GetCurrentUserUseCase _getCurrentUserUseCase;
  final LogoutUseCase _logoutUseCase;
  final ChangePasswordUseCase _changePasswordUseCase;

  Future<void> _onStarted(AuthStarted event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    final result = await _getCurrentUserUseCase(const NoParams());
    result.fold(
      (_) => emit(const AuthUnauthenticated()),
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> _onLogin(AuthLoginRequested event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    final result = await _loginUseCase(
      LoginParams(email: event.email, password: event.password),
    );
    result.fold(
      (failure) => emit(AuthFailureState(failure.message)),
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> _onRegister(AuthRegisterRequested event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    final result = await _registerUseCase(
      RegisterParams(email: event.email, name: event.name, password: event.password),
    );
    result.fold(
      (failure) => emit(AuthFailureState(failure.message)),
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> _onChangePassword(
    AuthChangePasswordRequested event,
    Emitter<AuthState> emit,
  ) async {
    final previous = state;
    emit(const AuthLoading());
    final result = await _changePasswordUseCase(
      ChangePasswordParams(
        currentPassword: event.currentPassword,
        newPassword: event.newPassword,
      ),
    );
    result.fold(
      (failure) {
        emit(AuthFailureState(failure.message));
        if (previous is AuthAuthenticated) {
          emit(previous);
        }
      },
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> _onLogout(AuthLogoutRequested event, Emitter<AuthState> emit) async {
    await _logoutUseCase(const NoParams());
    emit(const AuthUnauthenticated());
  }
}
