import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/constants/event_constants.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';
import 'package:unleash_your_brave/features/home/presentation/widgets/event_countdown.dart';
import 'package:unleash_your_brave/features/home/presentation/widgets/quick_action_card.dart';
import 'package:unleash_your_brave/features/home/presentation/widgets/welcome_card.dart';

enum _HomeLoadStatus { loading, refreshing, success, offline, error }

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  _HomeLoadStatus _status = _HomeLoadStatus.loading;
  EventEntity? _event;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _load(isRefresh: false);
  }

  Future<void> _load({required bool isRefresh}) async {
    final hadEvent = _event != null;
    setState(() {
      _status = isRefresh && hadEvent
          ? _HomeLoadStatus.refreshing
          : _HomeLoadStatus.loading;
      if (!isRefresh || !hadEvent) {
        _errorMessage = null;
      }
    });

    try {
      final event = await sl<EventsRemoteDataSource>().getCurrent();
      if (!mounted) return;
      setState(() {
        _event = event;
        _errorMessage = null;
        _status = _HomeLoadStatus.success;
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      _handleLoadFailure(
        isOffline: true,
        message: error.message,
        keepContent: isRefresh && hadEvent,
      );
    } on ServerException catch (error) {
      if (!mounted) return;
      _handleLoadFailure(
        isOffline: false,
        message: error.message,
        keepContent: isRefresh && hadEvent,
      );
    } catch (_) {
      if (!mounted) return;
      _handleLoadFailure(
        isOffline: false,
        message: 'Unexpected error',
        keepContent: isRefresh && hadEvent,
      );
    }
  }

  void _handleLoadFailure({
    required bool isOffline,
    required String message,
    required bool keepContent,
  }) {
    if (keepContent) {
      setState(() {
        _status = _HomeLoadStatus.success;
        _errorMessage = message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isOffline
                ? 'No internet connection. Pull to refresh when you’re back online.'
                : message,
          ),
          backgroundColor: AppColors.bgMaroon,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() {
      _event = null;
      _errorMessage = message;
      _status = isOffline ? _HomeLoadStatus.offline : _HomeLoadStatus.error;
    });
  }

  Future<void> _retry() => _load(isRefresh: false);

  Future<void> _refresh() => _load(isRefresh: true);

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        final user = state is AuthAuthenticated ? state.user : null;
        final sidePad = context.pagePadding.left;
        final heroHeight = context
            .responsive(
              compact: context.screenHeight * 0.42,
              medium: context.screenHeight * 0.38,
              expanded: 420.0,
            )
            .clamp(280.0, 460.0)
            .toDouble();

        return Scaffold(
          backgroundColor: AppColors.bgBase,
          body: RefreshIndicator(
            color: AppColors.accentPink,
            onRefresh: _refresh,
            child: switch (_status) {
              _HomeLoadStatus.loading => _ScrollableFill(
                  child: const Center(
                    child: CircularProgressIndicator(
                      color: AppColors.accentPink,
                    ),
                  ),
                ),
              _HomeLoadStatus.offline => _ScrollableFill(
                  child: LoadErrorView(
                    kind: LoadErrorKind.offline,
                    message: _errorMessage,
                    onRetry: _retry,
                    retrying: false,
                  ),
                ),
              _HomeLoadStatus.error => _ScrollableFill(
                  child: LoadErrorView(
                    kind: LoadErrorKind.generic,
                    message: _errorMessage,
                    onRetry: _retry,
                    retrying: false,
                  ),
                ),
              _HomeLoadStatus.refreshing ||
              _HomeLoadStatus.success =>
                _HomeContent(
                  user: user,
                  event: _event,
                  sidePad: sidePad,
                  heroHeight: heroHeight,
                  refreshing: _status == _HomeLoadStatus.refreshing,
                ),
            },
          ),
        );
      },
    );
  }
}

/// Ensures pull-to-refresh works on short / centered error & loader views.
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

class _HomeContent extends StatelessWidget {
  const _HomeContent({
    required this.user,
    required this.event,
    required this.sidePad,
    required this.heroHeight,
    required this.refreshing,
  });

  final UserEntity? user;
  final EventEntity? event;
  final double sidePad;
  final double heroHeight;
  final bool refreshing;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        SliverToBoxAdapter(
          child: _HomeHero(
            height: heroHeight,
            horizontalPadding: sidePad,
            dateLabel: event?.dateRangeLabel ?? EventConstants.dateLabel,
            eventName: event?.name,
          ),
        ),
        SliverPadding(
          padding: EdgeInsets.fromLTRB(sidePad, 8, sidePad, 28),
          sliver: SliverToBoxAdapter(
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: context.maxContentWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (refreshing)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: LinearProgressIndicator(
                          color: AppColors.accentPink,
                          backgroundColor: AppColors.bgMaroon,
                          minHeight: 2,
                        ),
                      ),
                    EventCountdown(
                      target: event?.startDate,
                      status: event?.status,
                    ),
                    SizedBox(height: context.sectionGap * 0.75),
                    if (user case final loggedInUser?)
                      WelcomeCard(
                        user: loggedInUser,
                        onTap: () => context.go('/profile'),
                      ),
                    SizedBox(height: context.sectionGap * 0.75),
                    Row(
                      children: [
                        Expanded(
                          child: QuickActionCard(
                            icon: Icons.card_giftcard_outlined,
                            title: 'Gifts',
                            subtitle: 'Explore offerings',
                            onTap: () {},
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: QuickActionCard(
                            icon: Icons.calendar_today_outlined,
                            title: 'Agenda',
                            subtitle: 'See the schedule',
                            onTap: () => context.go('/agenda'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _HomeHero extends StatelessWidget {
  const _HomeHero({
    required this.height,
    required this.horizontalPadding,
    required this.dateLabel,
    this.eventName,
  });

  final double height;
  final double horizontalPadding;
  final String dateLabel;
  final String? eventName;

  @override
  Widget build(BuildContext context) {
    final headlineSize = context.headlineSize;

    return SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'assets/images/hero_home.jpg',
            fit: BoxFit.cover,
            alignment: const Alignment(0, -0.35),
            errorBuilder: (_, __, ___) => Container(color: AppColors.bgMaroon),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(gradient: AppColors.gradientHero),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: height * 0.45,
            child: const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x000A0A0A),
                    AppColors.bgBase,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                horizontalPadding,
                context.isShortViewport ? 12 : 20,
                horizontalPadding,
                0,
              ),
              child: Align(
                alignment: Alignment.bottomLeft,
                child: Center(
                  child: ConstrainedBox(
                    constraints:
                        BoxConstraints(maxWidth: context.maxContentWidth),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          eventName?.toUpperCase().isNotEmpty == true
                              ? eventName!.toUpperCase()
                              : EventConstants.brandLiveLabel,
                          style: AppTypography.microLabel.copyWith(
                            color: AppColors.textPrimary,
                            letterSpacing: 2.0,
                            fontSize: 11,
                          ),
                        ),
                        SizedBox(height: context.isShortViewport ? 10 : 14),
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: '${EventConstants.headlineLead}\n',
                                style: AppTypography.headline.copyWith(
                                  fontSize: headlineSize,
                                ),
                              ),
                              TextSpan(
                                text: EventConstants.headlineEmphasis,
                                style: AppTypography.headlineEmphasis.copyWith(
                                  fontSize: headlineSize,
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(height: context.isShortViewport ? 12 : 16),
                        Row(
                          children: [
                            const Icon(
                              Icons.calendar_today_outlined,
                              size: 15,
                              color: AppColors.textPrimary,
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                dateLabel,
                                style: AppTypography.body.copyWith(
                                  fontSize: 14,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: context.isShortViewport ? 16 : 22),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
