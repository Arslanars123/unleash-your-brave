import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/notifications/push_notification_service.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/app_circle_avatar.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/checkin/presentation/attendee_access_refresh.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/presentation/cubit/selected_event_cubit.dart';
import 'package:unleash_your_brave/features/memberships/data/datasources/memberships_remote_datasource.dart';
import 'package:unleash_your_brave/features/memberships/domain/entities/membership_entity.dart';
import 'package:unleash_your_brave/features/memberships/presentation/widgets/membership_sale_meta.dart';
import 'package:url_launcher/url_launcher.dart';

({String firstName, String lastName}) _splitDisplayName(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return (firstName: 'Attendee', lastName: 'Member');
  if (parts.length == 1) return (firstName: parts.first, lastName: parts.first);
  return (firstName: parts.first, lastName: parts.sublist(1).join(' '));
}

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        final user = state is AuthAuthenticated ? state.user : null;

        return Scaffold(
          backgroundColor: AppColors.bgBase,
          body: AdaptiveScrollBody(
            padding: EdgeInsets.zero,
            useSafeArea: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ProfileHero(user: user),
                Padding(
                  padding: context.pagePadding.copyWith(top: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (user != null) ...[
                        _QuickActions(
                          onEdit: () async {
                            await context.push('/profile/edit');
                            if (!context.mounted) return;
                            context
                                .read<AuthBloc>()
                                .add(const AuthRefreshRequested());
                          },
                          onNotifications: () => context.push('/notifications'),
                        ),
                        SizedBox(height: context.sectionGap),
                        _MembershipSection(user: user),
                        SizedBox(height: context.sectionGap),
                        _AboutSection(user: user),
                        SizedBox(height: context.sectionGap),
                        _LinksSection(user: user),
                        SizedBox(height: context.sectionGap),
                        const _SettingsSection(),
                        SizedBox(height: context.sectionGap * 1.2),
                      ],
                      OutlinedButton.icon(
                        onPressed: () {
                          context
                              .read<AuthBloc>()
                              .add(const AuthLogoutRequested());
                          context.go('/login');
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textSecondary,
                          side: const BorderSide(color: AppColors.borderSubtle),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        icon: const Icon(Icons.logout, size: 18),
                        label: const Text('Sign out'),
                      ),
                      SizedBox(height: context.sectionGap),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.user});

  final UserEntity? user;

  @override
  Widget build(BuildContext context) {
    final name = user?.name ?? 'Guest';
    final title = [
      if (user?.title.isNotEmpty == true) user!.title,
      if (user?.business.isNotEmpty == true) user!.business,
    ].join(' · ');

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF2A1218),
            AppColors.bgBase,
          ],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            context.pagePadding.left,
            12,
            context.pagePadding.right,
            8,
          ),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'YOUR PROFILE',
                  style: AppTypography.microLabel.copyWith(
                    color: AppColors.accentPink,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              AppCircleAvatar(
                key: ValueKey('profile-avatar-${user?.photoUrl ?? ''}'),
                radius: 48,
                photoUrl: user?.photoUrl,
                cacheBust: user?.photoUrl,
                backgroundColor: AppColors.accentPink.withValues(alpha: 0.18),
                fallback: Text(
                  _initials(name),
                  style: AppTypography.headline.copyWith(
                    fontSize: 28,
                    color: AppColors.accentPink,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                name,
                textAlign: TextAlign.center,
                style: AppTypography.headline.copyWith(fontSize: 26),
              ),
              if (title.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              if (user?.email.isNotEmpty == true) ...[
                const SizedBox(height: 4),
                Text(
                  user!.email,
                  textAlign: TextAlign.center,
                  style: AppTypography.caption,
                ),
              ],
              if (user?.location.isNotEmpty == true) ...[
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.place_outlined,
                      size: 14,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Text(user!.location, style: AppTypography.caption),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.onEdit,
    required this.onNotifications,
  });

  final VoidCallback onEdit;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionChip(
            icon: Icons.edit_outlined,
            label: 'Edit',
            onTap: onEdit,
            primary: true,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionChip(
            icon: Icons.notifications_outlined,
            label: 'Alerts',
            onTap: onNotifications,
          ),
        ),
      ],
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
    this.primary = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: primary
          ? AppColors.accentPink.withValues(alpha: 0.16)
          : AppColors.bgCard,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: primary
                  ? AppColors.accentPink.withValues(alpha: 0.35)
                  : AppColors.borderSubtle,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 20,
                color: primary ? AppColors.accentPink : AppColors.textPrimary,
              ),
              const SizedBox(height: 6),
              Text(
                label,
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w600,
                  color: primary ? AppColors.accentPink : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MembershipSection extends StatefulWidget {
  const _MembershipSection({required this.user});

  final UserEntity user;

  @override
  State<_MembershipSection> createState() => _MembershipSectionState();
}

class _MembershipSectionState extends State<_MembershipSection>
    with WidgetsBindingObserver {
  bool _loading = true;
  bool _upgrading = false;
  bool _awaitingCheckoutReturn = false;
  String? _error;
  /// All event-linked tiers (includes sale-closed). Used to resolve owned pass.
  List<MembershipEntity> _allMemberships = const [];
  /// Purchase-open tiers only. Used for buy/upgrade actions.
  List<MembershipEntity> _memberships = const [];
  EffectiveEventAccess? _access;
  String? _catalogEventId;
  String? _catalogEventName;
  Timer? _catalogPoll;
  StreamSubscription<String?>? _accessSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _accessSub = AttendeeAccessRefresh.instance.stream.listen((eventId) {
      if (!mounted) return;
      if (eventId != null &&
          eventId.isNotEmpty &&
          _catalogEventId != null &&
          _catalogEventId!.isNotEmpty &&
          _catalogEventId != eventId) {
        return;
      }
      unawaited(_load(silent: true));
    });
    _load();
    _catalogPoll = Timer.periodic(const Duration(seconds: 12), (_) {
      if (!mounted || _loading) return;
      unawaited(_load(silent: true));
    });
  }

  @override
  void dispose() {
    _accessSub?.cancel();
    _catalogPoll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _awaitingCheckoutReturn) {
      _awaitingCheckoutReturn = false;
      if (!mounted) return;
      context.read<AuthBloc>().add(const AuthRefreshRequested());
      AppToast.success('If payment succeeded, your event plan will update shortly.');
    }
  }

  @override
  void didUpdateWidget(covariant _MembershipSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.membershipId != widget.user.membershipId) {
      setState(() {});
    }
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      String? eventId;
      String? eventName;
      try {
        final cubit = sl<SelectedEventCubit>();
        await cubit.ensureReady(force: true);
        eventId = cubit.state.eventId;
        eventName = cubit.state.event?.name;
        var selectedStatus = cubit.state.event?.status;

        if (eventId == null || eventId.isEmpty) {
          final event = await sl<EventsRemoteDataSource>().getCurrent();
          eventId = event.id;
          eventName = event.name;
          selectedStatus = event.status;
        }

        // After an edition ends, prefer the next live/upcoming catalog for purchases.
        if (selectedStatus == 'ended') {
          try {
            final available = await sl<EventsRemoteDataSource>().listAvailable();
            final next = available.where((e) => e.isLive || e.isUpcoming).toList();
            if (next.isNotEmpty) {
              eventId = next.first.id;
              eventName = next.first.name;
            }
          } catch (_) {
            // Keep ended event catalog if available list fails.
          }
        }
      } catch (_) {
        // Fall back to all memberships if event lookup fails.
      }
      final ds = sl<MembershipsRemoteDataSource>();
      // Full event-linked list (includes sale-closed) for owned-pass display.
      final allItems = await ds.list(eventId: eventId);
      List<MembershipEntity> purchasableItems;
      try {
        purchasableItems =
            MembershipEntity.purchasableOnly(await ds.catalog(eventId: eventId));
      } catch (_) {
        purchasableItems = MembershipEntity.purchasableOnly(allItems);
      }
      EffectiveEventAccess? access;
      try {
        access = await ds.myAccess(eventId: eventId);
      } catch (_) {
        access = null;
      }
      // Hydrate owned tier only from a real membership record (no name-only ghosts).
      final allWithOwned = [...allItems];
      final owned = await _resolveOwnedMembership(
        allItems: allWithOwned,
        access: access,
        dataSource: ds,
      );
      if (owned != null &&
          allWithOwned.every((item) => item.id != owned.id)) {
        allWithOwned.add(owned);
      }
      if (!mounted) return;
      setState(() {
        _catalogEventId = eventId;
        _catalogEventName = eventName;
        _allMemberships = allWithOwned;
        _memberships = [...purchasableItems]
          ..sort((a, b) {
            final bySort = a.sortOrder.compareTo(b.sortOrder);
            if (bySort != 0) return bySort;
            return a.price.compareTo(b.price);
          });
        _access = access;
        _loading = false;
        if (!silent) _error = null;
      });
    } on NetworkException catch (error) {
      if (!mounted || silent) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } on ServerException catch (error) {
      if (!mounted || silent) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted || silent) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load event plans';
      });
    }
  }

  static const _ineligiblePurchaseMessage =
      'You cannot purchase this event plan. You can only continue with your current plan or upgrade to a higher event plan.';

  MembershipEntity? _findMembershipById(
    List<MembershipEntity> items,
    String? id,
  ) {
    if (id == null || id.isEmpty) return null;
    for (final item in items) {
      if (item.id == id) return item;
    }
    return null;
  }

  /// Resolves the owned pass to a real membership document only.
  /// Never invents a tier from a bare id/name (avoids ghost passes).
  Future<MembershipEntity?> _resolveOwnedMembership({
    required List<MembershipEntity> allItems,
    required EffectiveEventAccess? access,
    required MembershipsRemoteDataSource dataSource,
  }) async {
    final effectiveId = access?.effectiveMembershipId?.trim();
    if (effectiveId != null && effectiveId.isNotEmpty) {
      final inList = _findMembershipById(allItems, effectiveId);
      if (inList != null) return inList;
      try {
        final remote = await dataSource.getById(effectiveId);
        if (remote.id == effectiveId) return remote;
      } catch (_) {
        // Deleted / unknown id → treat as no pass (no ghost).
      }
      return null;
    }

    // Access did not assert an effective id: only trust event-linked list match.
    return _findMembershipById(allItems, widget.user.membershipId);
  }

  MembershipEntity? get _current {
    final effectiveId = _access?.effectiveMembershipId;
    final fromEffective = _findMembershipById(_allMemberships, effectiveId);
    if (fromEffective != null) return fromEffective;
    return _findMembershipById(_allMemberships, widget.user.membershipId);
  }

  List<MembershipEntity> get _allPlans {
    final byId = <String, MembershipEntity>{};
    for (final item in _memberships) {
      byId[item.id] = item;
    }
    final current = _current;
    if (current != null) {
      byId.putIfAbsent(current.id, () => current);
    }
    final items = byId.values.toList()
      ..sort((a, b) {
        final byRank = a.upgradeRank.compareTo(b.upgradeRank);
        if (byRank != 0) return byRank;
        final bySort = a.sortOrder.compareTo(b.sortOrder);
        if (bySort != 0) return bySort;
        return a.price.compareTo(b.price);
      });
    return items;
  }

  bool _isCurrentPlan(MembershipEntity membership) {
    final current = _current;
    if (current == null) return false;
    return current.id == membership.id;
  }

  bool _isUpgradeEligible(MembershipEntity membership) {
    final current = _current;
    if (current == null) return true;
    if (membership.id == current.id) return false;
    return membership.upgradeRank > current.upgradeRank;
  }

  bool _canCheckout(MembershipEntity membership) {
    if (_isCurrentPlan(membership)) {
      return membership.isRenewable;
    }
    return _isUpgradeEligible(membership) || _current == null;
  }

  String? _planActionLabel(MembershipEntity membership) {
    if (_isCurrentPlan(membership)) {
      return membership.isRenewable ? 'Renew ${membership.priceLabel}' : null;
    }
    if (_current == null) return 'Purchase ${membership.priceLabel}';
    if (_isUpgradeEligible(membership)) {
      return 'Upgrade · ${membership.priceLabel}';
    }
    return 'Not available';
  }

  void _showIneligibleMessage() {
    if (!mounted) return;
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        ),
        title: Text(
          'Upgrade only',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        content: Text(
          _ineligiblePurchaseMessage,
          style: AppTypography.caption.copyWith(height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Got it',
              style: AppTypography.button.copyWith(
                color: AppColors.accentPink,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _upgrade(MembershipEntity membership) async {
    if (!_canCheckout(membership)) {
      _showIneligibleMessage();
      return;
    }

    final currentId = widget.user.membershipId;
    final isRenew =
        currentId != null && currentId.isNotEmpty && currentId == membership.id;
    final isUpgrade = currentId != null &&
        currentId.isNotEmpty &&
        currentId != membership.id;
    final result = await showDialog<_CheckoutCouponResult>(
      context: context,
      builder: (context) => _MembershipCheckoutDialog(
        membership: membership,
        mode: isRenew ? 'renew' : isUpgrade ? 'upgrade' : 'purchase',
      ),
    );
    if (result == null || !mounted) return;

    setState(() => _upgrading = true);
    try {
      final ds = sl<MembershipsRemoteDataSource>();
      final eligibility = await ds.checkEligibility(
        email: widget.user.email,
        membershipId: membership.id,
        eventId: _catalogEventId,
      );
      if (!eligibility.allowed) {
        final reason = eligibility.reason ?? '';
        final looksLikeDowngrade = reason.toLowerCase().contains('upgrade') ||
            reason.toLowerCase().contains('downgrade') ||
            reason.toLowerCase().contains('same-tier');
        if (looksLikeDowngrade || reason.isEmpty) {
          _showIneligibleMessage();
        } else {
          AppToast.error(reason);
        }
        return;
      }

      final names = _splitDisplayName(widget.user.name);
      final session = await ds.createCheckoutSession(
        membershipId: membership.id,
        email: widget.user.email,
        firstName: names.firstName,
        lastName: names.lastName,
        eventId: _catalogEventId,
        successUrl: ApiConstants.checkoutSuccessUrl,
        cancelUrl: ApiConstants.checkoutCancelUrl,
        couponCode: result.couponCode,
        expectedPrice: result.membership.price,
        expectedUpdatedAt: result.membership.updatedAt,
      );

      final uri = Uri.tryParse(session.checkoutUrl);
      if (uri == null) {
        AppToast.error('Invalid checkout link');
        return;
      }

      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened) {
        AppToast.error('Unable to open Stripe checkout');
        return;
      }

      _awaitingCheckoutReturn = true;
      if (!mounted) return;
      AppToast.success('Complete payment in your browser, then return to the app.');
    } on NetworkException catch (error) {
      AppToast.error(error.message);
    } on ServerException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('upgrade') ||
          message.contains('downgrade') ||
          message.contains('same-tier') ||
          message.contains('higher-level')) {
        _showIneligibleMessage();
      } else {
        AppToast.error(error.message);
      }
    } catch (_) {
      AppToast.error('Unable to start checkout');
    } finally {
      if (mounted) setState(() => _upgrading = false);
    }
  }

  void _showUpgradeSheet() {
    final plans = _allPlans;
    final current = _current;
    final hasUpgrade = plans.any(_isUpgradeEligible);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgBase,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        final maxHeight = MediaQuery.sizeOf(context).height * 0.82;
        return SafeArea(
          top: false,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxHeight),
            child: Column(
              mainAxisSize: MainAxisSize.min,
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
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Event plans',
                        style: AppTypography.headline.copyWith(fontSize: 26),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        current == null
                            ? 'Browse every event plan below. Pay securely with Stripe to unlock your plan.'
                            : 'All event plans are shown below. You can keep your current plan or upgrade to a higher event plan only.',
                        style: AppTypography.caption.copyWith(height: 1.4),
                      ),
                    ],
                  ),
                ),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    children: [
                      if (current != null && !hasUpgrade) ...[
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 14),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.bgCard,
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusCard),
                            border: Border.all(color: AppColors.borderSubtle),
                          ),
                          child: Text(
                            'You’re already on the highest available event plan for this event.',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                      Text(
                        'ALL PLANS',
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.4,
                          color: AppColors.textTertiary,
                        ),
                      ),
                      const SizedBox(height: 10),
                      for (var i = 0; i < plans.length; i++) ...[
                        if (i > 0) const SizedBox(height: 12),
                        Builder(
                          builder: (_) {
                            final plan = plans[i];
                            final isCurrent = _isCurrentPlan(plan);
                            final canBuy = _canCheckout(plan);
                            final isUpgrade = _isUpgradeEligible(plan);
                            return _MembershipTierheetCard(
                              membership: plan,
                              isCurrent: isCurrent,
                              featured: isUpgrade &&
                                  plan.upgradeRank ==
                                      plans.map((p) => p.upgradeRank).fold<double>(
                                            0,
                                            (max, v) => v > max ? v : max,
                                          ),
                              unavailable: !canBuy && !isCurrent,
                              unavailableMessage: !canBuy && !isCurrent
                                  ? _ineligiblePurchaseMessage
                                  : null,
                              selectLabel: _planActionLabel(plan),
                              onSelect: _upgrading || (!canBuy && isCurrent)
                                  ? null
                                  : () {
                                      if (!canBuy) {
                                        _showIneligibleMessage();
                                        return;
                                      }
                                      Navigator.pop(context);
                                      _upgrade(plan);
                                    },
                            );
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final current = _current;
    final canOpenSheet = !_loading &&
        _error == null &&
        (_memberships.isNotEmpty || current != null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Event plans',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        const SizedBox(height: 12),
        if (_loading)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 36),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(AppTheme.radiusCard),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.accentPink,
              ),
            ),
          )
        else if (_error != null)
          Container(
            width: double.infinity,
            padding: context.cardPadding,
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(AppTheme.radiusCard),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_error!, style: AppTypography.caption),
                TextButton(onPressed: _load, child: const Text('Retry')),
              ],
            ),
          )
        else
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: canOpenSheet && !_upgrading ? _showUpgradeSheet : null,
              borderRadius: BorderRadius.circular(AppTheme.radiusCard),
              child: Ink(
                width: double.infinity,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF3A1522),
                      AppColors.bgMaroon,
                      Color(0xFF140C10),
                    ],
                  ),
                  border: Border.all(
                    color: AppColors.accentPink.withValues(alpha: 0.35),
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: -18,
                      top: -24,
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.accentPink.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 28,
                      bottom: -36,
                      child: Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.accentPink.withValues(alpha: 0.05),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.accentPink.withValues(alpha: 0.16),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color: AppColors.accentPink.withValues(alpha: 0.35),
                                  ),
                                ),
                                child: Text(
                                  current == null
                                      ? 'NO PASS'
                                      : (_access?.carriedFromPrevious == true
                                          ? 'CARRIED PASS'
                                          : 'CURRENT PASS'),
                                  style: AppTypography.microLabel.copyWith(
                                    color: AppColors.accentPink,
                                    letterSpacing: 1.3,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                              if (_catalogEventName != null &&
                                  _catalogEventName!.trim().isNotEmpty) ...[
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    _catalogEventName!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.microLabel.copyWith(
                                      color: AppColors.textSecondary,
                                      letterSpacing: 0.4,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                              ] else
                                const Spacer(),
                              if (_upgrading)
                                const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.accentPink,
                                  ),
                                )
                              else
                                Icon(
                                  Icons.keyboard_arrow_up_rounded,
                                  color: AppColors.textSecondary.withValues(alpha: 0.9),
                                ),
                            ],
                          ),
                          const SizedBox(height: 18),
                          Text(
                            current?.name ?? 'Choose an event plan',
                            style: AppTypography.headline.copyWith(fontSize: 28),
                          ),
                          const SizedBox(height: 8),
                          if (current != null) ...[
                            Text(
                              current.priceLabel,
                              style: AppTypography.body.copyWith(
                                color: AppColors.accentPink,
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                            if (current.description.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              Text(
                                current.description,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.caption.copyWith(
                                  height: 1.4,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ] else
                            Text(
                              'Tap to browse tiers and unlock restricted sessions.',
                              style: AppTypography.caption.copyWith(height: 1.4),
                            ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Text(
                                current == null
                                    ? 'Browse event plans'
                                    : 'View all plans & upgrades',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Icon(
                                Icons.arrow_forward_rounded,
                                size: 16,
                                color: AppColors.accentPink,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MembershipTierheetCard extends StatelessWidget {
  const _MembershipTierheetCard({
    required this.membership,
    this.isCurrent = false,
    this.featured = false,
    this.unavailable = false,
    this.unavailableMessage,
    this.onSelect,
    this.selectLabel,
  });

  final MembershipEntity membership;
  final bool isCurrent;
  final bool featured;
  final bool unavailable;
  final String? unavailableMessage;
  final VoidCallback? onSelect;
  final String? selectLabel;

  @override
  Widget build(BuildContext context) {
    final borderColor = isCurrent
        ? AppColors.accentPink.withValues(alpha: 0.45)
        : unavailable
            ? AppColors.borderSubtle
            : featured
                ? AppColors.accentPink.withValues(alpha: 0.28)
                : AppColors.borderSubtle;
    final showAction = onSelect != null;

    return Opacity(
      opacity: unavailable ? 0.78 : 1,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isCurrent || featured ? AppColors.bgMaroon : AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          border: Border.all(color: borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (isCurrent || featured || unavailable) ...[
                        Text(
                          isCurrent
                              ? 'YOUR TIER'
                              : unavailable
                                  ? 'LOWER / UNAVAILABLE'
                                  : 'UPGRADE',
                          style: AppTypography.microLabel.copyWith(
                            color: unavailable
                                ? AppColors.textTertiary
                                : AppColors.accentPink,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w700,
                            fontSize: 10,
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
                      Text(
                        membership.name,
                        style: AppTypography.body.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 17,
                        ),
                      ),
                      if (membership.isRenewable) ...[
                        const SizedBox(height: 4),
                        Text(
                          membership.durationDays > 0
                              ? 'Renewable · ${membership.durationDays} days'
                              : 'Renewable',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ],
                      if (membership.hasBadgeLabel) ...[
                        const SizedBox(height: 8),
                        MembershipBadgeChip(label: membership.badgeLabel!.trim()),
                      ],
                      if (membership.saleDeadlineLabel != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          membership.saleDeadlineLabel!,
                          style: AppTypography.caption.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Text(
                  membership.priceLabel,
                  style: AppTypography.headline.copyWith(
                    fontSize: 22,
                    color: unavailable
                        ? AppColors.textTertiary
                        : AppColors.accentPink,
                  ),
                ),
              ],
            ),
            if (membership.paymentPlanNote.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                membership.paymentPlanNote,
                style: AppTypography.caption.copyWith(
                  color: AppColors.textTertiary,
                ),
              ),
            ],
            if (membership.features.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...membership.features.take(4).map(
                    (f) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '•  ',
                            style: TextStyle(
                              color: unavailable
                                  ? AppColors.textTertiary
                                  : AppColors.accentPink,
                            ),
                          ),
                          Expanded(
                            child: Text(
                              f,
                              style: AppTypography.caption.copyWith(
                                height: 1.4,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ] else if (membership.description.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                membership.description,
                style: AppTypography.caption.copyWith(
                  height: 1.45,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            if (unavailable && unavailableMessage != null) ...[
              const SizedBox(height: 12),
              Text(
                unavailableMessage!,
                style: AppTypography.caption.copyWith(
                  height: 1.4,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            if (showAction) ...[
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  onPressed: onSelect,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: unavailable
                        ? AppColors.bgCard
                        : featured || isCurrent
                            ? AppColors.accentPink
                            : AppColors.accentPink.withValues(alpha: 0.85),
                    foregroundColor: unavailable
                        ? AppColors.textSecondary
                        : null,
                    side: unavailable
                        ? const BorderSide(color: AppColors.borderSubtle)
                        : null,
                  ),
                  child: Text(
                    selectLabel ?? 'Pay ${membership.priceLabel}',
                    style: AppTypography.button.copyWith(
                      fontSize: 14,
                      color: unavailable ? AppColors.textSecondary : null,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AboutSection extends StatelessWidget {
  const _AboutSection({required this.user});

  final UserEntity user;

  @override
  Widget build(BuildContext context) {
    final chips = <String>[
      if (user.industry.isNotEmpty) user.industry,
      ...user.interests.take(4),
    ];

    final hasBody = user.bio.isNotEmpty ||
        user.goals.isNotEmpty ||
        chips.isNotEmpty ||
        user.networkingPrefs.isNotEmpty;

    if (!hasBody) {
      return Container(
        padding: context.cardPadding,
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Complete your profile',
              style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              'Add a photo, bio, and interests so people at the event can find you.',
              style: AppTypography.caption,
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.push('/profile/edit'),
              child: const Text('Add details'),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'About',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        const SizedBox(height: 12),
        if (user.bio.isNotEmpty) ...[
          Text(user.bio, style: AppTypography.body.copyWith(height: 1.5)),
          const SizedBox(height: 14),
        ],
        if (chips.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: chips
                .map(
                  (c) => Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.bgCard,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: Text(c, style: AppTypography.caption),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 14),
        ],
        if (user.goals.isNotEmpty)
          _InfoRow(
            label: 'Goals',
            value: user.goals.join(' · '),
          ),
        _InfoRow(
          label: 'Networking',
          value: _networkingLabel(user.networkingPrefs),
        ),
      ],
    );
  }

  String _networkingLabel(String value) {
    return switch (value) {
      'open_to_all' => 'Open to all',
      'industry_peers' => 'Industry peers',
      'investors' => 'Investors',
      'mentors' => 'Mentors',
      'closed' => 'Closed',
      _ => value,
    };
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.microLabel.copyWith(
              color: AppColors.textTertiary,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(value, style: AppTypography.body),
        ],
      ),
    );
  }
}

class _LinksSection extends StatelessWidget {
  const _LinksSection({required this.user});

  final UserEntity user;

  @override
  Widget build(BuildContext context) {
    final links = <(IconData, String, String)>[
      if (user.linkedinUrl.isNotEmpty)
        (Icons.business_center_outlined, 'LinkedIn', user.linkedinUrl),
      if (user.instagramUrl.isNotEmpty)
        (Icons.camera_alt_outlined, 'Instagram', user.instagramUrl),
      if (user.websiteUrl.isNotEmpty)
        (Icons.language, 'Website', user.websiteUrl),
    ];

    if (links.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Links',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        const SizedBox(height: 10),
        ...links.map(
          (link) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => _open(link.$3),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: Row(
                    children: [
                      Icon(link.$1, size: 18, color: AppColors.accentPink),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          link.$2,
                          style: AppTypography.body.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.open_in_new,
                        size: 16,
                        color: AppColors.textTertiary,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _open(String raw) async {
    var url = raw.trim();
    if (!url.startsWith('http')) url = 'https://$url';
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class _SettingsSection extends StatefulWidget {
  const _SettingsSection();

  @override
  State<_SettingsSection> createState() => _SettingsSectionState();
}

class _SettingsSectionState extends State<_SettingsSection> {
  late bool _notificationsOn;
  bool _toggling = false;
  bool _deletingAccount = false;

  @override
  void initState() {
    super.initState();
    _notificationsOn = sl<PushNotificationService>().isEnabled;
  }

  Future<void> _onNotificationsChanged(bool value) async {
    if (_toggling) return;
    setState(() {
      _toggling = true;
      _notificationsOn = value;
    });

    try {
      final enabled = await sl<PushNotificationService>().setEnabled(value);
      if (!mounted) return;
      setState(() => _notificationsOn = enabled);
      if (value && !enabled) {
        AppToast.error(
          'Notifications are off in system Settings. We opened Settings — enable them for this app, then try again.',
        );
      } else {
        AppToast.success(
          enabled ? 'Notifications turned on' : 'Notifications turned off',
        );
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _notificationsOn = !value);
      AppToast.error('Unable to update notification preference');
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  Future<void> _confirmDeleteAccount() async {
    if (_deletingAccount) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This permanently deletes your account. You will be signed out and will not be able to sign in again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete account'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _deletingAccount = true);
    final result = await sl<AuthRepository>().deactivateMyAccount();
    if (!mounted) return;
    setState(() => _deletingAccount = false);

    result.fold(
      (failure) => AppToast.error(failure.message),
      (_) {
        context.read<AuthBloc>().add(const AuthLogoutRequested());
        context.go('/login');
        AppToast.success('Your account has been deleted');
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Settings',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: AppColors.bgCard,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                child: Row(
                  children: [
                    const Icon(
                      Icons.notifications_outlined,
                      size: 18,
                      color: AppColors.accentPink,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Push notifications',
                            style: AppTypography.body.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            'Chat alerts and announcements',
                            style: AppTypography.caption,
                          ),
                        ],
                      ),
                    ),
                    Switch.adaptive(
                      value: _notificationsOn,
                      onChanged: _toggling ? null : _onNotificationsChanged,
                      activeThumbColor: AppColors.accentPink,
                      activeTrackColor:
                          AppColors.accentPink.withValues(alpha: 0.35),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.borderSubtle),
              _SettingsLinkTile(
                icon: Icons.privacy_tip_outlined,
                label: 'Privacy Policy',
                onTap: () => context.push('/privacy-policy'),
              ),
              const Divider(height: 1, color: AppColors.borderSubtle),
              _SettingsLinkTile(
                icon: Icons.description_outlined,
                label: 'Terms & Conditions',
                onTap: () => context.push('/terms'),
              ),
              const Divider(height: 1, color: AppColors.borderSubtle),
              _SettingsLinkTile(
                icon: Icons.delete_forever_outlined,
                label: _deletingAccount ? 'Deleting account…' : 'Delete account',
                onTap: _deletingAccount ? () {} : _confirmDeleteAccount,
                danger: true,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SettingsLinkTile extends StatelessWidget {
  const _SettingsLinkTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? Colors.red.shade700 : AppColors.accentPink;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w600,
                    color: danger ? Colors.red.shade700 : null,
                  ),
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CheckoutCouponResult {
  const _CheckoutCouponResult({this.couponCode, required this.membership});

  final String? couponCode;
  final MembershipEntity membership;
}

class _MembershipCheckoutDialog extends StatefulWidget {
  const _MembershipCheckoutDialog({
    required this.membership,
    required this.mode,
  });

  final MembershipEntity membership;
  final String mode; // purchase | upgrade | renew

  @override
  State<_MembershipCheckoutDialog> createState() =>
      _MembershipCheckoutDialogState();
}

class _MembershipCheckoutDialogState extends State<_MembershipCheckoutDialog> {
  final _couponController = TextEditingController();
  CouponPreview? _preview;
  String? _previewError;
  bool _previewing = false;
  late MembershipEntity _membership;
  bool _changedWhileOpen = false;
  bool _didInitialSync = false;
  Timer? _livePoll;

  @override
  void initState() {
    super.initState();
    _membership = widget.membership;
    unawaited(_refreshMembership());
    _livePoll = Timer.periodic(const Duration(seconds: 8), (_) {
      unawaited(_refreshMembership());
    });
  }

  @override
  void dispose() {
    _livePoll?.cancel();
    _couponController.dispose();
    super.dispose();
  }

  Future<void> _refreshMembership() async {
    try {
      final latest = await sl<MembershipsRemoteDataSource>().getById(
        _membership.id,
      );
      if (!mounted) return;
      final changed = latest.checkoutFingerprint != _membership.checkoutFingerprint;
      setState(() {
        if (changed && _didInitialSync) {
          _changedWhileOpen = true;
        }
        _didInitialSync = true;
        _membership = latest;
      });
      if (changed && _couponController.text.trim().isNotEmpty) {
        unawaited(_applyCoupon());
      }
    } catch (_) {
      // Keep showing the last known details if a refresh fails.
    }
  }

  Future<void> _applyCoupon() async {
    final code = _couponController.text.trim();
    if (code.isEmpty) {
      setState(() {
        _preview = null;
        _previewError = 'Enter a coupon code';
      });
      return;
    }

    setState(() {
      _previewing = true;
      _previewError = null;
    });
    try {
      final preview = await sl<MembershipsRemoteDataSource>().previewCoupon(
        code: code,
        membershipId: _membership.id,
      );
      if (!mounted) return;
      setState(() {
        _preview = preview.valid ? preview : null;
        _previewError = preview.valid
            ? null
            : (preview.reason ?? 'This coupon is not valid for this event plan');
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() {
        _preview = null;
        _previewError = error.message;
      });
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() {
        _preview = null;
        _previewError = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _preview = null;
        _previewError = 'Unable to check coupon';
      });
    } finally {
      if (mounted) setState(() => _previewing = false);
    }
  }

  String _money(double value) {
    if (value == value.roundToDouble()) {
      return '\$${value.toStringAsFixed(0)}';
    }
    return '\$${value.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    final membership = _membership;
    final priceLine = _preview?.valid == true
        ? '${_money(_preview!.originalPrice)} → ${_money(_preview!.finalPrice)} '
            '(${_preview!.percentOff.toStringAsFixed(0)}% off)'
        : membership.priceLabel;

    final title = switch (widget.mode) {
      'renew' => 'Renew ${membership.name}?',
      'upgrade' => 'Upgrade to ${membership.name}?',
      _ => 'Purchase ${membership.name}?',
    };
    final bodyLead = switch (widget.mode) {
      'renew' =>
        'You’ll complete a secure Stripe renewal payment for $priceLine. '
            'Your event plan stays active and your check-in QR remains enabled after payment.',
      'upgrade' =>
        'You’ll complete a secure Stripe payment for $priceLine. '
            'Your event plan updates automatically after payment.',
      _ =>
        'You’ll complete a secure Stripe payment for $priceLine. '
            'Your event plan unlocks after payment succeeds.',
    };

    return AlertDialog(
      backgroundColor: AppColors.bgCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      ),
      title: Text(
        title,
        style: AppTypography.body.copyWith(
          fontWeight: FontWeight.w700,
          fontSize: 18,
        ),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_changedWhileOpen) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.accentPink.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'This event plan was just updated. Please review the new price and details before paying.',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.accentPink,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Text(
              bodyLead,
              style: AppTypography.caption.copyWith(height: 1.45),
            ),
            if (membership.description.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                membership.description.trim(),
                style: AppTypography.caption.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
            ],
            const SizedBox(height: 16),
            Text(
              'Coupon code (optional)',
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: _couponController,
                    textCapitalization: TextCapitalization.characters,
                    style: AppTypography.body.copyWith(fontSize: 15),
                    decoration: InputDecoration(
                      hintText: 'e.g. BRAVE20',
                      hintStyle: AppTypography.caption.copyWith(
                        color: AppColors.textTertiary,
                      ),
                      filled: true,
                      fillColor: AppColors.bgBase,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onChanged: (_) {
                      if (_preview != null || _previewError != null) {
                        setState(() {
                          _preview = null;
                          _previewError = null;
                        });
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: _previewing ? null : _applyCoupon,
                  child: Text(
                    _previewing ? '…' : 'Apply',
                    style: AppTypography.button.copyWith(
                      color: AppColors.accentPink,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
            if (_previewError != null) ...[
              const SizedBox(height: 8),
              Text(
                _previewError!,
                style: AppTypography.caption.copyWith(
                  color: Colors.redAccent,
                  height: 1.35,
                ),
              ),
            ],
            if (_preview?.valid == true) ...[
              const SizedBox(height: 8),
              Text(
                'Coupon ${_preview!.code} applied — save ${_money(_preview!.discountAmount)}',
                style: AppTypography.caption.copyWith(
                  color: AppColors.accentPink,
                  fontWeight: FontWeight.w600,
                  height: 1.35,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(
            'Cancel',
            style: AppTypography.button.copyWith(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
        ),
        TextButton(
          onPressed: () {
            final code = _couponController.text.trim();
            Navigator.pop(
              context,
              _CheckoutCouponResult(
                couponCode: code.isEmpty ? null : code,
                membership: _membership,
              ),
            );
          },
          child: Text(
            'Continue to payment',
            style: AppTypography.button.copyWith(
              color: AppColors.accentPink,
              fontSize: 14,
            ),
          ),
        ),
      ],
    );
  }
}
