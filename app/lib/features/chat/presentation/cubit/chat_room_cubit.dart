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
  });

  final List<ChatMessageEntity> messages;
  final bool loading;
  final bool loadingMore;
  final bool sending;
  final String? error;
  final int newMessageCountWhileScrolledUp;
  final bool isNearBottom;

  ChatRoomState copyWith({
    List<ChatMessageEntity>? messages,
    bool? loading,
    bool? loadingMore,
    bool? sending,
    String? error,
    int? newMessageCountWhileScrolledUp,
    bool? isNearBottom,
  }) {
    return ChatRoomState(
      messages: messages ?? this.messages,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      sending: sending ?? this.sending,
      error: error,
      newMessageCountWhileScrolledUp: newMessageCountWhileScrolledUp ?? this.newMessageCountWhileScrolledUp,
      isNearBottom: isNearBottom ?? this.isNearBottom,
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

  Future<void> loadInitial() async {
    if (state.loading) return;

    emit(state.copyWith(loading: true, error: null));

    final result = await _repository.getMessages(limit: 30);
    result.fold(
      (failure) => emit(state.copyWith(loading: false, error: failure.message)),
      (messages) {
        // Messages come in reverse chronological order, so reverse for chronological display
        final chronologicalMessages = messages.reversed.toList();
        emit(state.copyWith(
          loading: false,
          messages: chronologicalMessages,
          error: null,
        ));
        _connectSse();
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
          // Prepend older messages (they come in reverse chronological order)
          final chronologicalOlder = olderMessages.reversed.toList();
          final allMessages = [...chronologicalOlder, ...state.messages];
          emit(state.copyWith(
            loadingMore: false,
            messages: allMessages,
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

  Future<void> sendGif(String gifUrl) async {
    if (gifUrl.isEmpty || state.sending) return;

    await _sendMessage(ChatMessageType.gif, gifUrl: gifUrl);
  }

  Future<void> _sendMessage(ChatMessageType type, {String? body, String? gifUrl}) async {
    emit(state.copyWith(sending: true, error: null));

    final clientId = _uuid.v4();
    final now = DateTime.now();

    // Create optimistic pending message
    final pendingMessage = ChatMessageEntity(
      id: clientId, // Temporary ID
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

    // Add optimistic message to UI
    final updatedMessages = [...state.messages, pendingMessage];
    emit(state.copyWith(messages: updatedMessages, sending: false));

    // Send to backend
    final result = await _repository.sendMessage(
      clientId: clientId,
      type: type,
      body: body,
      gifUrl: gifUrl,
    );

    result.fold(
      (failure) {
        // Remove optimistic message on failure
        final filteredMessages = state.messages.where((m) => m.clientId != clientId).toList();
        emit(state.copyWith(
          messages: filteredMessages,
          error: failure.message,
        ));
      },
      (sentMessage) {
        // Replace optimistic message with real message
        final updatedMessages = state.messages.map((m) {
          if (m.clientId == clientId) {
            return sentMessage;
          }
          return m;
        }).toList();
        emit(state.copyWith(messages: updatedMessages));
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
      (_) {}, // Success handled by SSE event
    );
  }

  Future<void> removeReaction(String messageId) async {
    final result = await _repository.removeReaction(messageId);
    result.fold(
      (failure) => emit(state.copyWith(error: failure.message)),
      (_) {}, // Success handled by SSE event
    );
  }

  void updateScrollPosition(bool isNearBottom) {
    if (state.isNearBottom != isNearBottom) {
      emit(state.copyWith(
        isNearBottom: isNearBottom,
        newMessageCountWhileScrolledUp: isNearBottom ? 0 : state.newMessageCountWhileScrolledUp,
      ));
    }
  }

  void _connectSse() {
    if (_running) return;
    _running = true;
    
    _sseSub?.cancel();
    _sseSub = _repository.getEventStream().listen(
      (event) {
        _handleSseEvent(event);
      },
      onError: (_) => _scheduleReconnect(),
      onDone: () => _scheduleReconnect(),
    );
  }

  void _handleSseEvent(Map<String, dynamic> event) {
    final type = event['type'] as String?;
    
    switch (type) {
      case 'message.created':
        _handleMessageCreated(event);
        break;
      case 'receipt.delivered':
        _handleReceiptDelivered(event);
        break;
      case 'receipt.read':
        _handleReceiptRead(event);
        break;
      case 'reaction.added':
      case 'reaction.removed':
        _handleReactionUpdated(event);
        break;
    }
  }

  void _handleMessageCreated(Map<String, dynamic> event) {
    try {
      final messageData = event['message'] as Map<String, dynamic>?;
      if (messageData == null) return;

      final message = ChatMessageEntity(
        id: messageData['id'] as String,
        groupId: messageData['groupId'] as String,
        senderId: messageData['senderId'] as String,
        senderName: messageData['senderName'] as String,
        senderPhotoUrl: messageData['senderPhotoUrl'] as String?,
        type: messageData['type'] == 'gif' ? ChatMessageType.gif : ChatMessageType.text,
        body: messageData['body'] as String?,
        gifUrl: messageData['gifUrl'] as String?,
        createdAt: DateTime.parse(messageData['createdAt'] as String),
        deliveryStatus: DeliveryStatus.sent,
      );

      final isMine = message.senderId == _currentUserId;

      if (isMine) {
        // Replace optimistic message if it exists
        final updatedMessages = state.messages.map((m) {
          if (m.clientId != null && m.senderId == _currentUserId && 
              m.createdAt.difference(message.createdAt).abs() < const Duration(seconds: 5)) {
            return message;
          }
          return m;
        }).toList();
        emit(state.copyWith(messages: updatedMessages));
      } else {
        // New message from others
        final updatedMessages = [...state.messages, message];
        
        // Mark as delivered for sender
        markDelivered(message.id);
        
        // Update unread count if not near bottom
        final newCount = state.isNearBottom ? 0 : state.newMessageCountWhileScrolledUp + 1;
        
        emit(state.copyWith(
          messages: updatedMessages,
          newMessageCountWhileScrolledUp: newCount,
        ));
      }
    } catch (e) {
      // Skip malformed message events
    }
  }

  void _handleReceiptDelivered(Map<String, dynamic> event) {
    final messageId = event['messageId'] as String?;
    if (messageId == null) return;

    _updateMessageDeliveryStatus(messageId, DeliveryStatus.delivered);
  }

  void _handleReceiptRead(Map<String, dynamic> event) {
    final messageId = event['messageId'] as String?;
    if (messageId == null) return;

    _updateMessageDeliveryStatus(messageId, DeliveryStatus.read);
  }

  void _updateMessageDeliveryStatus(String messageId, DeliveryStatus status) {
    final updatedMessages = state.messages.map((m) {
      if (m.id == messageId && m.senderId == _currentUserId) {
        return m.copyWith(deliveryStatus: status);
      }
      return m;
    }).toList();

    if (updatedMessages != state.messages) {
      emit(state.copyWith(messages: updatedMessages));
    }
  }

  void _handleReactionUpdated(Map<String, dynamic> event) {
    // TODO: Implement reaction updates when message model includes reactions
    // This would require updating the message with new reaction counts
  }

  Future<void> syncSince(DateTime since) async {
    final result = await _repository.sync(since);
    result.fold(
      (failure) => emit(state.copyWith(error: failure.message)),
      (syncData) {
        // Handle sync response - could include new messages, reactions, etc.
        // For now, just refresh by reloading
        loadInitial();
      },
    );
  }

  void flushPending() {
    // Remove any pending messages that failed to send
    final nonPendingMessages = state.messages.where((m) {
      return m.id != m.clientId; // Real messages have different id than clientId
    }).toList();
    
    if (nonPendingMessages.length != state.messages.length) {
      emit(state.copyWith(messages: nonPendingMessages));
    }
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), _connectSse);
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