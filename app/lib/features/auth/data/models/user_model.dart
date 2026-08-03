import 'dart:convert';

import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  const UserModel({
    required super.id,
    required super.email,
    required super.name,
    required super.role,
    required super.status,
    super.mustChangePassword = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
      status: json['status'] as String,
      mustChangePassword: json['mustChangePassword'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'role': role,
      'status': status,
      'mustChangePassword': mustChangePassword,
    };
  }

  String encode() => jsonEncode(toJson());

  static UserModel decode(String source) {
    return UserModel.fromJson(jsonDecode(source) as Map<String, dynamic>);
  }
}
