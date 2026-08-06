import 'package:flutter/material.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/announcements/data/datasources/announcements_remote_datasource.dart';
import 'package:unleash_your_brave/features/announcements/domain/entities/announcement_entity.dart';

enum _FeedFilter { all, unread, read }

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, this.highlightId});

  final String? highlightId;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  _FeedFilter _filter = _FeedFilter.all;
  bool _loading = true;
  String? _error;
  List<AnnouncementEntity> _items = const [];
  int _unreadCount = 0;
  String? _expandedId;

  @override
  void initState() {
    super.initState();
    _expandedId = widget.highlightId;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await sl<AnnouncementsRemoteDataSource>().getFeed(
        filter: switch (_filter) {
          _FeedFilter.all => 'all',
          _FeedFilter.unread => 'unread',
          _FeedFilter.read => 'read',
        },
      );
      if (!mounted) return;
      setState(() {
        _items = result.items;
        _unreadCount = result.unreadCount;
        _loading = false;
      });
      final highlight = widget.highlightId;
      if (highlight != null && highlight.isNotEmpty) {
        await _markRead(highlight);
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

  Future<void> _markRead(String id) async {
    final index = _items.indexWhere((item) => item.id == id);
    if (index < 0) return;
    final item = _items[index];
    if (item.isRead) return;

    setState(() {
      _items = [
        ..._items.sublist(0, index),
        item.copyWith(isRead: true),
        ..._items.sublist(index + 1),
      ];
      _unreadCount = (_unreadCount - 1).clamp(0, 9999);
    });

    try {
      await sl<AnnouncementsRemoteDataSource>().markRead(id);
    } catch (_) {}
  }

  Future<void> _openItem(AnnouncementEntity item) async {
    setState(() => _expandedId = item.id);
    await _markRead(item.id);
  }

  String _formatWhen(DateTime when) {
    final local = when.toLocal();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${months[local.month - 1]} ${local.day}, $hour:$minute $period';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
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
                      'Notifications',
                      style: AppTypography.headline.copyWith(
                        fontSize: context.headlineSize,
                      ),
                    ),
                  ),
                  if (_unreadCount > 0)
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
                        '$_unreadCount new',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.accentPink,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
              SizedBox(height: context.sectionGap * 0.5),
              _FilterChips(
                selected: _filter,
                onChanged: (value) {
                  setState(() => _filter = value);
                  _load();
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
              else if (_items.isEmpty)
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
                          'Announcements and reminders will show up here.',
                          style: AppTypography.body.copyWith(
                            color: AppColors.textSecondary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              else
                ..._items.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _NotificationTile(
                      item: item,
                      expanded: _expandedId == item.id,
                      dateLabel: _formatWhen(item.publishedAt ?? item.createdAt),
                      onTap: () => _openItem(item),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
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
