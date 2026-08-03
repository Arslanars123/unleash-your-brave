import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  const UserEntity({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.status,
    this.mustChangePassword = false,
    this.photoUrl = '',
    this.title = '',
    this.business = '',
    this.industry = '',
    this.location = '',
    this.bio = '',
    this.goals = const [],
    this.interests = const [],
    this.networkingPrefs = 'open_to_all',
    this.linkedinUrl = '',
    this.instagramUrl = '',
    this.websiteUrl = '',
    this.profileCompleted = false,
  });

  final String id;
  final String email;
  final String name;
  final String role;
  final String status;
  final bool mustChangePassword;
  final String photoUrl;
  final String title;
  final String business;
  final String industry;
  final String location;
  final String bio;
  final List<String> goals;
  final List<String> interests;
  final String networkingPrefs;
  final String linkedinUrl;
  final String instagramUrl;
  final String websiteUrl;
  final bool profileCompleted;

  UserEntity copyWith({
    String? id,
    String? email,
    String? name,
    String? role,
    String? status,
    bool? mustChangePassword,
    String? photoUrl,
    String? title,
    String? business,
    String? industry,
    String? location,
    String? bio,
    List<String>? goals,
    List<String>? interests,
    String? networkingPrefs,
    String? linkedinUrl,
    String? instagramUrl,
    String? websiteUrl,
    bool? profileCompleted,
  }) {
    return UserEntity(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      role: role ?? this.role,
      status: status ?? this.status,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      photoUrl: photoUrl ?? this.photoUrl,
      title: title ?? this.title,
      business: business ?? this.business,
      industry: industry ?? this.industry,
      location: location ?? this.location,
      bio: bio ?? this.bio,
      goals: goals ?? this.goals,
      interests: interests ?? this.interests,
      networkingPrefs: networkingPrefs ?? this.networkingPrefs,
      linkedinUrl: linkedinUrl ?? this.linkedinUrl,
      instagramUrl: instagramUrl ?? this.instagramUrl,
      websiteUrl: websiteUrl ?? this.websiteUrl,
      profileCompleted: profileCompleted ?? this.profileCompleted,
    );
  }

  @override
  List<Object?> get props => [
        id,
        email,
        name,
        role,
        status,
        mustChangePassword,
        photoUrl,
        title,
        business,
        industry,
        location,
        bio,
        goals,
        interests,
        networkingPrefs,
        linkedinUrl,
        instagramUrl,
        websiteUrl,
        profileCompleted,
      ];
}
