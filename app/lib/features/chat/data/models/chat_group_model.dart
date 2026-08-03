import 'dart:convert';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_group_entity.dart';

class ChatGroupModel extends ChatGroupEntity {
  const ChatGroupModel({
    required super.id,
    required super.name,
    required super.memberCount,
    required super.unreadCount,
    super.lastMessagePreview,
  });

  factory ChatGroupModel.fromJson(Map<String, dynamic> json) {
    final last = json['lastMessage'];
    String? preview;
    if (last is Map<String, dynamic>) {
      final type = last['type'] as String? ?? 'text';
      final sender = last['senderName'] as String? ?? '';
      if (type == 'gif') {
        preview = '$sender: GIF';
      } else {
        final body = (last['body'] as String? ?? '').trim();
        preview = body.isEmpty ? null : '$sender: $body';
      }
    } else if (last is String) {
      preview = last;
    }

    return ChatGroupModel(
      id: json['id'] as String,
      name: json['name'] as String,
      memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      lastMessagePreview: preview,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'memberCount': memberCount,
      'unreadCount': unreadCount,
      'lastMessagePreview': lastMessagePreview,
    };
  }

  String encode() => jsonEncode(toJson());

  static ChatGroupModel decode(String source) {
    return ChatGroupModel.fromJson(jsonDecode(source) as Map<String, dynamic>);
  }
}
