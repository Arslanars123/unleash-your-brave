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
    super.photoUrl = '',
    super.title = '',
    super.business = '',
    super.industry = '',
    super.location = '',
    super.bio = '',
    super.goals = const [],
    super.interests = const [],
    super.networkingPrefs = 'open_to_all',
    super.linkedinUrl = '',
    super.instagramUrl = '',
    super.websiteUrl = '',
    super.profileCompleted = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String? ?? json['fullName'] as String? ?? '',
      role: json['role'] as String,
      status: json['status'] as String,
      mustChangePassword: json['mustChangePassword'] as bool? ?? false,
      photoUrl: json['photoUrl'] as String? ?? '',
      title: json['title'] as String? ?? '',
      business: json['business'] as String? ?? '',
      industry: json['industry'] as String? ?? '',
      location: json['location'] as String? ?? '',
      bio: json['bio'] as String? ?? '',
      goals: _stringList(json['goals']),
      interests: _stringList(json['interests']),
      networkingPrefs: json['networkingPrefs'] as String? ?? 'open_to_all',
      linkedinUrl: json['linkedinUrl'] as String? ?? '',
      instagramUrl: json['instagramUrl'] as String? ?? '',
      websiteUrl: json['websiteUrl'] as String? ?? '',
      profileCompleted: json['profileCompleted'] as bool? ?? false,
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
      'photoUrl': photoUrl,
      'title': title,
      'business': business,
      'industry': industry,
      'location': location,
      'bio': bio,
      'goals': goals,
      'interests': interests,
      'networkingPrefs': networkingPrefs,
      'linkedinUrl': linkedinUrl,
      'instagramUrl': instagramUrl,
      'websiteUrl': websiteUrl,
      'profileCompleted': profileCompleted,
    };
  }

  String encode() => jsonEncode(toJson());

  static UserModel decode(String source) {
    return UserModel.fromJson(jsonDecode(source) as Map<String, dynamic>);
  }

  static List<String> _stringList(dynamic value) {
    if (value is! List) return const [];
    return value
        .whereType<String>()
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
}
