import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/datetime_format.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/core/widgets/subpage_app_bar.dart';
import 'package:unleash_your_brave/core/widgets/suggest_search_field.dart';
import 'package:unleash_your_brave/features/announcements/data/datasources/announcements_remote_datasource.dart';
import 'package:unleash_your_brave/features/announcements/domain/entities/announcement_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/entities/chat_message_entity.dart';
import 'package:unleash_your_brave/features/chat/domain/repositories/chat_repository.dart';

enum _FeedFilter { all, unread, read }

enum _InboxKind { announcement, message }

class _InboxItem {
  const _InboxItem.announcement(this.announcement)
      : message = null,
        kind = _InboxKind.announcement;

  const _InboxItem.message(this.message)
      : announcement = null,
        kind = _InboxKind.message;

  final _InboxKind kind;
  final AnnouncementEntity? announcement;
  final ChatMessageEntity? message;

  String get id =>
      kind == _InboxKind.announcement ? announcement!.id : 'msg-${message!.id}';

  String get title {
    if (kind == _InboxKind.announcement) return announcement!.title;
    return message!.senderName;
  }

  String get body {
    if (kind == _InboxKind.announcement) return announcement!.description;
    final m = message!;
    if (m.type == ChatMessageType.gif) return 'Sent a GIF';
    return (m.body ?? '').trim();
  }

  DateTime get sortAt {
    if (kind == _InboxKind.announcement) {
      return announcement!.publishedAt ?? announcement!.createdAt;
    }
    return message!.createdAt;
  }

  bool get isRead {
    if (kind == _InboxKind.announcement) return announcement!.isRead;
    return true;
  }
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, this.highlightId});

  final String? highlightId;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  static const _pageSize = 10;

  final _searchController = TextEditingController();
  _FeedFilter _filter = _FeedFilter.all;
  bool _loading = true;
  String? _error;
  List<AnnouncementEntity> _announcements = const [];
  List<ChatMessageEntity> _messages = const [];
  int _unreadAnnouncements = 0;
  int _unreadMessages = 0;
  String? _expandedId;
  String _searchQuery = '';
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _expandedId = widget.highlightId;
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<_InboxItem> get _allItems {
    final unreadIds = <String>{};
    if (_unreadMessages > 0 && _messages.isNotEmpty) {
      final sorted = [..._messages]
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      for (final m in sorted.take(_unreadMessages)) {
        unreadIds.add(m.id);
      }
    }

    final items = <_InboxItem>[
      ..._announcements.map(_InboxItem.announcement),
      ..._messages.map((m) => _MessageInboxItem(m, unreadIds.contains(m.id))),
    ];
    items.sort((a, b) => b.sortAt.compareTo(a.sortAt));
    return items;
  }

  List<_InboxItem> get _filteredItems {
    var items = _allItems;
    items = switch (_filter) {
      _FeedFilter.all => items,
      _FeedFilter.unread => items.where((e) => !e.isRead).toList(),
      _FeedFilter.read => items.where((e) => e.isRead).toList(),
    };

    final query = _searchQuery.trim().toLowerCase();
    if (query.isEmpty) return items;
    return items
        .where(
          (item) =>
              item.title.toLowerCase().contains(query) ||
              item.body.toLowerCase().contains(query),
        )
        .toList(growable: false);
  }

  List<_InboxItem> get _pagedItems {
    final all = _filteredItems;
    final start = _page * _pageSize;
    if (start >= all.length) return const [];
    final end = (start + _pageSize).clamp(0, all.length);
    return all.sublist(start, end);
  }

  int get _totalPages {
    final total = _filteredItems.length;
    if (total == 0) return 1;
    return ((total - 1) ~/ _pageSize) + 1;
  }

  int get _totalUnread => _unreadAnnouncements + _unreadMessages;

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final feedFuture = sl<AnnouncementsRemoteDataSource>().getFeed(
        filter: switch (_filter) {
          _FeedFilter.all => 'all',
          _FeedFilter.unread => 'all',
          _FeedFilter.read => 'all',
        },
      );
      final groupFuture = sl<ChatRepository>().getGroup();
      final messagesFuture = sl<ChatRepository>().getMessages(limit: 30);

      final feed = await feedFuture;
      final groupResult = await groupFuture;
      final messagesResult = await messagesFuture;

      if (!mounted) return;

      final messages = messagesResult.fold(
        (_) => <ChatMessageEntity>[],
        (list) => list,
      );
      final unreadMessages = groupResult.fold(
        (_) => 0,
        (group) => group.unreadCount,
      );

      setState(() {
        _announcements = feed.items;
        _unreadAnnouncements = feed.unreadCount;
        _messages = messages;
        _unreadMessages = unreadMessages;
        _loading = false;
        _page = 0;
      });
      final highlight = widget.highlightId;
      if (highlight != null && highlight.isNotEmpty) {
        await _markAnnouncementRead(highlight);
      }
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load notifications';
      });
    }
  }

  Future<void> _markAnnouncementRead(String id) async {
    final index = _announcements.indexWhere((item) => item.id == id);
    if (index < 0) return;
    final item = _announcements[index];
    if (item.isRead) return;

    setState(() {
      _announcements = [
        ..._announcements.sublist(0, index),
        item.copyWith(isRead: true),
        ..._announcements.sublist(index + 1),
      ];
      _unreadAnnouncements = (_unreadAnnouncements - 1).clamp(0, 9999);
    });

    try {
      await sl<AnnouncementsRemoteDataSource>().markRead(id);
    } catch (_) {}
  }

  Future<void> _openAnnouncement(AnnouncementEntity item) async {
    setState(() => _expandedId = item.id);
    await _markAnnouncementRead(item.id);
  }

  Future<void> _openMessage(ChatMessageEntity message) async {
    if (context.canPop()) {
      context.pop();
    }
    context.go('/network/chat');
  }

  void _onSearchApplied(String value) {
    setState(() {
      _searchQuery = value.trim();
      _page = 0;
    });
  }

  List<SearchSuggestionItem> _suggestionsFor(String draft) {
    final q = draft.toLowerCase();
    return _allItems
        .where(
          (item) =>
              item.title.toLowerCase().contains(q) ||
              item.body.toLowerCase().contains(q),
        )
        .map(
          (item) => SearchSuggestionItem(
            id: item.id,
            title: item.title,
            subtitle: item.kind == _InboxKind.message
                ? 'Message'
                : (item.announcement!.isSystem ? 'Countdown' : 'Announcement'),
          ),
        )
        .toList(growable: false);
  }

  String _formatWhen(DateTime when) => formatUsDateTime(when);

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredItems;
    final paged = _pagedItems;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: buildSubpageAppBar(
        context,
        title: 'Notifications',
        fallbackLocation: '/profile',
      ),
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: _load,
        child: AdaptiveScrollBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Announcements, reminders, and group messages.',
                      style: AppTypography.caption.copyWith(fontSize: 14),
                    ),
                  ),
                  if (_totalUnread > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.accentPink.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '$_totalUnread new',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.accentPink,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
              SizedBox(height: context.sectionGap * 0.65),
              SuggestSearchField(
                controller: _searchController,
                appliedQuery: _searchQuery,
                onAppliedChanged: _onSearchApplied,
                suggestionsFor: _suggestionsFor,
                hintText: 'Search notifications',
                onSuggestionSelected: (item) {
                  if (item.id.startsWith('msg-')) {
                    final msgId = item.id.substring(4);
                    final match = _messages.where((e) => e.id == msgId);
                    if (match.isNotEmpty) {
                      _openMessage(match.first);
                    }
                    return;
                  }
                  final match = _announcements.where((e) => e.id == item.id);
                  if (match.isNotEmpty) {
                    _openAnnouncement(match.first);
                  }
                },
              ),
              SizedBox(height: context.sectionGap * 0.55),
              _FilterChips(
                selected: _filter,
                onChanged: (value) {
                  setState(() {
                    _filter = value;
                    _page = 0;
                  });
                },
              ),
              SizedBox(height: context.sectionGap * 0.75),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                LoadErrorView(message: _error, onRetry: _load)
              else if (_announcements.isEmpty && _messages.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: Column(
                      children: [
                        const Icon(
                          Icons.notifications_none,
                          size: 40,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'No notifications yet',
                          style: AppTypography.body.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Announcements and messages will show up here.',
                          style: AppTypography.body.copyWith(
                            color: AppColors.textSecondary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              else if (filtered.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                    child: Text(
                      'No notifications match your search.',
                      style: AppTypography.caption,
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              else ...[
                ...paged.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: item.kind == _InboxKind.message
                        ? _MessageTile(
                            message: item.message!,
                            unread: !item.isRead,
                            dateLabel: _formatWhen(item.sortAt),
                            onTap: () => _openMessage(item.message!),
                          )
                        : _NotificationTile(
                            item: item.announcement!,
                            expanded: _expandedId == item.announcement!.id,
                            dateLabel: _formatWhen(item.sortAt),
                            onTap: () => _openAnnouncement(item.announcement!),
                          ),
                  ),
                ),
                const SizedBox(height: 8),
                _FeedPager(
                  page: _page,
                  totalPages: _totalPages,
                  total: filtered.length,
                  onPageChanged: (page) => setState(() => _page = page),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Inbox wrapper that carries unread state for chat messages.
class _MessageInboxItem extends _InboxItem {
  _MessageInboxItem(super.message, this.unread) : super.message();

  final bool unread;

  @override
  bool get isRead => !unread;
}

class _FeedPager extends StatelessWidget {
  const _FeedPager({
    required this.page,
    required this.totalPages,
    required this.total,
    required this.onPageChanged,
  });

  final int page;
  final int totalPages;
  final int total;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final from = total == 0 ? 0 : page * 10 + 1;
    final to = ((page + 1) * 10).clamp(0, total);

    return Row(
      children: [
        Expanded(
          child: Text(
            '$from–$to of $total',
            style: AppTypography.caption,
          ),
        ),
        if (totalPages > 1) ...[
          TextButton(
            onPressed: page > 0 ? () => onPageChanged(page - 1) : null,
            child: Text(
              'Prev',
              style: AppTypography.button.copyWith(
                fontSize: 13,
                color: page > 0 ? AppColors.accentPink : AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            '${page + 1}/$totalPages',
            style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700),
          ),
          TextButton(
            onPressed:
                page + 1 < totalPages ? () => onPageChanged(page + 1) : null,
            child: Text(
              'Next',
              style: AppTypography.button.copyWith(
                fontSize: 13,
                color: page + 1 < totalPages
                    ? AppColors.accentPink
                    : AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.selected,
    required this.onChanged,
  });

  final _FeedFilter selected;
  final ValueChanged<_FeedFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget chip(_FeedFilter value, String label) {
      final active = selected == value;
      return ChoiceChip(
        label: Text(label),
        selected: active,
        onSelected: (_) => onChanged(value),
        selectedColor: AppColors.accentPink.withValues(alpha: 0.2),
        labelStyle: AppTypography.caption.copyWith(
          color: active ? AppColors.accentPink : AppColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
        side: BorderSide(
          color: active ? AppColors.accentPink : AppColors.borderSubtle,
        ),
        backgroundColor: AppColors.bgCard,
      );
    }

    return Wrap(
      spacing: 8,
      children: [
        chip(_FeedFilter.all, 'All'),
        chip(_FeedFilter.unread, 'Unread'),
        chip(_FeedFilter.read, 'Read'),
      ],
    );
  }
}

class _MessageTile extends StatelessWidget {
  const _MessageTile({
    required this.message,
    required this.unread,
    required this.dateLabel,
    required this.onTap,
  });

  final ChatMessageEntity message;
  final bool unread;
  final String dateLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final preview = message.type == ChatMessageType.gif
        ? 'Sent a GIF'
        : (message.body ?? '').trim();

    return Material(
      color: unread
          ? AppColors.accentPink.withValues(alpha: 0.08)
          : AppColors.bgCard,
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Container(
          width: double.infinity,
          padding: context.cardPadding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(
              color: unread
                  ? AppColors.accentPink.withValues(alpha: 0.35)
                  : AppColors.borderSubtle,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 4, right: 12),
                child: Icon(
                  Icons.chat_bubble_outline,
                  color: unread ? AppColors.accentPink : AppColors.textSecondary,
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            message.senderName,
                            style: AppTypography.body.copyWith(
                              fontSize: 16,
                              fontWeight:
                                  unread ? FontWeight.w800 : FontWeight.w600,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.bgBase,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: AppColors.borderSubtle),
                          ),
                          child: Text(
                            'MESSAGE',
                            style: AppTypography.caption.copyWith(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                        if (unread) ...[
                          const SizedBox(width: 8),
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.accentPink,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      dateLabel,
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    if (preview.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        preview,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.item,
    required this.expanded,
    required this.dateLabel,
    required this.onTap,
  });

  final AnnouncementEntity item;
  final bool expanded;
  final String dateLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: item.isRead
          ? AppColors.bgCard
          : AppColors.accentPink.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Container(
          width: double.infinity,
          padding: context.cardPadding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(
              color: item.isRead
                  ? AppColors.borderSubtle
                  : AppColors.accentPink.withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 4, right: 12),
                child: Icon(
                  item.isSystem ? Icons.timer_outlined : Icons.campaign_outlined,
                  color: item.isRead ? AppColors.textSecondary : AppColors.accentPink,
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: AppTypography.body.copyWith(
                              fontSize: 16,
                              fontWeight:
                                  item.isRead ? FontWeight.w600 : FontWeight.w800,
                            ),
                          ),
                        ),
                        if (!item.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.accentPink,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      dateLabel,
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    if (expanded && item.description.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(item.description, style: AppTypography.body),
                    ] else if (!expanded && item.description.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        item.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.body.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
