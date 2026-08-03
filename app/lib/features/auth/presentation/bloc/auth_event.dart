part of 'auth_bloc.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

final class AuthStarted extends AuthEvent {
  const AuthStarted();
}

final class AuthLoginRequested extends AuthEvent {
  const AuthLoginRequested({required this.email, required this.password});

  final String email;
  final String password;

  @override
  List<Object?> get props => [email, password];
}

final class AuthRegisterRequested extends AuthEvent {
  const AuthRegisterRequested({
    required this.email,
    required this.name,
    required this.password,
  });

  final String email;
  final String name;
  final String password;

  @override
  List<Object?> get props => [email, name, password];
}

final class AuthChangePasswordRequested extends AuthEvent {
  const AuthChangePasswordRequested({
    this.currentPassword,
    required this.newPassword,
  });

  final String? currentPassword;
  final String newPassword;

  @override
  List<Object?> get props => [currentPassword, newPassword];
}

final class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}
