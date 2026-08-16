import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/widgets/app_circle_avatar.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_message_entity.dart';
import 'package:unleash_your_brave/features/chat/presentation/chat_assets.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_room_cubit.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_unread_cubit.dart';

/// Distance from the bottom that counts as "following" the latest messages
/// (WhatsApp-style stick-to-bottom buffer).
const _kBottomStickThreshold = 120.0;

class ChatRoomPage extends StatefulWidget {
  const ChatRoomPage({super.key});

  @override
  State<ChatRoomPage> createState() => _ChatRoomPageState();
}

class _ChatRoomPageState extends State<ChatRoomPage> {
  final _scrollController = ScrollController();
  final _messageController = TextEditingController();
  final _focusNode = FocusNode();

  String? _lastSeenMessageId;
  int _lastMessageCount = 0;
  bool _initialScrollDone = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _messageController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  bool get _isNearBottom {
    if (!_scrollController.hasClients) return true;
    final position = _scrollController.position;
    if (!position.hasContentDimensions) return true;
    return position.maxScrollExtent - position.pixels <= _kBottomStickThreshold;
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final cubit = context.read<ChatRoomCubit>();
    final nearBottom = _isNearBottom;
    cubit.updateScrollPosition(nearBottom);

    // Load older history near the top.
    if (_scrollController.position.pixels <= 80) {
      cubit.loadOlder();
    }

    // Mark latest as read once the user is back at the bottom.
    if (nearBottom && cubit.state.messages.isNotEmpty) {
      cubit.markVisibleRead(cubit.state.messages.last.id);
    }
  }

  void _scrollToBottom({bool animated = true}) {
    void jump() {
      if (!_scrollController.hasClients) return;
      final max = _scrollController.position.maxScrollExtent;
      if (animated) {
        _scrollController.animateTo(
          max,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
        );
      } else {
        _scrollController.jumpTo(max);
      }
    }

    // Wait for the list to layout after new items are inserted.
    SchedulerBinding.instance.addPostFrameCallback((_) {
      jump();
      SchedulerBinding.instance.addPostFrameCallback((_) => jump());
    });
  }

  void _jumpToLatest() {
    context.read<ChatRoomCubit>().clearScrolledUpUnread();
    _scrollToBottom(animated: true);
    final messages = context.read<ChatRoomCubit>().state.messages;
    if (messages.isNotEmpty) {
      context.read<ChatRoomCubit>().markVisibleRead(messages.last.id);
    }
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isNotEmpty) {
      context.read<ChatRoomCubit>().sendText(text);
      _messageController.clear();
      _scrollToBottom(animated: true);
    }
  }

  void _onMessagesUpdated(ChatRoomState state) {
    final messages = state.messages;
    if (messages.isEmpty) return;

    final latestId = messages.last.id;
    final count = messages.length;
    final isNewMessage = latestId != _lastSeenMessageId || count > _lastMessageCount;
    final previousCount = _lastMessageCount;

    _lastSeenMessageId = latestId;
    _lastMessageCount = count;

    // First paint after initial load — jump to latest (no animation).
    if (!_initialScrollDone && !state.loading) {
      _initialScrollDone = true;
      _scrollToBottom(animated: false);
      context.read<ChatRoomCubit>().markVisibleRead(latestId);
      return;
    }

    if (!isNewMessage) return;

    // History prepend (older messages) — do not jump to bottom.
    if (count > previousCount && previousCount > 0 && !state.isNearBottom) {
      // Incoming while scrolled up: counter handled in cubit; keep place.
      return;
    }

    // Stick to bottom for own sends and for incoming while following latest.
    if (state.isNearBottom) {
      _scrollToBottom(animated: true);
      context.read<ChatRoomCubit>().markVisibleRead(latestId);
    }
  }

  void _showEmojiSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      builder: (sheetContext) => _EmojiSheet(
        onEmojiTap: (emoji) {
          final text = _messageController.text;
          final selection = _messageController.selection;
          final start = selection.isValid
              ? selection.start.clamp(0, text.length)
              : text.length;
          final end = selection.isValid
              ? selection.end.clamp(start, text.length)
              : text.length;
          final newText = text.replaceRange(start, end, emoji);
          _messageController.value = TextEditingValue(
            text: newText,
            selection: TextSelection.collapsed(offset: start + emoji.length),
          );
          Navigator.pop(sheetContext);
        },
      ),
    );
  }

  void _showGifSheet() {
    final cubit = context.read<ChatRoomCubit>();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      isScrollControlled: true,
      builder: (sheetContext) => _GifSheet(
        onGifTap: (gifUrl) {
          cubit.sendGif(gifUrl);
          Navigator.pop(sheetContext);
          _scrollToBottom(animated: true);
        },
      ),
    );
  }

  void _showMembersSheet() {
    final group = context.read<ChatUnreadCubit>().state.group;
    if (group == null) return;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      builder: (sheetContext) => _MembersSheet(
        groupName: group.name,
        memberCount: group.memberCount,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgCard,
        elevation: 0,
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
        ),
        title: BlocBuilder<ChatUnreadCubit, ChatUnreadState>(
          builder: (context, unreadState) {
            final group = unreadState.group;
            return InkWell(
              onTap: _showMembersSheet,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      group?.name ?? 'Group Chat',
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w700,
                        fontSize: 17,
                      ),
                    ),
                    if (group != null)
                      Text(
                        '${group.memberCount} members · tap for info',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textTertiary,
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
        actions: [
          BlocBuilder<ChatUnreadCubit, ChatUnreadState>(
            builder: (context, state) {
              return Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(right: 16),
                decoration: BoxDecoration(
                  color: state.connected ? Colors.green : AppColors.textTertiary,
                  borderRadius: BorderRadius.circular(4),
                ),
              );
            },
          ),
        ],
      ),
      body: BlocConsumer<ChatRoomCubit, ChatRoomState>(
        listenWhen: (previous, current) =>
            previous.messages.length != current.messages.length ||
            (current.messages.isNotEmpty &&
                previous.messages.isNotEmpty &&
                previous.messages.last.id != current.messages.last.id) ||
            (previous.loading && !current.loading),
        listener: (context, state) {
          if (state.error != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.error!)),
            );
          }
          _onMessagesUpdated(state);
        },
        builder: (context, state) {
          if (state.loading && state.messages.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          final showJumpFab = !state.isNearBottom;

          return Column(
            children: [
              Expanded(
                child: Stack(
                  children: [
                    ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      itemCount:
                          state.messages.length + (state.loadingMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == 0 && state.loadingMore) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.all(16),
                              child: CircularProgressIndicator(),
                            ),
                          );
                        }

                        final messageIndex =
                            state.loadingMore ? index - 1 : index;
                        final message = state.messages[messageIndex];
                        return _MessageBubble(
                          message: message,
                          onReactionTap: (emoji) =>
                              _addReaction(message.id, emoji),
                        );
                      },
                    ),
                    // WhatsApp-style jump-to-latest FAB + unread badge
                    if (showJumpFab)
                      Positioned(
                        right: 14,
                        bottom: 14,
                        child: _JumpToLatestFab(
                          unreadCount: state.newMessageCountWhileScrolledUp,
                          onTap: _jumpToLatest,
                        ),
                      ),
                  ],
                ),
              ),
              _MessageComposer(
                controller: _messageController,
                focusNode: _focusNode,
                onSend: _sendMessage,
                onEmojiTap: _showEmojiSheet,
                onGifTap: _showGifSheet,
                sending: state.sending,
              ),
            ],
          );
        },
      ),
    );
  }

  void _addReaction(String messageId, String emoji) {
    context.read<ChatRoomCubit>().addReaction(messageId, emoji);
  }
}

class _JumpToLatestFab extends StatelessWidget {
  const _JumpToLatestFab({
    required this.unreadCount,
    required this.onTap,
  });

  final int unreadCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.bgCard,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.borderSubtle),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.28),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: const Icon(
                Icons.keyboard_arrow_down_rounded,
                color: AppColors.textPrimary,
                size: 28,
              ),
            ),
            if (unreadCount > 0)
              Positioned(
                top: -6,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 22),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.accentPink,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Text(
                    unreadCount > 99 ? '99+' : '$unreadCount',
                    textAlign: TextAlign.center,
                    style: AppTypography.caption.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                      height: 1.2,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.onReactionTap,
  });

  final ChatMessageEntity message;
  final Function(String) onReactionTap;

  @override
  Widget build(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    final currentUserId = authState is AuthAuthenticated ? authState.user.id : '';
    final isMine = message.senderId == currentUserId;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            AppCircleAvatar(
              radius: 16,
              photoUrl: message.senderPhotoUrl,
              backgroundColor: AppColors.accentPink.withValues(alpha: 0.2),
              fallback: Text(
                message.senderName.isNotEmpty
                    ? message.senderName[0].toUpperCase()
                    : '?',
                style: AppTypography.caption.copyWith(
                  color: AppColors.accentPink,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: GestureDetector(
              onLongPress: () => _showReactionSheet(context),
              child: Container(
                margin: EdgeInsets.only(
                  left: isMine ? 40 : 0,
                  right: isMine ? 0 : 40,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isMine ? AppColors.accentPink : AppColors.bgCard,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(12),
                    topRight: const Radius.circular(12),
                    bottomLeft: Radius.circular(isMine ? 12 : 4),
                    bottomRight: Radius.circular(isMine ? 4 : 12),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!isMine || message.isAdminSender)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              message.senderName,
                              style: AppTypography.caption.copyWith(
                                color: isMine
                                    ? Colors.white.withValues(alpha: 0.9)
                                    : AppColors.accentPink,
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                            if (message.isAdminSender) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 1,
                                ),
                                decoration: BoxDecoration(
                                  color: isMine
                                      ? Colors.white.withValues(alpha: 0.2)
                                      : AppColors.accentPink.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  'ADMIN',
                                  style: AppTypography.microLabel.copyWith(
                                    color: isMine
                                        ? Colors.white
                                        : AppColors.accentPink,
                                    fontSize: 9,
                                    letterSpacing: 0.8,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    if (message.type == ChatMessageType.text && message.body != null)
                      Text(
                        message.body!,
                        style: AppTypography.body.copyWith(
                          color: isMine ? Colors.white : AppColors.textPrimary,
                          fontSize: 15,
                        ),
                      )
                    else if (message.type == ChatMessageType.gif &&
                        isLoadableMediaUrl(message.gifUrl))
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: CachedNetworkImage(
                          imageUrl: resolveMediaUrl(message.gifUrl),
                          width: 200,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(
                            width: 200,
                            height: 150,
                            color: AppColors.borderSubtle,
                            child: const Icon(Icons.gif, size: 48),
                          ),
                          errorWidget: (context, url, error) => Container(
                            width: 200,
                            height: 150,
                            color: AppColors.borderSubtle,
                            child: const Icon(Icons.error, size: 48),
                          ),
                        ),
                      ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _formatTime(message.createdAt),
                          style: AppTypography.caption.copyWith(
                            color: isMine 
                                ? Colors.white.withValues(alpha: 0.8)
                                : AppColors.textTertiary,
                            fontSize: 11,
                          ),
                        ),
                        if (isMine) ...[
                          const SizedBox(width: 4),
                          Icon(
                            message.deliveryStatus == DeliveryStatus.read
                                ? Icons.done_all
                                : message.deliveryStatus == DeliveryStatus.delivered
                                    ? Icons.done_all
                                    : Icons.done,
                            size: 16,
                            color: message.deliveryStatus == DeliveryStatus.read
                                ? AppColors.accentPinkDark
                                : Colors.white.withValues(alpha: 0.8),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);
    
    if (diff.inDays > 0) {
      return '${dateTime.day}/${dateTime.month}';
    } else {
      final hour = dateTime.hour.toString().padLeft(2, '0');
      final minute = dateTime.minute.toString().padLeft(2, '0');
      return '$hour:$minute';
    }
  }

  void _showReactionSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      builder: (sheetContext) => _ReactionSheet(
        onReactionTap: (emoji) {
          onReactionTap(emoji);
          Navigator.pop(sheetContext);
        },
      ),
    );
  }
}

class _MessageComposer extends StatelessWidget {
  const _MessageComposer({
    required this.controller,
    required this.focusNode,
    required this.onSend,
    required this.onEmojiTap,
    required this.onGifTap,
    required this.sending,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onSend;
  final VoidCallback onEmojiTap;
  final VoidCallback onGifTap;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.bgCard,
        border: Border(top: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onEmojiTap,
            icon: const Icon(Icons.emoji_emotions_outlined, color: AppColors.textSecondary),
          ),
          IconButton(
            onPressed: onGifTap,
            icon: const Icon(Icons.gif, color: AppColors.textSecondary),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              maxLines: null,
              textCapitalization: TextCapitalization.sentences,
              style: AppTypography.body,
              decoration: InputDecoration(
                hintText: 'Type a message...',
                hintStyle: AppTypography.body.copyWith(color: AppColors.textTertiary),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: const BorderSide(color: AppColors.borderSubtle),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: const BorderSide(color: AppColors.accentPink),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                filled: true,
                fillColor: AppColors.bgBase,
              ),
              onSubmitted: (_) => onSend(),
            ),
          ),
          const SizedBox(width: 8),
          InkWell(
            onTap: sending ? null : onSend,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: AppColors.accentPink,
                shape: BoxShape.circle,
              ),
              child: sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(Colors.white),
                      ),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReactionSheet extends StatelessWidget {
  const _ReactionSheet({
    required this.onReactionTap,
  });

  final Function(String) onReactionTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'React to message',
            style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: kChatReactionEmojis.map((emoji) {
              return GestureDetector(
                onTap: () => onReactionTap(emoji),
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.bgBase,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: Center(
                    child: Text(emoji, style: const TextStyle(fontSize: 24)),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _EmojiSheet extends StatelessWidget {
  const _EmojiSheet({required this.onEmojiTap});

  final Function(String) onEmojiTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Add emoji',
            style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 24),
          GridView.count(
            crossAxisCount: 6,
            shrinkWrap: true,
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            children: kComposerEmojis.map((emoji) {
              return GestureDetector(
                onTap: () => onEmojiTap(emoji),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.bgBase,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: Center(
                    child: Text(emoji, style: const TextStyle(fontSize: 24)),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _GifSheet extends StatelessWidget {
  const _GifSheet({required this.onGifTap});

  final Function(String) onGifTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text(
            'Choose GIF',
            style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              children: kChatGifCatalog.map((gifUrl) {
                return GestureDetector(
                  onTap: () => onGifTap(gifUrl),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: CachedNetworkImage(
                      imageUrl: gifUrl,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        color: AppColors.borderSubtle,
                        child: const Icon(Icons.gif, size: 48),
                      ),
                      errorWidget: (context, url, error) => Container(
                        color: AppColors.borderSubtle,
                        child: const Icon(Icons.error, size: 48),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _MembersSheet extends StatelessWidget {
  const _MembersSheet({
    required this.groupName,
    required this.memberCount,
  });

  final String groupName;
  final int memberCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.accentPink.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(
                  Icons.groups,
                  color: AppColors.accentPink,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      groupName,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 18,
                      ),
                    ),
                    Text(
                      '$memberCount members',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'This is the main group chat for event attendees. Connect with fellow participants, share insights, and stay updated on event happenings.',
            style: AppTypography.body.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}