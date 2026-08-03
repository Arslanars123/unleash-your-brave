import 'package:equatable/equatable.dart';

class ChatMemberEntity extends Equatable {
  const ChatMemberEntity({
    required this.id,
    required this.name,
    this.photoUrl,
    this.title,
    this.business,
  });

  final String id;
  final String name;
  final String? photoUrl;
  final String? title;
  final String? business;

  @override
  List<Object?> get props => [
        id,
        name,
        photoUrl,
        title,
        business,
      ];
}