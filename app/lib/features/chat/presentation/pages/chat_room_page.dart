import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_message_entity.dart';
import 'package:unleash_your_brave/features/chat/presentation/chat_assets.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_room_cubit.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_unread_cubit.dart';

class ChatRoomPage extends StatefulWidget {
  const ChatRoomPage({super.key});

  @override
  State<ChatRoomPage> createState() => _ChatRoomPageState();
}

class _ChatRoomPageState extends State<ChatRoomPage> {
  final _scrollController = ScrollController();
  final _messageController = TextEditingController();
  final _focusNode = FocusNode();
  
  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _messageController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onScroll() {
    final cubit = context.read<ChatRoomCubit>();
    final isNearBottom = _scrollController.hasClients &&
        _scrollController.offset >= _scrollController.position.maxScrollExtent - 100;
    
    cubit.updateScrollPosition(isNearBottom);

    // Load more when near top
    if (_scrollController.position.pixels <= 100) {
      cubit.loadOlder();
    }
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isNotEmpty) {
      context.read<ChatRoomCubit>().sendText(text);
      _messageController.clear();
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  void _showEmojiSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      builder: (context) => _EmojiSheet(
        onEmojiTap: (emoji) {
          final text = _messageController.text;
          final selection = _messageController.selection;
          final newText = text.replaceRange(
            selection.start,
            selection.end,
            emoji,
          );
          _messageController.text = newText;
          _messageController.selection = TextSelection.collapsed(
            offset: selection.start + emoji.length,
          );
          Navigator.pop(context);
        },
      ),
    );
  }

  void _showGifSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      isScrollControlled: true,
      builder: (context) => _GifSheet(
        onGifTap: (gifUrl) {
          context.read<ChatRoomCubit>().sendGif(gifUrl);
          Navigator.pop(context);
          _scrollToBottom();
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
      builder: (context) => _MembersSheet(groupName: group.name, memberCount: group.memberCount),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) {
        final authState = context.read<AuthBloc>().state;
        final currentUserId = authState is AuthAuthenticated ? authState.user.id : '';
        return ChatRoomCubit(sl(), currentUserId)..loadInitial();
      },
      child: Scaffold(
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
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      if (group != null)
                        Text(
                          '${group.memberCount} members',
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
          listener: (context, state) {
            if (state.error != null) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(state.error!)),
              );
            }
          },
          builder: (context, state) {
            if (state.loading && state.messages.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }

            return Column(
              children: [
                // Messages list
                Expanded(
                  child: Stack(
                    children: [
                      ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: state.messages.length + (state.loadingMore ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == 0 && state.loadingMore) {
                            return const Center(
                              child: Padding(
                                padding: EdgeInsets.all(16),
                                child: CircularProgressIndicator(),
                              ),
                            );
                          }
                          
                          final messageIndex = state.loadingMore ? index - 1 : index;
                          final message = state.messages[messageIndex];
                          return _MessageBubble(
                            message: message,
                            onReactionTap: (emoji) => _addReaction(message.id, emoji),
                            onRemoveReaction: () => _removeReaction(message.id),
                          );
                        },
                      ),
                      // New messages indicator
                      if (!state.isNearBottom && state.newMessageCountWhileScrolledUp > 0)
                        Positioned(
                          bottom: 16,
                          right: 16,
                          child: InkWell(
                            onTap: _scrollToBottom,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.accentPink,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${state.newMessageCountWhileScrolledUp} new',
                                    style: AppTypography.caption.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(
                                    Icons.keyboard_arrow_down,
                                    color: Colors.white,
                                    size: 16,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                // Message composer
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
      ),
    );
  }

  void _addReaction(String messageId, String emoji) {
    context.read<ChatRoomCubit>().addReaction(messageId, emoji);
  }

  void _removeReaction(String messageId) {
    context.read<ChatRoomCubit>().removeReaction(messageId);
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.onReactionTap,
    required this.onRemoveReaction,
  });

  final ChatMessageEntity message;
  final Function(String) onReactionTap;
  final VoidCallback onRemoveReaction;

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
            CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.accentPink.withValues(alpha: 0.2),
              backgroundImage: message.senderPhotoUrl != null
                  ? CachedNetworkImageProvider(resolveMediaUrl(message.senderPhotoUrl!))
                  : null,
              child: message.senderPhotoUrl == null
                  ? Text(
                      message.senderName.isNotEmpty ? message.senderName[0].toUpperCase() : '?',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.accentPink,
                        fontWeight: FontWeight.w600,
                      ),
                    )
                  : null,
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
                    if (!isMine)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          message.senderName,
                          style: AppTypography.caption.copyWith(
                            color: AppColors.accentPink,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
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
                    else if (message.type == ChatMessageType.gif && message.gifUrl != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: CachedNetworkImage(
                          imageUrl: message.gifUrl!,
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
      builder: (context) => _ReactionSheet(
        onReactionTap: onReactionTap,
        onRemoveReaction: onRemoveReaction,
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
    required this.onRemoveReaction,
  });

  final Function(String) onReactionTap;
  final VoidCallback onRemoveReaction;

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
                onTap: () {
                  onReactionTap(emoji);
                  Navigator.pop(context);
                },
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