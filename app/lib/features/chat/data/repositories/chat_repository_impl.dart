import 'package:dartz/dartz.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/error/failures.dart';
import 'package:unleash_your_brave/features/chat/data/datasources/chat_local_datasource.dart';
import 'package:unleash_your_brave/features/chat/data/datasources/chat_remote_datasource.dart';
import 'package:unleash_your_brave/features/chat/data/models/chat_message_model.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_group_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_member_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_message_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/repositories/chat_repository.dart';

class ChatRepositoryImpl implements ChatRepository {
  ChatRepositoryImpl({
    required this.remote,
    required this.local,
  });

  final ChatRemoteDataSource remote;
  final ChatLocalDataSource local;

  @override
  Future<Either<Failure, ChatGroupEntity>> getGroup() async {
    try {
      final group = await remote.getGroup();
      await local.cacheGroup(group);
      return Right(group);
    } on NetworkException {
      final cached = local.getCachedGroup();
      if (cached != null) {
        return Right(cached);
      }
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, List<ChatMemberEntity>>> getMembers({
    required int page,
    required int perPage,
  }) async {
    try {
      final members = await remote.getMembers(page: page, perPage: perPage);
      return Right(members);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, List<ChatMessageEntity>>> getMessages({
    String? before,
    required int limit,
  }) async {
    try {
      final messages = await remote.getMessages(before: before, limit: limit);
      return Right(messages);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, ChatMessageEntity>> sendMessage({
    required String clientId,
    required ChatMessageType type,
    String? body,
    String? gifUrl,
  }) async {
    try {
      final message = await remote.sendMessage(
        clientId: clientId,
        type: type.name,
        body: body,
        gifUrl: gifUrl,
      );
      // Remove from pending queue if it was there
      await local.removePendingMessage(clientId);
      return Right(message);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, void>> markDelivered(String messageId) async {
    try {
      await remote.markDelivered(messageId);
      return const Right(null);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, void>> markRead(String messageId) async {
    try {
      await remote.markRead(messageId);
      return const Right(null);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, void>> addReaction({
    required String messageId,
    required String emoji,
  }) async {
    try {
      await remote.addReaction(messageId: messageId, emoji: emoji);
      return const Right(null);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, void>> removeReaction(String messageId) async {
    try {
      await remote.removeReaction(messageId);
      return const Right(null);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> sync(DateTime since) async {
    try {
      final syncData = await remote.sync(since);
      await local.setLastSync(DateTime.now());
      return Right(syncData);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, void>> registerDevice({
    required String token,
    required String platform,
  }) async {
    try {
      await remote.registerDevice(token: token, platform: platform);
      await local.saveFCMToken(token);
      return const Right(null);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, void>> unregisterDevice(String token) async {
    try {
      await remote.unregisterDevice(token);
      return const Right(null);
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Stream<Map<String, dynamic>> getEventStream() {
    return remote.getEventStream();
  }

  @override
  ChatGroupEntity? getCachedGroup() {
    return local.getCachedGroup();
  }

  @override
  List<ChatMessageEntity> getPendingMessages() {
    return local.getPendingMessages();
  }

  @override
  Future<void> addPendingMessage(ChatMessageEntity message) async {
    await local.addPendingMessage(message as ChatMessageModel);
  }

  @override
  Future<void> removePendingMessage(String clientId) async {
    await local.removePendingMessage(clientId);
  }

  @override
  Future<void> clearPendingMessages() async {
    await local.clearPendingMessages();
  }

  @override
  int getUnreadCount() {
    return local.getUnreadCount();
  }

  @override
  Future<void> setUnreadCount(int count) async {
    await local.setUnreadCount(count);
  }

  @override
  DateTime? getLastSync() {
    return local.getLastSync();
  }

  @override
  Future<void> setLastSync(DateTime sync) async {
    await local.setLastSync(sync);
  }

  @override
  String? getFCMToken() {
    return local.getFCMToken();
  }

  @override
  Future<void> saveFCMToken(String token) async {
    await local.saveFCMToken(token);
  }
}