import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  const UserEntity({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.status,
  });

  final String id;
  final String email;
  final String name;
  final String role;
  final String status;

  @override
  List<Object?> get props => [id, email, name, role, status];
}
