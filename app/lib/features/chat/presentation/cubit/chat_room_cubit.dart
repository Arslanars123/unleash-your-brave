import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_message_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/repositories/chat_repository.dart';

class ChatRoomState extends Equatable {
  const ChatRoomState({
    this.messages = const [],
    this.loading = false,
    this.loadingMore = false,
    this.sending = false,
    this.error,
    this.newMessageCountWhileScrolledUp = 0,
    this.isNearBottom = true,
    this.realtimeConnected = false,
  });

  final List<ChatMessageEntity> messages;
  final bool loading;
  final bool loadingMore;
  final bool sending;
  final String? error;
  final int newMessageCountWhileScrolledUp;
  final bool isNearBottom;
  final bool realtimeConnected;

  ChatRoomState copyWith({
    List<ChatMessageEntity>? messages,
    bool? loading,
    bool? loadingMore,
    bool? sending,
    String? error,
    int? newMessageCountWhileScrolledUp,
    bool? isNearBottom,
    bool? realtimeConnected,
  }) {
    return ChatRoomState(
      messages: messages ?? this.messages,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      sending: sending ?? this.sending,
      error: error,
      newMessageCountWhileScrolledUp:
          newMessageCountWhileScrolledUp ?? this.newMessageCountWhileScrolledUp,
      isNearBottom: isNearBottom ?? this.isNearBottom,
      realtimeConnected: realtimeConnected ?? this.realtimeConnected,
    );
  }

  @override
  List<Object?> get props => [
        messages,
        loading,
        loadingMore,
        sending,
        error,
        newMessageCountWhileScrolledUp,
        isNearBottom,
        realtimeConnected,
      ];
}

class ChatRoomCubit extends Cubit<ChatRoomState> {
  ChatRoomCubit(this._repository, this._currentUserId) : super(const ChatRoomState());

  final ChatRepository _repository;
  final String _currentUserId;
  final _uuid = const Uuid();

  StreamSubscription<Map<String, dynamic>>? _sseSub;
  Timer? _reconnectTimer;
  bool _running = false;
  bool _catchingUp = false;
  DateTime? _lastEventAt;

  Future<void> loadInitial() async {
    if (state.loading) return;

    emit(state.copyWith(loading: true, error: null));

    final result = await _repository.getMessages(limit: 40);
    result.fold(
      (failure) => emit(state.copyWith(loading: false, error: failure.message)),
      (messages) {
        final sorted = _sortedByTimestamp(messages);
        if (sorted.isNotEmpty) {
          _lastEventAt = sorted.last.createdAt;
        }
        emit(state.copyWith(
          loading: false,
          messages: sorted,
          error: null,
        ));
        _startRealtime();
      },
    );
  }

  Future<void> loadOlder() async {
    if (state.loadingMore || state.messages.isEmpty) return;

    emit(state.copyWith(loadingMore: true, error: null));

    final oldestMessage = state.messages.first;
    final result = await _repository.getMessages(
      before: oldestMessage.id,
      limit: 20,
    );

    result.fold(
      (failure) => emit(state.copyWith(loadingMore: false, error: failure.message)),
      (olderMessages) {
        if (olderMessages.isNotEmpty) {
          final byId = <String, ChatMessageEntity>{
            for (final m in state.messages) m.id: m,
          };
          for (final m in olderMessages) {
            byId[m.id] = m;
          }
          emit(state.copyWith(
            loadingMore: false,
            messages: _sortedByTimestamp(byId.values.toList()),
            error: null,
          ));
        } else {
          emit(state.copyWith(loadingMore: false));
        }
      },
    );
  }

  Future<void> sendText(String body) async {
    if (body.trim().isEmpty || state.sending) return;

    await _sendMessage(ChatMessageType.text, body: body.trim());
  }

  Future<void> _sendMessage(ChatMessageType type, {String? body, String? gifUrl}) async {
    emit(state.copyWith(sending: true, error: null));

    final clientId = _uuid.v4();
    final now = DateTime.now();

    final pendingMessage = ChatMessageEntity(
      id: clientId,
      groupId: 'temp-group-id',
      senderId: _currentUserId,
      senderName: 'You',
      clientId: clientId,
      type: type,
      body: body,
      gifUrl: gifUrl,
      createdAt: now,
      deliveryStatus: DeliveryStatus.sent,
    );

    emit(state.copyWith(
      messages: _sortedByTimestamp([...state.messages, pendingMessage]),
      isNearBottom: true,
      newMessageCountWhileScrolledUp: 0,
    ));

    final result = await _repository.sendMessage(
      clientId: clientId,
      type: type,
      body: body,
      gifUrl: gifUrl,
    );

    result.fold(
      (failure) {
        final filteredMessages =
            state.messages.where((m) => m.clientId != clientId).toList();
        emit(state.copyWith(
          messages: _sortedByTimestamp(filteredMessages),
          sending: false,
          error: failure.message,
        ));
      },
      (sentMessage) {
        _lastEventAt = sentMessage.createdAt;
        final updatedMessages = state.messages.map((m) {
          if (m.clientId == clientId || m.id == clientId) {
            return sentMessage;
          }
          return m;
        }).toList();
        final hasMatch = updatedMessages.any((m) => m.id == sentMessage.id);
        emit(state.copyWith(
          messages: _sortedByTimestamp(
            hasMatch ? updatedMessages : [...updatedMessages, sentMessage],
          ),
          sending: false,
          error: null,
        ));
      },
    );
  }

  void markVisibleRead(String messageId) {
    _repository.markRead(messageId);
  }

  void markDelivered(String messageId) {
    _repository.markDelivered(messageId);
  }

  Future<void> addReaction(String messageId, String emoji) async {
    final result = await _repository.addReaction(messageId: messageId, emoji: emoji);
    result.fold(
      (failure) => emit(state.copyWith(error: failure.message)),
      (_) {},
    );
  }

  Future<void> removeReaction(String messageId) async {
    final result = await _repository.removeReaction(messageId);
    result.fold(
      (failure) => emit(state.copyWith(error: failure.message)),
      (_) {},
    );
  }

  void updateScrollPosition(bool isNearBottom) {
    if (state.isNearBottom == isNearBottom &&
        !(isNearBottom && state.newMessageCountWhileScrolledUp > 0)) {
      return;
    }
    emit(state.copyWith(
      isNearBottom: isNearBottom,
      newMessageCountWhileScrolledUp:
          isNearBottom ? 0 : state.newMessageCountWhileScrolledUp,
    ));
  }

  void clearScrolledUpUnread() {
    if (state.newMessageCountWhileScrolledUp == 0 && state.isNearBottom) return;
    emit(state.copyWith(
      isNearBottom: true,
      newMessageCountWhileScrolledUp: 0,
    ));
  }

  void _startRealtime() {
    if (_running) return;
    _running = true;
    _connectRealtime();
  }

  void _connectRealtime() {
    if (!_running) return;
    _sseSub?.cancel();
    _sseSub = _repository.getEventStream().listen(
      (event) {
        if (!state.realtimeConnected) {
          emit(state.copyWith(realtimeConnected: true));
          // Catch anything missed while the stream was down.
          unawaited(_catchUpSinceLastEvent());
        }
        _handleSseEvent(event);
      },
      onError: (_) {
        emit(state.copyWith(realtimeConnected: false));
        _scheduleReconnect();
      },
      onDone: () {
        emit(state.copyWith(realtimeConnected: false));
        _scheduleReconnect();
      },
      cancelOnError: true,
    );
  }

  Future<void> _catchUpSinceLastEvent() async {
    if (_catchingUp || isClosed) return;
    final since = _lastEventAt?.subtract(const Duration(seconds: 2));
    if (since == null) {
      // No cursor yet — pull latest page.
      final result = await _repository.getMessages(limit: 40);
      if (isClosed) return;
      result.fold((_) {}, (messages) {
        _mergeMessages(messages, countForeignAsUnread: false);
      });
      return;
    }

    _catchingUp = true;
    try {
      final result = await _repository.sync(since);
      if (isClosed) return;
      result.fold((_) {}, (syncData) {
        final raw = syncData['messages'];
        if (raw is! List) return;
        final messages = raw
            .whereType<Map<String, dynamic>>()
            .map(_messageFromJson)
            .whereType<ChatMessageEntity>()
            .toList();
        _mergeMessages(messages, countForeignAsUnread: true);
      });
    } finally {
      _catchingUp = false;
    }
  }

  void _mergeMessages(
    List<ChatMessageEntity> incoming, {
    required bool countForeignAsUnread,
  }) {
    if (incoming.isEmpty) return;
    final byId = <String, ChatMessageEntity>{
      for (final m in state.messages) m.id: m,
    };
    var addedForeign = 0;
    for (final m in incoming) {
      final isNew = !byId.containsKey(m.id);
      byId[m.id] = m;
      if (m.createdAt.isAfter(_lastEventAt ?? DateTime.fromMillisecondsSinceEpoch(0))) {
        _lastEventAt = m.createdAt;
      }
      if (isNew && countForeignAsUnread && m.senderId != _currentUserId) {
        addedForeign += 1;
        markDelivered(m.id);
        if (state.isNearBottom) {
          markVisibleRead(m.id);
        }
      }
      byId.removeWhere(
        (key, value) =>
            value.clientId != null &&
            value.clientId == m.clientId &&
            value.id != m.id,
      );
    }
    final stickToBottom = state.isNearBottom;
    emit(state.copyWith(
      messages: _sortedByTimestamp(byId.values.toList()),
      newMessageCountWhileScrolledUp: stickToBottom
          ? 0
          : state.newMessageCountWhileScrolledUp + addedForeign,
    ));
  }

  void _handleSseEvent(Map<String, dynamic> event) {
    final type = event['type'] as String?;

    switch (type) {
      case 'message.created':
        _handleMessageCreated(event);
        break;
      case 'message.deleted':
        _handleMessageDeleted(event);
        break;
      case 'receipt.delivered':
        _handleReceiptDelivered(event);
        break;
      case 'receipt.read':
        _handleReceiptRead(event);
        break;
      case 'reaction.updated':
        _handleReactionUpdated(event);
        break;
      case 'connected':
        unawaited(_catchUpSinceLastEvent());
        break;
    }
  }

  Map<String, dynamic> _payload(Map<String, dynamic> event) {
    final payload = event['payload'];
    if (payload is Map<String, dynamic>) return payload;
    return event;
  }

  void _handleMessageDeleted(Map<String, dynamic> event) {
    final payload = _payload(event);
    final messageId = payload['messageId'] as String?;
    if (messageId == null) return;
    emit(state.copyWith(
      messages: state.messages.where((m) => m.id != messageId).toList(),
    ));
  }

  ChatMessageEntity? _messageFromJson(Map<String, dynamic> messageData) {
    try {
      final reactionsRaw = messageData['reactions'];
      final reactions = reactionsRaw is List
          ? reactionsRaw
              .whereType<Map<String, dynamic>>()
              .map(
                (r) => ChatReactionEntity(
                  emoji: r['emoji'] as String? ?? '',
                  count: (r['count'] as num?)?.toInt() ?? 0,
                  reactedByMe: r['reactedByMe'] as bool? ?? false,
                ),
              )
              .toList()
          : const <ChatReactionEntity>[];

      final delivery = messageData['deliveryStatus'] as String?;
      return ChatMessageEntity(
        id: messageData['id'] as String,
        groupId: messageData['groupId'] as String,
        senderId: messageData['senderId'] as String,
        senderName: messageData['senderName'] as String? ?? 'Member',
        senderRole: messageData['senderRole'] as String? ?? 'member',
        senderPhotoUrl: messageData['senderPhotoUrl'] as String?,
        clientId: messageData['clientId'] as String?,
        type: messageData['type'] == 'gif' ? ChatMessageType.gif : ChatMessageType.text,
        body: messageData['body'] as String?,
        gifUrl: messageData['gifUrl'] as String?,
        createdAt: DateTime.parse(messageData['createdAt'] as String),
        reactions: reactions,
        deliveryStatus: switch (delivery) {
          'delivered' => DeliveryStatus.delivered,
          'read' => DeliveryStatus.read,
          _ => DeliveryStatus.sent,
        },
      );
    } catch (_) {
      return null;
    }
  }

  void _handleMessageCreated(Map<String, dynamic> event) {
    final payload = _payload(event);
    final messageData = payload['message'] as Map<String, dynamic>?;
    if (messageData == null) return;

    final message = _messageFromJson(messageData);
    if (message == null) return;

    _lastEventAt = message.createdAt;
    final serverClientId = message.clientId;
    final isMine = message.senderId == _currentUserId;

    if (isMine) {
      final updatedMessages = state.messages.map((m) {
        final matchesOptimistic = (serverClientId != null && m.clientId == serverClientId) ||
            m.id == message.id ||
            (m.senderId == _currentUserId &&
                m.clientId != null &&
                m.id == m.clientId &&
                m.createdAt.difference(message.createdAt).abs() <
                    const Duration(seconds: 8));
        return matchesOptimistic ? message : m;
      }).toList();
      final hasMatch = updatedMessages.any((m) => m.id == message.id);
      emit(state.copyWith(
        messages: _sortedByTimestamp(
          hasMatch ? updatedMessages : [...updatedMessages, message],
        ),
        isNearBottom: true,
        newMessageCountWhileScrolledUp: 0,
      ));
    } else {
      if (state.messages.any((m) => m.id == message.id)) return;

      markDelivered(message.id);

      final stickToBottom = state.isNearBottom;
      final newCount =
          stickToBottom ? 0 : state.newMessageCountWhileScrolledUp + 1;

      emit(state.copyWith(
        messages: _sortedByTimestamp([...state.messages, message]),
        newMessageCountWhileScrolledUp: newCount,
      ));

      if (stickToBottom) {
        markVisibleRead(message.id);
      }
    }
  }

  void _handleReceiptDelivered(Map<String, dynamic> event) {
    final payload = _payload(event);
    final messageId = payload['messageId'] as String?;
    if (messageId == null) return;
    _updateMessageDeliveryStatus(messageId, DeliveryStatus.delivered);
  }

  void _handleReceiptRead(Map<String, dynamic> event) {
    final payload = _payload(event);
    final messageId = payload['messageId'] as String?;
    if (messageId == null) return;
    _updateMessageDeliveryStatus(messageId, DeliveryStatus.read);
  }

  void _updateMessageDeliveryStatus(String messageId, DeliveryStatus status) {
    var changed = false;
    final updatedMessages = state.messages.map((m) {
      if (m.id == messageId && m.senderId == _currentUserId) {
        if (m.deliveryStatus == DeliveryStatus.read) return m;
        if (m.deliveryStatus == status) return m;
        if (status == DeliveryStatus.delivered &&
            m.deliveryStatus == DeliveryStatus.read) {
          return m;
        }
        changed = true;
        return m.copyWith(deliveryStatus: status);
      }
      return m;
    }).toList();

    if (changed) {
      emit(state.copyWith(messages: updatedMessages));
    }
  }

  void _handleReactionUpdated(Map<String, dynamic> event) {
    final payload = _payload(event);
    final messageData = payload['message'] as Map<String, dynamic>?;
    if (messageData == null) return;
    final updated = _messageFromJson(messageData);
    if (updated == null) return;

    final messages = state.messages.map((m) {
      if (m.id == updated.id) {
        return m.copyWith(reactions: updated.reactions);
      }
      return m;
    }).toList();
    emit(state.copyWith(messages: messages));
  }

  Future<void> syncSince(DateTime since) async {
    final result = await _repository.sync(since);
    result.fold(
      (failure) => emit(state.copyWith(error: failure.message)),
      (syncData) {
        final raw = syncData['messages'];
        if (raw is! List) return;
        final messages = raw
            .whereType<Map<String, dynamic>>()
            .map(_messageFromJson)
            .whereType<ChatMessageEntity>()
            .toList();
        _mergeMessages(messages, countForeignAsUnread: true);
      },
    );
  }

  void flushPending() {
    final nonPendingMessages = state.messages.where((m) {
      return m.id != m.clientId;
    }).toList();

    if (nonPendingMessages.length != state.messages.length) {
      emit(state.copyWith(messages: _sortedByTimestamp(nonPendingMessages)));
    }
  }

  List<ChatMessageEntity> _sortedByTimestamp(List<ChatMessageEntity> messages) {
    final sorted = [...messages];
    sorted.sort((a, b) {
      final delta = a.createdAt.compareTo(b.createdAt);
      if (delta != 0) return delta;
      return a.id.compareTo(b.id);
    });
    return sorted;
  }

  void _scheduleReconnect() {
    if (!_running || isClosed) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), _connectRealtime);
  }

  void stop() {
    _running = false;
    _sseSub?.cancel();
    _sseSub = null;
    _reconnectTimer?.cancel();
  }

  @override
  Future<void> close() async {
    stop();
    return super.close();
  }
}
