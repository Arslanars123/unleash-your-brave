import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/core/widgets/suggest_search_field.dart';
import 'package:unleash_your_brave/features/agenda/data/datasources/agenda_local_datasource.dart';
import 'package:unleash_your_brave/features/agenda/data/datasources/sessions_remote_datasource.dart';
import 'package:unleash_your_brave/features/agenda/data/models/session_model.dart';
import 'package:unleash_your_brave/features/agenda/domain/entities/session_entity.dart';
import 'package:unleash_your_brave/features/agenda/presentation/widgets/agenda_day_tabs.dart';
import 'package:unleash_your_brave/features/agenda/presentation/widgets/session_card.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/data/models/event_model.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_day_entity.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';

enum _AgendaStatus { bootstrapping, loading, refreshing, success, offline, error }

enum _DayLoadStatus { idle, loading, ready, offline, error }

class AgendaPage extends StatefulWidget {
  const AgendaPage({super.key});

  @override
  State<AgendaPage> createState() => _AgendaPageState();
}

class _AgendaPageState extends State<AgendaPage> {
  final _searchController = TextEditingController();

  _AgendaStatus _status = _AgendaStatus.bootstrapping;
  EventEntity? _event;
  final Map<int, List<SessionEntity>> _sessionsByDay = {};
  final Map<int, _DayLoadStatus> _dayStatus = {};
  final Map<int, String> _dayErrors = {};

  int? _selectedDayNumber;
  String? _errorMessage;
  String _searchQuery = '';
  int _page = 0;
  static const _pageSize = 8;
  bool _servingCachedData = false;
  int _sessionsRequestId = 0;

  AgendaLocalDataSource get _local => sl<AgendaLocalDataSource>();

  @override
  void initState() {
    super.initState();
    unawaited(_bootstrap());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  EventDayEntity? get _selectedDay {
    final days = _event?.days ?? const [];
    final selected = _selectedDayNumber;
    if (selected == null) return null;
    for (final day in days) {
      if (day.dayNumber == selected) return day;
    }
    return days.isEmpty ? null : days.first;
  }

  List<SessionEntity> get _daySessions {
    final day = _selectedDayNumber;
    if (day == null) return const [];
    return _sessionsByDay[day] ?? const <SessionEntity>[];
  }

  List<SessionEntity> get _visibleSessions {
    final all = _daySessions;
    final query = _searchQuery.trim();
    if (query.isEmpty) return all;
    return all.where((session) => session.matchesAgendaSearch(query)).toList(growable: false);
  }

  List<SessionEntity> get _pagedSessions {
    final all = _visibleSessions;
    final start = _page * _pageSize;
    if (start >= all.length) return const [];
    final end = (start + _pageSize).clamp(0, all.length);
    return all.sublist(start, end);
  }

  int get _totalPages {
    final total = _visibleSessions.length;
    if (total == 0) return 1;
    return ((total - 1) ~/ _pageSize) + 1;
  }

  _DayLoadStatus get _selectedDayStatus {
    final day = _selectedDayNumber;
    if (day == null) return _DayLoadStatus.idle;
    return _dayStatus[day] ?? _DayLoadStatus.idle;
  }

  Future<void> _bootstrap() async {
    setState(() => _status = _AgendaStatus.bootstrapping);

    final cachedEvent = await _local.readCachedEvent();
    if (!mounted) return;

    if (cachedEvent != null) {
      final cachedSessions = await _local.readAllCachedSessions(cachedEvent.id);
      if (!mounted) return;
      _applyCachedSnapshot(cachedEvent, cachedSessions);
      setState(() {
        _status = _AgendaStatus.success;
        _servingCachedData = true;
      });
      await _load(isRefresh: true, silentIfCached: true);
      return;
    }

    await _load(isRefresh: false, silentIfCached: false);
  }

  void _applyCachedSnapshot(
    EventModel event,
    Map<int, List<SessionModel>> cachedSessions,
  ) {
    _event = event;
    _sessionsByDay
      ..clear()
      ..addAll(cachedSessions);
    _dayStatus
      ..clear()
      ..addEntries(
        cachedSessions.keys.map(
          (day) => MapEntry(day, _DayLoadStatus.ready),
        ),
      );
    _selectedDayNumber = _resolveSelectedDay(event);
  }

  Future<void> _load({
    required bool isRefresh,
    required bool silentIfCached,
  }) async {
    final hadContent = _event != null;

    if (!silentIfCached || !hadContent) {
      setState(() {
        _status = isRefresh && hadContent
            ? _AgendaStatus.refreshing
            : _AgendaStatus.loading;
        if (!isRefresh || !hadContent) {
          _errorMessage = null;
        }
      });
    } else {
      setState(() => _status = _AgendaStatus.refreshing);
    }

    try {
      final event = await sl<EventsRemoteDataSource>().getCurrent();
      await _local.cacheEvent(event);
      if (!mounted) return;

      final nextDay = event.days.isEmpty ? null : _resolveSelectedDay(event);
      setState(() {
        _event = event;
        _selectedDayNumber = nextDay;
        _status = _AgendaStatus.success;
        _servingCachedData = false;
        _errorMessage = null;
      });

      if (nextDay != null) {
        await _loadSessionsForDay(
          eventId: event.id,
          dayNumber: nextDay,
          forceNetwork: true,
        );
      }
    } on NetworkException catch (error) {
      if (!mounted) return;
      _handleEventFailure(
        isOffline: true,
        message: error.message,
        keepContent: hadContent,
      );
    } on ServerException catch (error) {
      if (!mounted) return;
      _handleEventFailure(
        isOffline: false,
        message: error.message,
        keepContent: hadContent,
      );
    } catch (_) {
      if (!mounted) return;
      _handleEventFailure(
        isOffline: false,
        message: 'Unexpected error',
        keepContent: hadContent,
      );
    }
  }

  int _resolveSelectedDay(EventEntity event) {
    final current = _selectedDayNumber;
    if (current != null &&
        event.days.any((day) => day.dayNumber == current)) {
      return current;
    }

    if (event.isLive) {
      final today = DateTime.now().toUtc();
      for (final day in event.days) {
        final d = day.date.toUtc();
        if (d.year == today.year &&
            d.month == today.month &&
            d.day == today.day) {
          return day.dayNumber;
        }
      }
    }

    return event.days.first.dayNumber;
  }

  Future<void> _loadSessionsForDay({
    required String eventId,
    required int dayNumber,
    required bool forceNetwork,
  }) async {
    final requestId = ++_sessionsRequestId;
    final hasCache = _sessionsByDay.containsKey(dayNumber);

    // Instant Instagram-style switch: show cached day immediately.
    if (hasCache) {
      setState(() {
        _dayStatus[dayNumber] = forceNetwork
            ? _DayLoadStatus.loading
            : _DayLoadStatus.ready;
        _dayErrors.remove(dayNumber);
      });
    } else {
      setState(() {
        _dayStatus[dayNumber] = _DayLoadStatus.loading;
        _dayErrors.remove(dayNumber);
      });
    }

    // Soft-hydrate from disk if memory miss.
    if (!hasCache) {
      final disk = await _local.readDaySessions(
        eventId: eventId,
        dayNumber: dayNumber,
      );
      if (!mounted || requestId != _sessionsRequestId) return;
      if (disk != null) {
        setState(() {
          _sessionsByDay[dayNumber] = disk;
          _dayStatus[dayNumber] = _DayLoadStatus.loading;
          _servingCachedData = true;
        });
      }
    }

    try {
      final sessions = await sl<SessionsRemoteDataSource>().list(
        eventId: eventId,
        eventDayNumber: dayNumber,
      );
      if (!mounted || requestId != _sessionsRequestId) return;

      await _local.cacheDaySessions(
        eventId: eventId,
        dayNumber: dayNumber,
        sessions: sessions,
      );
      if (!mounted || requestId != _sessionsRequestId) return;

      setState(() {
        _sessionsByDay[dayNumber] = sessions;
        _dayStatus[dayNumber] = _DayLoadStatus.ready;
        _dayErrors.remove(dayNumber);
        _servingCachedData = false;
        _status = _AgendaStatus.success;
      });
    } on NetworkException catch (error) {
      if (!mounted || requestId != _sessionsRequestId) return;
      _handleDayFailure(
        dayNumber: dayNumber,
        isOffline: true,
        message: error.message,
      );
    } on ServerException catch (error) {
      if (!mounted || requestId != _sessionsRequestId) return;
      _handleDayFailure(
        dayNumber: dayNumber,
        isOffline: false,
        message: error.message,
      );
    } catch (_) {
      if (!mounted || requestId != _sessionsRequestId) return;
      _handleDayFailure(
        dayNumber: dayNumber,
        isOffline: false,
        message: 'Unexpected error',
      );
    }
  }

  void _handleEventFailure({
    required bool isOffline,
    required String message,
    required bool keepContent,
  }) {
    if (keepContent) {
      final alreadyOffline = _servingCachedData;
      setState(() {
        _status = _AgendaStatus.success;
        _servingCachedData = true;
        _errorMessage = message;
      });
      if (!alreadyOffline) {
        _showSoftNotice(
          isOffline
              ? 'You’re offline. Showing saved agenda.'
              : 'Couldn’t refresh. Showing saved agenda.',
        );
      }
      return;
    }

    setState(() {
      _errorMessage = message;
      _status = isOffline ? _AgendaStatus.offline : _AgendaStatus.error;
    });
  }

  void _handleDayFailure({
    required int dayNumber,
    required bool isOffline,
    required String message,
  }) {
    final hasCache = _sessionsByDay.containsKey(dayNumber);
    if (hasCache) {
      final alreadyOffline = _servingCachedData;
      setState(() {
        _dayStatus[dayNumber] = _DayLoadStatus.ready;
        _servingCachedData = true;
        _status = _AgendaStatus.success;
      });
      if (!alreadyOffline) {
        _showSoftNotice(
          isOffline
              ? 'You’re offline. Showing saved sessions for this day.'
              : 'Couldn’t refresh this day. Showing saved sessions.',
        );
      }
      return;
    }

    setState(() {
      _dayStatus[dayNumber] =
          isOffline ? _DayLoadStatus.offline : _DayLoadStatus.error;
      _dayErrors[dayNumber] = message;
      _status = _AgendaStatus.success;
    });
  }

  void _showSoftNotice(String message) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.bgMaroon,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _retry() => _load(isRefresh: false, silentIfCached: false);

  Future<void> _refresh() async {
    await _load(isRefresh: true, silentIfCached: false);
  }

  Future<void> _retrySelectedDay() async {
    final event = _event;
    final day = _selectedDayNumber;
    if (event == null || day == null) {
      await _retry();
      return;
    }
    await _loadSessionsForDay(
      eventId: event.id,
      dayNumber: day,
      forceNetwork: true,
    );
  }

  void _onDaySelected(int dayNumber) {
    if (_selectedDayNumber == dayNumber || _event == null) return;

    setState(() {
      _selectedDayNumber = dayNumber;
      _page = 0;
    });

    unawaited(
      _loadSessionsForDay(
        eventId: _event!.id,
        dayNumber: dayNumber,
        forceNetwork: true,
      ),
    );
  }

  void _onSearchApplied(String value) {
    setState(() {
      _searchQuery = value.trim();
      _page = 0;
    });
  }

  List<SearchSuggestionItem> _suggestionsFor(String draft) {
    return _daySessions
        .where((session) => session.matchesAgendaSearch(draft))
        .map(
          (session) => SearchSuggestionItem(
            id: session.id,
            title: session.name,
            subtitle: session.agendaListSubtitle.isEmpty
                ? null
                : session.agendaListSubtitle,
          ),
        )
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final sidePad = context.pagePadding.left;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.accentPink,
          onRefresh: _refresh,
          child: switch (_status) {
            _AgendaStatus.bootstrapping ||
            _AgendaStatus.loading =>
              const _ScrollableFill(
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.accentPink),
                ),
              ),
            _AgendaStatus.offline => _ScrollableFill(
                child: LoadErrorView(
                  kind: LoadErrorKind.offline,
                  message: _errorMessage,
                  onRetry: _retry,
                ),
              ),
            _AgendaStatus.error => _ScrollableFill(
                child: LoadErrorView(
                  kind: LoadErrorKind.generic,
                  message: _errorMessage,
                  onRetry: _retry,
                ),
              ),
            _AgendaStatus.refreshing ||
            _AgendaStatus.success =>
              _AgendaBody(
                sidePad: sidePad,
                event: _event,
                selectedDay: _selectedDay,
                selectedDayNumber: _selectedDayNumber,
                sessions: _pagedSessions,
                totalFiltered: _visibleSessions.length,
                page: _page,
                totalPages: _totalPages,
                dayStatus: _selectedDayStatus,
                dayErrorMessage: _selectedDayNumber == null
                    ? null
                    : _dayErrors[_selectedDayNumber!],
                sessionsLoading:
                    _selectedDayStatus == _DayLoadStatus.loading,
                refreshing: _status == _AgendaStatus.refreshing,
                servingCachedData: _servingCachedData,
                searchController: _searchController,
                searchQuery: _searchQuery,
                onDaySelected: _onDaySelected,
                onSearchApplied: _onSearchApplied,
                suggestionsFor: _suggestionsFor,
                onPageChanged: (page) => setState(() => _page = page),
                onRetryDay: _retrySelectedDay,
              ),
          },
        ),
      ),
    );
  }
}

class _ScrollableFill extends StatelessWidget {
  const _ScrollableFill({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        );
      },
    );
  }
}

class _AgendaBody extends StatelessWidget {
  const _AgendaBody({
    required this.sidePad,
    required this.event,
    required this.selectedDay,
    required this.selectedDayNumber,
    required this.sessions,
    required this.totalFiltered,
    required this.page,
    required this.totalPages,
    required this.dayStatus,
    required this.dayErrorMessage,
    required this.sessionsLoading,
    required this.refreshing,
    required this.servingCachedData,
    required this.searchController,
    required this.searchQuery,
    required this.onDaySelected,
    required this.onSearchApplied,
    required this.suggestionsFor,
    required this.onPageChanged,
    required this.onRetryDay,
  });

  final double sidePad;
  final EventEntity? event;
  final EventDayEntity? selectedDay;
  final int? selectedDayNumber;
  final List<SessionEntity> sessions;
  final int totalFiltered;
  final int page;
  final int totalPages;
  final _DayLoadStatus dayStatus;
  final String? dayErrorMessage;
  final bool sessionsLoading;
  final bool refreshing;
  final bool servingCachedData;
  final TextEditingController searchController;
  final String searchQuery;
  final ValueChanged<int> onDaySelected;
  final ValueChanged<String> onSearchApplied;
  final List<SearchSuggestionItem> Function(String draft) suggestionsFor;
  final ValueChanged<int> onPageChanged;
  final VoidCallback onRetryDay;

  @override
  Widget build(BuildContext context) {
    final days = event?.days ?? const <EventDayEntity>[];
    final showDayLoader = sessionsLoading && sessions.isEmpty && totalFiltered == 0;
    final showDayError = (dayStatus == _DayLoadStatus.offline ||
            dayStatus == _DayLoadStatus.error) &&
        sessions.isEmpty &&
        totalFiltered == 0;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(sidePad, 8, sidePad, 0),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: context.maxContentWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'AGENDA',
                      style: AppTypography.microLabel.copyWith(
                        color: AppColors.accentPink,
                        letterSpacing: 2.2,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Your day, curated',
                      style: AppTypography.headline.copyWith(fontSize: 34),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      event?.name.isNotEmpty == true
                          ? event!.name
                          : 'Sessions and extra activities for each gathering day',
                      style: AppTypography.caption.copyWith(fontSize: 14),
                    ),
                    if (servingCachedData) ...[
                      const SizedBox(height: 14),
                      const _OfflineBanner(),
                    ],
                    if (refreshing || (sessionsLoading && sessions.isNotEmpty)) ...[
                      const SizedBox(height: 12),
                      const LinearProgressIndicator(
                        color: AppColors.accentPink,
                        backgroundColor: AppColors.bgMaroon,
                        minHeight: 2,
                      ),
                    ],
                    const SizedBox(height: 20),
                    if (days.isEmpty)
                      Text(
                        'No days scheduled for this event yet.',
                        style: AppTypography.caption,
                      )
                    else ...[
                      AgendaDayTabs(
                        days: days,
                        selectedDayNumber:
                            selectedDayNumber ?? days.first.dayNumber,
                        onDaySelected: onDaySelected,
                      ),
                      if (selectedDay != null) ...[
                        const SizedBox(height: 14),
                        Text(
                          selectedDay!.fullDateLabel,
                          style: AppTypography.microLabel.copyWith(
                            color: AppColors.textSecondary,
                            letterSpacing: 1.4,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      SuggestSearchField(
                        controller: searchController,
                        appliedQuery: searchQuery,
                        onAppliedChanged: onSearchApplied,
                        suggestionsFor: suggestionsFor,
                        hintText: 'Search sessions, activities, or speakers',
                      ),
                      const SizedBox(height: 20),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
        if (days.isNotEmpty)
          if (showDayLoader)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: CircularProgressIndicator(color: AppColors.accentPink),
              ),
            )
          else if (showDayError)
            SliverFillRemaining(
              hasScrollBody: false,
              child: LoadErrorView(
                kind: dayStatus == _DayLoadStatus.offline
                    ? LoadErrorKind.offline
                    : LoadErrorKind.generic,
                message: dayErrorMessage,
                onRetry: onRetryDay,
              ),
            )
          else if (totalFiltered == 0)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: sidePad),
                  child: Text(
                    searchQuery.isEmpty
                        ? 'No sessions or extra activities scheduled for this day yet.'
                        : 'No sessions or activities match your search.',
                    textAlign: TextAlign.center,
                    style: AppTypography.caption,
                  ),
                ),
              ),
            )
          else
            ...[
              SliverPadding(
                padding: EdgeInsets.fromLTRB(sidePad, 0, sidePad, 12),
                sliver: SliverList.separated(
                  itemCount: sessions.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final session = sessions[index];
                    return Center(
                      child: ConstrainedBox(
                        constraints:
                            BoxConstraints(maxWidth: context.maxContentWidth),
                        child: Opacity(
                          opacity: sessionsLoading ? 0.72 : 1,
                          child: SessionCard(
                            session: session,
                            onTap: () => context.push(
                              '/agenda/sessions/${session.id}',
                              extra: session,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(sidePad, 4, sidePad, 28),
                  child: Center(
                    child: ConstrainedBox(
                      constraints:
                          BoxConstraints(maxWidth: context.maxContentWidth),
                      child: _ListPager(
                        page: page,
                        totalPages: totalPages,
                        total: totalFiltered,
                        label: 'items',
                        onPageChanged: onPageChanged,
                      ),
                    ),
                  ),
                ),
              ),
            ],
      ],
    );
  }
}

class _ListPager extends StatelessWidget {
  const _ListPager({
    required this.page,
    required this.totalPages,
    required this.total,
    required this.label,
    required this.onPageChanged,
  });

  final int page;
  final int totalPages;
  final int total;
  final String label;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final from = total == 0 ? 0 : page * 8 + 1;
    final to = ((page + 1) * 8).clamp(0, total);

    return Row(
      children: [
        Expanded(
          child: Text(
            '$from–$to of $total $label',
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

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bgMaroon,
        borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.wifi_off_rounded,
            size: 18,
            color: AppColors.accentPink,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Offline mode — showing saved agenda',
              style: AppTypography.caption.copyWith(
                color: AppColors.textPrimary,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
