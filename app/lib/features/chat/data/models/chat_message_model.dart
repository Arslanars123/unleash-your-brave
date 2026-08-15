import 'dart:convert';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_message_entity.dart';

class ChatReactionModel extends ChatReactionEntity {
  const ChatReactionModel({
    required super.emoji,
    required super.count,
    required super.reactedByMe,
  });

  factory ChatReactionModel.fromJson(Map<String, dynamic> json) {
    return ChatReactionModel(
      emoji: json['emoji'] as String,
      count: json['count'] as int,
      reactedByMe: json['reactedByMe'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'emoji': emoji,
      'count': count,
      'reactedByMe': reactedByMe,
    };
  }
}

class ChatMessageModel extends ChatMessageEntity {
  const ChatMessageModel({
    required super.id,
    required super.groupId,
    required super.senderId,
    required super.senderName,
    super.senderRole,
    super.senderPhotoUrl,
    super.clientId,
    required super.type,
    super.body,
    super.gifUrl,
    required super.createdAt,
    super.reactions = const [],
    required super.deliveryStatus,
  });

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    final reactions = (json['reactions'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>()
        .map((r) => ChatReactionModel.fromJson(r))
        .toList();

    return ChatMessageModel(
      id: json['id'] as String,
      groupId: json['groupId'] as String,
      senderId: json['senderId'] as String,
      senderName: json['senderName'] as String,
      senderRole: json['senderRole'] as String? ?? 'member',
      senderPhotoUrl: json['senderPhotoUrl'] as String?,
      clientId: json['clientId'] as String?,
      type: ChatMessageType.values.firstWhere(
        (t) => t.name == json['type'],
        orElse: () => ChatMessageType.text,
      ),
      body: json['body'] as String?,
      gifUrl: json['gifUrl'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      reactions: reactions,
      deliveryStatus: DeliveryStatus.values.firstWhere(
        (s) => s.name == json['deliveryStatus'],
        orElse: () => DeliveryStatus.sent,
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'groupId': groupId,
      'senderId': senderId,
      'senderName': senderName,
      'senderRole': senderRole,
      'senderPhotoUrl': senderPhotoUrl,
      'clientId': clientId,
      'type': type.name,
      'body': body,
      'gifUrl': gifUrl,
      'createdAt': createdAt.toIso8601String(),
      'reactions': reactions.map((r) => (r as ChatReactionModel).toJson()).toList(),
      'deliveryStatus': deliveryStatus.name,
    };
  }

  String encode() => jsonEncode(toJson());

  static ChatMessageModel decode(String source) {
    return ChatMessageModel.fromJson(jsonDecode(source) as Map<String, dynamic>);
  }

  @override
  ChatMessageModel copyWith({
    String? id,
    String? groupId,
    String? senderId,
    String? senderName,
    String? senderRole,
    String? senderPhotoUrl,
    String? clientId,
    ChatMessageType? type,
    String? body,
    String? gifUrl,
    DateTime? createdAt,
    List<ChatReactionEntity>? reactions,
    DeliveryStatus? deliveryStatus,
  }) {
    return ChatMessageModel(
      id: id ?? this.id,
      groupId: groupId ?? this.groupId,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      senderRole: senderRole ?? this.senderRole,
      senderPhotoUrl: senderPhotoUrl ?? this.senderPhotoUrl,
      clientId: clientId ?? this.clientId,
      type: type ?? this.type,
      body: body ?? this.body,
      gifUrl: gifUrl ?? this.gifUrl,
      createdAt: createdAt ?? this.createdAt,
      reactions: reactions ?? this.reactions,
      deliveryStatus: deliveryStatus ?? this.deliveryStatus,
    );
  }
}