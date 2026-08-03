import 'package:dartz/dartz.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_group_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_member_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_message_entity.dart';

abstract class ChatRepository {
  Future<Either<Failure, ChatGroupEntity>> getGroup();
  Future<Either<Failure, List<ChatMemberEntity>>> getMembers({
    required int page,
    required int perPage,
  });
  Future<Either<Failure, List<ChatMessageEntity>>> getMessages({
    String? before,
    required int limit,
  });
  Future<Either<Failure, ChatMessageEntity>> sendMessage({
    required String clientId,
    required ChatMessageType type,
    String? body,
    String? gifUrl,
  });
  Future<Either<Failure, void>> markDelivered(String messageId);
  Future<Either<Failure, void>> markRead(String messageId);
  Future<Either<Failure, void>> addReaction({
    required String messageId,
    required String emoji,
  });
  Future<Either<Failure, void>> removeReaction(String messageId);
  Future<Either<Failure, Map<String, dynamic>>> sync(DateTime since);
  Future<Either<Failure, void>> registerDevice({
    required String token,
    required String platform,
  });
  Future<Either<Failure, void>> unregisterDevice(String token);
  
  // Stream for real-time events
  Stream<Map<String, dynamic>> getEventStream();
  
  // Local cache/offline methods
  ChatGroupEntity? getCachedGroup();
  List<ChatMessageEntity> getPendingMessages();
  Future<void> addPendingMessage(ChatMessageEntity message);
  Future<void> removePendingMessage(String clientId);
  Future<void> clearPendingMessages();
  int getUnreadCount();
  Future<void> setUnreadCount(int count);
  DateTime? getLastSync();
  Future<void> setLastSync(DateTime sync);
  String? getFCMToken();
  Future<void> saveFCMToken(String token);
}