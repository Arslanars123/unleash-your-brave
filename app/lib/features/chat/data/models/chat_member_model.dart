import 'dart:convert';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_member_entity.dart';

class ChatMemberModel extends ChatMemberEntity {
  const ChatMemberModel({
    required super.id,
    required super.name,
    super.photoUrl,
    super.title,
    super.business,
  });

  factory ChatMemberModel.fromJson(Map<String, dynamic> json) {
    return ChatMemberModel(
      id: json['id'] as String,
      name: json['name'] as String,
      photoUrl: json['photoUrl'] as String?,
      title: json['title'] as String?,
      business: json['business'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'photoUrl': photoUrl,
      'title': title,
      'business': business,
    };
  }

  String encode() => jsonEncode(toJson());

  static ChatMemberModel decode(String source) {
    return ChatMemberModel.fromJson(jsonDecode(source) as Map<String, dynamic>);
  }
}