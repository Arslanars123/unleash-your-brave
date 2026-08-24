import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/core/widgets/suggest_search_field.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';
import 'package:unleash_your_brave/features/home/presentation/cubit/selected_event_cubit.dart';
import 'package:unleash_your_brave/features/sponsors/data/datasources/sponsors_remote_datasource.dart';
import 'package:unleash_your_brave/features/sponsors/domain/entities/sponsor_entity.dart';
import 'package:unleash_your_brave/features/sponsors/presentation/widgets/sponsor_card.dart';

enum _LoadStatus { loading, refreshing, success, offline, error }

class SponsorsListPage extends StatefulWidget {
  const SponsorsListPage({super.key});

  @override
  State<SponsorsListPage> createState() => _SponsorsListPageState();
}

class _SponsorsListPageState extends State<SponsorsListPage> {
  final _searchController = TextEditingController();

  _LoadStatus _status = _LoadStatus.loading;
  EventEntity? _event;
  List<SponsorEntity> _sponsors = const [];
  String? _errorMessage;
  String _searchQuery = '';
  String? _boundEventId;

  @override
  void initState() {
    super.initState();
    unawaited(_load(isRefresh: false));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<SponsorEntity> get _visibleSponsors {
    if (_searchQuery.trim().isEmpty) return _sponsors;
    return _sponsors
        .where((sponsor) => sponsor.matchesSearch(_searchQuery))
        .toList(growable: false);
  }

  Future<String> _resolveEventId() async {
    final cubit = context.read<SelectedEventCubit>();
    await cubit.ensureReady();
    final id = cubit.state.eventId;
    if (id != null && id.isNotEmpty) return id;
    final event = await sl<EventsRemoteDataSource>().getCurrent();
    return event.id;
  }

  Future<void> _load({required bool isRefresh}) async {
    final hadContent = _event != null;
    setState(() {
      _status = isRefresh && hadContent
          ? _LoadStatus.refreshing
          : _LoadStatus.loading;
      if (!isRefresh || !hadContent) _errorMessage = null;
    });

    try {
      final eventId = await _resolveEventId();
      final event = await sl<EventsRemoteDataSource>().getById(eventId);
      final sponsors =
          await sl<SponsorsRemoteDataSource>().list(eventId: event.id);
      if (!mounted) return;
      setState(() {
        _boundEventId = event.id;
        _event = event;
        _sponsors = sponsors;
        _status = _LoadStatus.success;
        _errorMessage = null;
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      _handleFailure(isOffline: true, message: error.message, keepContent: hadContent);
    } on ServerException catch (error) {
      if (!mounted) return;
      _handleFailure(isOffline: false, message: error.message, keepContent: hadContent);
    } catch (_) {
      if (!mounted) return;
      _handleFailure(isOffline: false, message: 'Unexpected error', keepContent: hadContent);
    }
  }

  void _handleFailure({
    required bool isOffline,
    required String message,
    required bool keepContent,
  }) {
    if (keepContent) {
      setState(() => _status = _LoadStatus.success);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: AppColors.bgMaroon,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() {
      _errorMessage = message;
      _status = isOffline ? _LoadStatus.offline : _LoadStatus.error;
    });
  }

  List<SearchSuggestionItem> _suggestionsFor(String draft) {
    return _sponsors
        .where((sponsor) => sponsor.matchesSearch(draft))
        .map(
          (sponsor) => SearchSuggestionItem(
            id: sponsor.id,
            title: sponsor.name,
            subtitle: sponsor.offers.isEmpty
                ? null
                : '${sponsor.offers.length} ${sponsor.offers.length == 1 ? 'offer' : 'offers'}',
          ),
        )
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final sidePad = context.pagePadding.left;

    return BlocListener<SelectedEventCubit, SelectedEventState>(
      listenWhen: (prev, next) =>
          next.eventId != null &&
          next.eventId!.isNotEmpty &&
          prev.eventId != next.eventId,
      listener: (context, state) {
        if (state.eventId == _boundEventId) return;
        unawaited(_load(isRefresh: false));
      },
      child: Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/');
            }
          },
        ),
        title: Text(
          'Sponsors',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 17,
          ),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: () => _load(isRefresh: true),
        child: switch (_status) {
          _LoadStatus.loading => const Center(
              child: CircularProgressIndicator(color: AppColors.accentPink),
            ),
          _LoadStatus.offline => LoadErrorView(
              kind: LoadErrorKind.offline,
              message: _errorMessage,
              onRetry: () => _load(isRefresh: false),
            ),
          _LoadStatus.error => LoadErrorView(
              kind: LoadErrorKind.generic,
              message: _errorMessage,
              onRetry: () => _load(isRefresh: false),
            ),
          _LoadStatus.refreshing || _LoadStatus.success => _buildBody(sidePad),
        },
      ),
    ),
    );
  }

  Widget _buildBody(double sidePad) {
    final visible = _visibleSponsors;
    final refreshing = _status == _LoadStatus.refreshing;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
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
                      'PARTNERS',
                      style: AppTypography.microLabel.copyWith(
                        color: AppColors.accentPink,
                        letterSpacing: 2.2,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Event sponsors',
                      style: AppTypography.headline.copyWith(fontSize: 28),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _event?.name.isNotEmpty == true
                          ? _event!.name
                          : 'Offers and resources from our partners',
                      style: AppTypography.caption.copyWith(fontSize: 14),
                    ),
                    if (refreshing) ...[
                      const SizedBox(height: 12),
                      const LinearProgressIndicator(
                        color: AppColors.accentPink,
                        backgroundColor: AppColors.bgMaroon,
                        minHeight: 2,
                      ),
                    ],
                    const SizedBox(height: 20),
                    SuggestSearchField(
                      controller: _searchController,
                      appliedQuery: _searchQuery,
                      onAppliedChanged: (value) => setState(() => _searchQuery = value.trim()),
                      suggestionsFor: _suggestionsFor,
                      hintText: 'Search sponsors or offers',
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (visible.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: sidePad),
                child: Text(
                  _searchQuery.isEmpty
                      ? 'No sponsors for this event yet.'
                      : 'No sponsors match your search.',
                  textAlign: TextAlign.center,
                  style: AppTypography.caption,
                ),
              ),
            ),
          )
        else
          SliverPadding(
            padding: EdgeInsets.fromLTRB(sidePad, 0, sidePad, 28),
            sliver: SliverList.separated(
              itemCount: visible.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final sponsor = visible[index];
                return Center(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: context.maxContentWidth),
                    child: SponsorCard(
                      sponsor: sponsor,
                      onTap: () => context.push(
                        '/sponsors/${sponsor.id}',
                        extra: sponsor,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
