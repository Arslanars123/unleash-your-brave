import 'package:equatable/equatable.dart';

enum ChatMessageType { text, gif }

enum DeliveryStatus { sent, delivered, read }

class ChatReactionEntity extends Equatable {
  const ChatReactionEntity({
    required this.emoji,
    required this.count,
    required this.reactedByMe,
  });

  final String emoji;
  final int count;
  final bool reactedByMe;

  @override
  List<Object?> get props => [emoji, count, reactedByMe];
}

class ChatMessageEntity extends Equatable {
  const ChatMessageEntity({
    required this.id,
    required this.groupId,
    required this.senderId,
    required this.senderName,
    this.senderPhotoUrl,
    this.clientId,
    required this.type,
    this.body,
    this.gifUrl,
    required this.createdAt,
    this.reactions = const [],
    required this.deliveryStatus,
  });

  final String id;
  final String groupId;
  final String senderId;
  final String senderName;
  final String? senderPhotoUrl;
  final String? clientId;
  final ChatMessageType type;
  final String? body;
  final String? gifUrl;
  final DateTime createdAt;
  final List<ChatReactionEntity> reactions;
  final DeliveryStatus deliveryStatus;

  // Note: UI will pass currentUserId and compare senderId
  // This getter is deprecated and should not be used
  @Deprecated('Use senderId comparison in UI with currentUserId')
  bool get isFromMe => false;

  ChatMessageEntity copyWith({
    String? id,
    String? groupId,
    String? senderId,
    String? senderName,
    String? senderPhotoUrl,
    String? clientId,
    ChatMessageType? type,
    String? body,
    String? gifUrl,
    DateTime? createdAt,
    List<ChatReactionEntity>? reactions,
    DeliveryStatus? deliveryStatus,
  }) {
    return ChatMessageEntity(
      id: id ?? this.id,
      groupId: groupId ?? this.groupId,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
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

  @override
  List<Object?> get props => [
        id,
        groupId,
        senderId,
        senderName,
        senderPhotoUrl,
        clientId,
        type,
        body,
        gifUrl,
        createdAt,
        reactions,
        deliveryStatus,
      ];
}