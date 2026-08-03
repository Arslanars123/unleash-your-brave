import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_group_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/repositories/chat_repository.dart';

class ChatUnreadState extends Equatable {
  const ChatUnreadState({
    this.unreadCount = 0,
    this.group,
    this.connected = false,
  });

  final int unreadCount;
  final ChatGroupEntity? group;
  final bool connected;

  ChatUnreadState copyWith({
    int? unreadCount,
    ChatGroupEntity? group,
    bool? connected,
  }) {
    return ChatUnreadState(
      unreadCount: unreadCount ?? this.unreadCount,
      group: group ?? this.group,
      connected: connected ?? this.connected,
    );
  }

  @override
  List<Object?> get props => [unreadCount, group, connected];
}

/// Keeps Network-tab badge + SSE connection alive while signed in.
class ChatUnreadCubit extends Cubit<ChatUnreadState> {
  ChatUnreadCubit(this._repository) : super(const ChatUnreadState());

  final ChatRepository _repository;
  StreamSubscription<Map<String, dynamic>>? _sseSub;
  Timer? _reconnectTimer;
  Timer? _pollTimer;
  bool _running = false;

  Future<void> start() async {
    if (_running) return;
    _running = true;
    await refresh();
    _connectSse();
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 45), (_) => refresh());
  }

  Future<void> stop() async {
    _running = false;
    await _sseSub?.cancel();
    _sseSub = null;
    _reconnectTimer?.cancel();
    _pollTimer?.cancel();
    emit(const ChatUnreadState());
  }

  Future<void> refresh() async {
    final result = await _repository.getGroup();
    result.fold(
      (_) {},
      (group) {
        emit(state.copyWith(group: group, unreadCount: group.unreadCount));
        _repository.setUnreadCount(group.unreadCount);
      },
    );
  }

  void clearUnreadLocally() {
    emit(state.copyWith(unreadCount: 0));
    _repository.setUnreadCount(0);
  }

  void _connectSse() {
    _sseSub?.cancel();
    _sseSub = _repository.getEventStream().listen(
      (event) async {
        emit(state.copyWith(connected: true));
        final type = event['type'] as String?;
        if (type == 'message.created' ||
            type == 'group.updated' ||
            type == 'receipt.read') {
          await refresh();
        }
      },
      onError: (_) {
        emit(state.copyWith(connected: false));
        _scheduleReconnect();
      },
      onDone: () {
        emit(state.copyWith(connected: false));
        _scheduleReconnect();
      },
    );
  }

  void _scheduleReconnect() {
    if (!_running) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), _connectSse);
  }

  @override
  Future<void> close() async {
    await stop();
    return super.close();
  }
}
