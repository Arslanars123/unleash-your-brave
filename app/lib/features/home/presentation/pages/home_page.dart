import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/constants/event_constants.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/widgets/brand_logo.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/home/data/datasources/app_branding_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';
import 'package:unleash_your_brave/features/home/presentation/cubit/selected_event_cubit.dart';
import 'package:unleash_your_brave/features/home/presentation/widgets/event_countdown.dart';
import 'package:unleash_your_brave/features/home/presentation/widgets/quick_action_card.dart';
import 'package:unleash_your_brave/features/home/presentation/widgets/welcome_card.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  String _homeCoverImage = '';

  @override
  void initState() {
    super.initState();
    unawaited(sl<SelectedEventCubit>().restoreCurrentEvent());
    unawaited(_loadHomeCover());
  }

  Future<void> _refresh() async {
    await Future.wait([
      sl<SelectedEventCubit>().restoreCurrentEvent(),
      _loadHomeCover(),
    ]);
  }

  Future<void> _loadHomeCover() async {
    try {
      final branding = await sl<AppBrandingRemoteDataSource>().get();
      if (!mounted) return;
      setState(() => _homeCoverImage = branding.homeCoverImage);
    } catch (_) {
      // Keep the bundled default cover if branding is unavailable.
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, authState) {
        final user = authState is AuthAuthenticated ? authState.user : null;
        final sidePad = context.pagePadding.left;
        final heroHeight = context
            .responsive(
              compact: context.screenHeight * 0.42,
              medium: context.screenHeight * 0.38,
              expanded: 420.0,
            )
            .clamp(280.0, 460.0)
            .toDouble();

        return BlocBuilder<SelectedEventCubit, SelectedEventState>(
          builder: (context, eventState) {
            final loading = eventState.loading && eventState.event == null;
            final hasError =
                eventState.error != null && eventState.event == null;

            return Scaffold(
              key: _scaffoldKey,
              backgroundColor: AppColors.bgBase,
              drawer: _HomeDrawer(user: user),
              body: RefreshIndicator(
                color: AppColors.accentPink,
                onRefresh: _refresh,
                child: loading
                    ? const _ScrollableFill(
                        child: Center(
                          child: CircularProgressIndicator(
                            color: AppColors.accentPink,
                          ),
                        ),
                      )
                    : hasError
                        ? _ScrollableFill(
                            child: LoadErrorView(
                              kind: LoadErrorKind.generic,
                              message: eventState.error,
                              onRetry: _refresh,
                              retrying: false,
                            ),
                          )
                        : _HomeContent(
                            user: user,
                            event: eventState.event,
                            sidePad: sidePad,
                            heroHeight: heroHeight,
                            refreshing: eventState.loading,
                            homeCoverImage: _homeCoverImage,
                            onOpenDrawer: () =>
                                _scaffoldKey.currentState?.openDrawer(),
                          ),
              ),
            );
          },
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
    required this.homeCoverImage,
    required this.onOpenDrawer,
  });

  final UserEntity? user;
  final EventEntity? event;
  final double sidePad;
  final double heroHeight;
  final bool refreshing;
  final String homeCoverImage;
  final VoidCallback onOpenDrawer;

  @override
  Widget build(BuildContext context) {
    final eventId = event?.id;
    final statusLabel = event?.status.toUpperCase();

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
            statusLabel: statusLabel,
            coverImage: homeCoverImage,
            onOpenDrawer: onOpenDrawer,
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
                            icon: Icons.qr_code_2,
                            title: 'Check-in',
                            subtitle: 'Selected event QR',
                            onTap: () {
                              final q = eventId != null && eventId.isNotEmpty
                                  ? '/check-in?eventId=$eventId'
                                  : '/check-in';
                              context.push(q);
                            },
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
    required this.onOpenDrawer,
    this.eventName,
    this.statusLabel,
    this.coverImage = '',
  });

  final double height;
  final double horizontalPadding;
  final String dateLabel;
  final VoidCallback onOpenDrawer;
  final String? eventName;
  final String? statusLabel;
  final String coverImage;

  @override
  Widget build(BuildContext context) {
    final headlineSize = context.headlineSize;
    final hasCover = isLoadableMediaUrl(coverImage);
    final coverUrl = resolveMediaUrl(coverImage);

    return SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (hasCover)
            CachedNetworkImage(
              imageUrl: coverUrl,
              fit: BoxFit.cover,
              alignment: const Alignment(0, -0.35),
              errorWidget: (_, __, ___) => Image.asset(
                'assets/images/hero_home.jpg',
                fit: BoxFit.cover,
                alignment: const Alignment(0, -0.35),
                errorBuilder: (_, __, ___) =>
                    Container(color: AppColors.bgMaroon),
              ),
              placeholder: (_, __) => Container(color: AppColors.bgMaroon),
            )
          else
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
                context.isShortViewport ? 8 : 12,
                horizontalPadding,
                0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      onPressed: onOpenDrawer,
                      tooltip: 'Menu',
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.black.withValues(alpha: 0.35),
                        foregroundColor: AppColors.textPrimary,
                      ),
                      icon: const Icon(Icons.menu_rounded),
                    ),
                  ),
                  Expanded(
                    child: Align(
                      alignment: Alignment.bottomLeft,
                      child: Center(
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            maxWidth: context.maxContentWidth,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      eventName?.toUpperCase().isNotEmpty ==
                                              true
                                          ? eventName!.toUpperCase()
                                          : EventConstants.brandLiveLabel,
                                      style: AppTypography.microLabel.copyWith(
                                        color: AppColors.textPrimary,
                                        letterSpacing: 2.0,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ),
                                  if (statusLabel != null &&
                                      statusLabel!.isNotEmpty) ...[
                                    const SizedBox(width: 10),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.accentPink
                                            .withValues(alpha: 0.2),
                                        borderRadius:
                                            BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        statusLabel!,
                                        style:
                                            AppTypography.microLabel.copyWith(
                                          color: AppColors.accentPink,
                                          letterSpacing: 1.1,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              SizedBox(
                                height: context.isShortViewport ? 10 : 14,
                              ),
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
                                      style: AppTypography.headlineEmphasis
                                          .copyWith(
                                        fontSize: headlineSize,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              SizedBox(
                                height: context.isShortViewport ? 12 : 16,
                              ),
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
                              SizedBox(
                                height: context.isShortViewport ? 16 : 22,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeDrawer extends StatelessWidget {
  const _HomeDrawer({this.user});

  final UserEntity? user;

  void _go(BuildContext context, String location) {
    Navigator.of(context).pop();
    context.push(location);
  }

  @override
  Widget build(BuildContext context) {
    final name = user?.name.trim();
    return Drawer(
      backgroundColor: AppColors.bgBase,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Column(
                children: [
                  const BrandLogo(height: 68, alignment: Alignment.center),
                  const SizedBox(height: 16),
                  Text(
                    (name != null && name.isNotEmpty) ? name : 'Menu',
                    textAlign: TextAlign.center,
                    style: AppTypography.headline.copyWith(fontSize: 24),
                  ),
                  if (user?.email.isNotEmpty == true) ...[
                    const SizedBox(height: 4),
                    Text(
                      user!.email,
                      textAlign: TextAlign.center,
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Divider(color: AppColors.borderSubtle, height: 1),
            const SizedBox(height: 8),
            _DrawerTile(
              icon: Icons.event_available_outlined,
              title: 'My events',
              subtitle: 'Your purchased bookings',
              onTap: () => _go(context, '/events'),
            ),
            _DrawerTile(
              icon: Icons.upcoming_outlined,
              title: 'Upcoming events',
              subtitle: 'Events you can still book',
              onTap: () => _go(context, '/events?focus=discover'),
            ),
            _DrawerTile(
              icon: Icons.history_outlined,
              title: 'Previous events',
              subtitle: 'All past editions',
              onTap: () => _go(context, '/events?focus=previous'),
            ),
            _DrawerTile(
              icon: Icons.storefront_outlined,
              title: 'Sponsors',
              subtitle: 'Partner offers & resources',
              onTap: () => _go(context, '/sponsors'),
            ),
            _DrawerTile(
              icon: Icons.shopping_bag_outlined,
              title: 'Store',
              subtitle: 'Browse products & merch',
              onTap: () => _go(context, '/store'),
            ),
            const Spacer(),
            const Divider(color: AppColors.borderSubtle, height: 1),
            _DrawerTile(
              icon: Icons.logout,
              title: 'Sign out',
              onTap: () {
                Navigator.of(context).pop();
                context.read<AuthBloc>().add(const AuthLogoutRequested());
                context.go('/login');
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  const _DrawerTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.accentPink),
      title: Text(
        title,
        style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
      ),
      subtitle: subtitle == null
          ? null
          : Text(
              subtitle!,
              style: AppTypography.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
      onTap: onTap,
    );
  }
}
