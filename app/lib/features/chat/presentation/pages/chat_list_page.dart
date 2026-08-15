import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/app_circle_avatar.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_group_entity.dart';
import 'package:unleash_your_brave/features/chat/presentation/cubit/chat_unread_cubit.dart';
import 'package:unleash_your_brave/features/posts/data/datasources/posts_remote_datasource.dart';
import 'package:unleash_your_brave/features/posts/domain/entities/post_entity.dart';

class ChatListPage extends StatefulWidget {
  const ChatListPage({super.key});

  @override
  State<ChatListPage> createState() => _ChatListPageState();
}

class _ChatListPageState extends State<ChatListPage> {
  bool _loadingPosts = true;
  String? _postsError;
  List<PostEntity> _posts = const [];

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  Future<void> _loadPosts() async {
    setState(() {
      _loadingPosts = true;
      _postsError = null;
    });
    try {
      final items = await sl<PostsRemoteDataSource>().list(perPage: 30);
      if (!mounted) return;
      setState(() {
        _posts = items;
        _loadingPosts = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingPosts = false;
        _postsError = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _toggleLike(PostEntity post) async {
    final index = _posts.indexWhere((p) => p.id == post.id);
    if (index < 0) return;

    setState(() {
      _posts = [
        ..._posts.sublist(0, index),
        post.copyWith(
          likedByMe: !post.likedByMe,
          likesCount: post.likedByMe
              ? (post.likesCount - 1).clamp(0, 999999)
              : post.likesCount + 1,
        ),
        ..._posts.sublist(index + 1),
      ];
    });

    try {
      final updated = post.likedByMe
          ? await sl<PostsRemoteDataSource>().unlike(post.id)
          : await sl<PostsRemoteDataSource>().like(post.id);
      if (!mounted) return;
      setState(() {
        final i = _posts.indexWhere((p) => p.id == post.id);
        if (i < 0) return;
        _posts = [
          ..._posts.sublist(0, i),
          updated,
          ..._posts.sublist(i + 1),
        ];
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        final i = _posts.indexWhere((p) => p.id == post.id);
        if (i < 0) return;
        _posts = [
          ..._posts.sublist(0, i),
          post,
          ..._posts.sublist(i + 1),
        ];
      });
    }
  }

  Future<void> _openComments(PostEntity post) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _CommentsSheet(post: post),
    );
    await _loadPosts();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: () async {
          await Future.wait([
            _loadPosts(),
            context.read<ChatUnreadCubit>().refresh(),
          ]);
        },
        child: AdaptiveScrollBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'NETWORK',
                style: AppTypography.microLabel.copyWith(
                  color: AppColors.accentPink,
                  letterSpacing: 2.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Connect & share',
                style: AppTypography.headline.copyWith(fontSize: 32),
              ),
              const SizedBox(height: 6),
              Text(
                'Community posts from organizers, plus the live group chat.',
                style: AppTypography.caption.copyWith(fontSize: 14),
              ),
              const SizedBox(height: 22),
              BlocBuilder<ChatUnreadCubit, ChatUnreadState>(
                builder: (context, state) {
                  if (state.group == null) {
                    return const _ChatLoadingCard();
                  }
                  return _GroupChatCard(
                    group: state.group!,
                    connected: state.connected,
                  );
                },
              ),
              const SizedBox(height: 28),
              Text(
                'COMMUNITY FEED',
                style: AppTypography.microLabel.copyWith(
                  color: AppColors.textSecondary,
                  letterSpacing: 1.6,
                ),
              ),
              const SizedBox(height: 12),
              if (_loadingPosts)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_postsError != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Column(
                    children: [
                      Text(_postsError!, style: AppTypography.caption),
                      TextButton(
                        onPressed: _loadPosts,
                        child: Text(
                          'Retry',
                          style: AppTypography.button.copyWith(
                            color: AppColors.accentPink,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else if (_posts.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 36),
                  child: Center(
                    child: Text(
                      'No posts yet — check back soon.',
                      style: AppTypography.caption,
                    ),
                  ),
                )
              else
                ..._posts.map(
                  (post) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _PostCard(
                      post: post,
                      onLike: () => _toggleLike(post),
                      onComment: () => _openComments(post),
                    ),
                  ),
                ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChatLoadingCard extends StatelessWidget {
  const _ChatLoadingCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Text('Opening group chat…', style: AppTypography.caption),
    );
  }
}

class _GroupChatCard extends StatelessWidget {
  const _GroupChatCard({
    required this.group,
    required this.connected,
  });

  final ChatGroupEntity group;
  final bool connected;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bgCard,
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        onTap: () => context.push('/network/chat'),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.accentPink.withValues(alpha: 0.12),
                AppColors.bgCard,
              ],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: AppColors.accentPink.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(
                    Icons.forum_rounded,
                    color: AppColors.accentPink,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              group.name,
                              style: AppTypography.body.copyWith(
                                fontWeight: FontWeight.w700,
                                fontSize: 17,
                              ),
                            ),
                          ),
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: connected
                                  ? const Color(0xFF22C55E)
                                  : AppColors.textTertiary,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        group.lastMessagePreview ?? 'Say hello to the room',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${group.memberCount} members',
                        style: AppTypography.microLabel.copyWith(
                          color: AppColors.textTertiary,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                ),
                if (group.unreadCount > 0) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.accentPink,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      group.unreadCount > 99 ? '99+' : '${group.unreadCount}',
                      style: AppTypography.caption.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
                const Icon(Icons.chevron_right_rounded, color: AppColors.textTertiary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PostCard extends StatelessWidget {
  const _PostCard({
    required this.post,
    required this.onLike,
    required this.onComment,
  });

  final PostEntity post;
  final VoidCallback onLike;
  final VoidCallback onComment;

  @override
  Widget build(BuildContext context) {
    final author = post.author?.name ?? 'Organizer';
    final imageUrl = resolveMediaUrl(post.image);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Row(
              children: [
                AppCircleAvatar(
                  radius: 18,
                  photoUrl: post.author?.photoUrl,
                  fallback: Text(
                    author.isNotEmpty ? author[0].toUpperCase() : 'A',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.accentPink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        author,
                        style: AppTypography.body.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      Text(
                        'Official post',
                        style: AppTypography.microLabel.copyWith(
                          color: AppColors.accentPink,
                          letterSpacing: 1.0,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (imageUrl.isNotEmpty && isLoadableMediaUrl(post.image))
            CachedNetworkImage(
              imageUrl: imageUrl,
              width: double.infinity,
              height: 240,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(
                height: 240,
                color: AppColors.bgMaroon,
              ),
              errorWidget: (_, __, ___) => const SizedBox.shrink(),
            ),
          if (post.text.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
              child: Text(post.text, style: AppTypography.body.copyWith(height: 1.45)),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 4, 6, 8),
            child: Row(
              children: [
                IconButton(
                  onPressed: onLike,
                  icon: Icon(
                    post.likedByMe ? Icons.favorite : Icons.favorite_border,
                    color: post.likedByMe
                        ? AppColors.accentPink
                        : AppColors.textSecondary,
                  ),
                ),
                Text(
                  '${post.likesCount}',
                  style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: post.commentsEnabled ? onComment : null,
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                  color: AppColors.textSecondary,
                ),
                Text(
                  '${post.commentsCount}',
                  style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CommentsSheet extends StatefulWidget {
  const _CommentsSheet({required this.post});

  final PostEntity post;

  @override
  State<_CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<_CommentsSheet> {
  final _controller = TextEditingController();
  bool _loading = true;
  bool _sending = false;
  List<PostCommentEntity> _comments = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await sl<PostsRemoteDataSource>().listComments(widget.post.id);
      if (!mounted) return;
      setState(() {
        _comments = items;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final comment = await sl<PostsRemoteDataSource>().addComment(widget.post.id, text);
      if (!mounted) return;
      setState(() {
        _comments = [..._comments, comment];
        _controller.clear();
        _sending = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.borderSubtle,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Comments',
                style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _comments.isEmpty
                      ? Center(
                          child: Text(
                            'Be the first to comment',
                            style: AppTypography.caption,
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _comments.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final comment = _comments[index];
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  comment.userName,
                                  style: AppTypography.caption.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.accentPink,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(comment.text, style: AppTypography.body),
                              ],
                            );
                          },
                        ),
            ),
            if (widget.post.commentsEnabled)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        decoration: InputDecoration(
                          hintText: 'Add a comment…',
                          filled: true,
                          fillColor: AppColors.bgBase,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(999),
                            borderSide: const BorderSide(color: AppColors.borderSubtle),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(999),
                            borderSide: const BorderSide(color: AppColors.borderSubtle),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: _sending ? null : _send,
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.accentPink,
                      ),
                      icon: _sending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.send_rounded, color: Colors.white),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
