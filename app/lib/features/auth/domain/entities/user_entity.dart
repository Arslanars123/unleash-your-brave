import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  const UserEntity({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.status,
    this.mustChangePassword = false,
  });

  final String id;
  final String email;
  final String name;
  final String role;
  final String status;
  final bool mustChangePassword;

  UserEntity copyWith({
    String? id,
    String? email,
    String? name,
    String? role,
    String? status,
    bool? mustChangePassword,
  }) {
    return UserEntity(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      role: role ?? this.role,
      status: status ?? this.status,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
    );
  }

  @override
  List<Object?> get props => [id, email, name, role, status, mustChangePassword];
}
