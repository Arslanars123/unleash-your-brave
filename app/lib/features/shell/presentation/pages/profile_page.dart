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
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/memberships/data/datasources/memberships_remote_datasource.dart';
import 'package:unleash_your_brave/features/memberships/domain/entities/membership_entity.dart';
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
                          onCheckIn: () => context.push('/check-in'),
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
    required this.onCheckIn,
    required this.onNotifications,
  });

  final VoidCallback onEdit;
  final VoidCallback onCheckIn;
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
            icon: Icons.qr_code_2,
            label: 'Check-in',
            onTap: onCheckIn,
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
  List<MembershipEntity> _memberships = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _awaitingCheckoutReturn) {
      _awaitingCheckoutReturn = false;
      if (!mounted) return;
      context.read<AuthBloc>().add(const AuthRefreshRequested());
      AppToast.success('If payment succeeded, your membership will update shortly.');
    }
  }

  @override
  void didUpdateWidget(covariant _MembershipSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.membershipId != widget.user.membershipId) {
      setState(() {});
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      String? eventId;
      try {
        final event = await sl<EventsRemoteDataSource>().getCurrent();
        eventId = event.id;
      } catch (_) {
        // Fall back to all memberships if event lookup fails.
      }
      List<MembershipEntity> items;
      try {
        items = await sl<MembershipsRemoteDataSource>().catalog(eventId: eventId);
      } catch (_) {
        items = await sl<MembershipsRemoteDataSource>().list(eventId: eventId);
      }
      if (!mounted) return;
      setState(() {
        _memberships = [...items]
          ..sort((a, b) {
            final bySort = a.sortOrder.compareTo(b.sortOrder);
            if (bySort != 0) return bySort;
            return a.price.compareTo(b.price);
          });
        _loading = false;
      });
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
        _error = 'Unable to load memberships';
      });
    }
  }

  MembershipEntity? get _current {
    final id = widget.user.membershipId;
    if (id == null || id.isEmpty) return null;
    for (final item in _memberships) {
      if (item.id == id) return item;
    }
    return null;
  }

  List<MembershipEntity> get _upgrades {
    final id = widget.user.membershipId;
    if (id == null || id.isEmpty) {
      return _memberships;
    }
    final currentRank = _current?.upgradeRank ?? 0;
    return _memberships
        .where((m) => m.id != id && m.upgradeRank > currentRank)
        .toList(growable: false);
  }

  Future<void> _upgrade(MembershipEntity membership) async {
    final isUpgrade = widget.user.membershipId != null &&
        widget.user.membershipId!.isNotEmpty;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        ),
        title: Text(
          isUpgrade
              ? 'Upgrade to ${membership.name}?'
              : 'Purchase ${membership.name}?',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        content: Text(
          isUpgrade
              ? 'You’ll complete a secure Stripe payment for ${membership.priceLabel}. '
                  'Your membership updates automatically after payment.'
              : 'You’ll complete a secure Stripe payment for ${membership.priceLabel}. '
                  'Your pass unlocks after payment succeeds.',
          style: AppTypography.caption.copyWith(height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Cancel',
              style: AppTypography.button.copyWith(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              'Continue to payment',
              style: AppTypography.button.copyWith(
                color: AppColors.accentPink,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _upgrading = true);
    try {
      final ds = sl<MembershipsRemoteDataSource>();
      final eligibility = await ds.checkEligibility(
        email: widget.user.email,
        membershipId: membership.id,
      );
      if (!eligibility.allowed) {
        AppToast.error(eligibility.reason ?? 'This purchase is not allowed');
        return;
      }

      final names = _splitDisplayName(widget.user.name);
      final session = await ds.createCheckoutSession(
        membershipId: membership.id,
        email: widget.user.email,
        firstName: names.firstName,
        lastName: names.lastName,
        successUrl: ApiConstants.checkoutSuccessUrl,
        cancelUrl: ApiConstants.checkoutCancelUrl,
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
      AppToast.error(error.message);
    } catch (_) {
      AppToast.error('Unable to start checkout');
    } finally {
      if (mounted) setState(() => _upgrading = false);
    }
  }
  void _showUpgradeSheet() {
    final upgrades = _upgrades;
    final current = _current;

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
                        current == null ? 'Choose membership' : 'Upgrade membership',
                        style: AppTypography.headline.copyWith(fontSize: 26),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        current == null
                            ? 'Pay securely with Stripe to unlock your pass and event access.'
                            : 'Upgrade to a higher tier with Stripe. Your current pass stays until payment succeeds.',
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
                      if (current != null) ...[
                        Text(
                          'CURRENT',
                          style: AppTypography.microLabel.copyWith(
                            letterSpacing: 1.4,
                            color: AppColors.textTertiary,
                          ),
                        ),
                        const SizedBox(height: 10),
                        _MembershipTierheetCard(
                          membership: current,
                          isCurrent: true,
                        ),
                        const SizedBox(height: 22),
                      ],
                      Text(
                        upgrades.isEmpty ? 'AVAILABLE' : 'UPGRADE OPTIONS',
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.4,
                          color: AppColors.textTertiary,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (upgrades.isEmpty)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 22,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.bgCard,
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusCard),
                            border: Border.all(color: AppColors.borderSubtle),
                          ),
                          child: Text(
                            'You’re already on the highest available membership for this event.',
                            textAlign: TextAlign.center,
                            style: AppTypography.body.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.45,
                            ),
                          ),
                        )
                      else
                        for (var i = 0; i < upgrades.length; i++) ...[
                          if (i > 0) const SizedBox(height: 12),
                          _MembershipTierheetCard(
                            membership: upgrades[i],
                            featured: i == upgrades.length - 1,
                            onSelect: _upgrading
                                ? null
                                : () {
                                    Navigator.pop(context);
                                    _upgrade(upgrades[i]);
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
    final canOpenSheet = !_loading && _error == null && _memberships.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Membership',
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
                                  current == null ? 'NO PASS' : 'CURRENT PASS',
                                  style: AppTypography.microLabel.copyWith(
                                    color: AppColors.accentPink,
                                    letterSpacing: 1.3,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
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
                            current?.name ?? 'Choose a membership',
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
                                    ? 'Purchase with Stripe'
                                    : 'Upgrade with Stripe',
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
    this.onSelect,
  });

  final MembershipEntity membership;
  final bool isCurrent;
  final bool featured;
  final VoidCallback? onSelect;

  @override
  Widget build(BuildContext context) {
    final borderColor = isCurrent
        ? AppColors.accentPink.withValues(alpha: 0.45)
        : featured
            ? AppColors.accentPink.withValues(alpha: 0.28)
            : AppColors.borderSubtle;

    return Container(
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
                    if (isCurrent || featured) ...[
                      Text(
                        isCurrent ? 'YOUR TIER' : 'TOP TIER',
                        style: AppTypography.microLabel.copyWith(
                          color: AppColors.accentPink,
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
                  ],
                ),
              ),
              Text(
                membership.priceLabel,
                style: AppTypography.headline.copyWith(
                  fontSize: 22,
                  color: AppColors.accentPink,
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
                        const Text('•  ', style: TextStyle(color: AppColors.accentPink)),
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
          if (!isCurrent) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: onSelect,
                style: ElevatedButton.styleFrom(
                  backgroundColor: featured
                      ? AppColors.accentPink
                      : AppColors.accentPink.withValues(alpha: 0.85),
                ),
                child: Text(
                  'Pay ${membership.priceLabel}',
                  style: AppTypography.button.copyWith(fontSize: 14),
                ),
              ),
            ),
          ],
        ],
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
          'Notification permission is off. Enable it in system settings.',
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
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 18, color: AppColors.accentPink),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const Icon(
                Icons.chevron_right,
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
