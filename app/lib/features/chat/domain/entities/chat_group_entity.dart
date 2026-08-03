import 'package:equatable/equatable.dart';

class ChatGroupEntity extends Equatable {
  const ChatGroupEntity({
    required this.id,
    required this.name,
    required this.memberCount,
    required this.unreadCount,
    this.lastMessagePreview,
  });

  final String id;
  final String name;
  final int memberCount;
  final int unreadCount;
  final String? lastMessagePreview;

  ChatGroupEntity copyWith({
    String? id,
    String? name,
    int? memberCount,
    int? unreadCount,
    String? lastMessagePreview,
  }) {
    return ChatGroupEntity(
      id: id ?? this.id,
      name: name ?? this.name,
      memberCount: memberCount ?? this.memberCount,
      unreadCount: unreadCount ?? this.unreadCount,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        memberCount,
        unreadCount,
        lastMessagePreview,
      ];
}
