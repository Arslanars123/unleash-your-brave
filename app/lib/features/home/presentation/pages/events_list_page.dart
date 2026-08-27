import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/core/widgets/subpage_app_bar.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/checkin/data/datasources/checkin_remote_datasource.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/event_booking_entity.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';
import 'package:unleash_your_brave/features/home/presentation/cubit/selected_event_cubit.dart';
import 'package:unleash_your_brave/features/memberships/data/datasources/memberships_remote_datasource.dart';
import 'package:unleash_your_brave/features/memberships/domain/entities/membership_entity.dart';
import 'package:url_launcher/url_launcher.dart';

({String firstName, String lastName}) _splitDisplayName(String name) {
  final parts =
      name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return (firstName: 'Attendee', lastName: 'Member');
  if (parts.length == 1) return (firstName: parts.first, lastName: parts.first);
  return (firstName: parts.first, lastName: parts.sublist(1).join(' '));
}

class EventsListPage extends StatefulWidget {
  const EventsListPage({super.key, this.initialFocus});

  /// `discover` = upcoming events not yet purchased.
  /// `previous` = all ended editions (purchased or not).
  /// Anything else (including null) = My events bookings only.
  final String? initialFocus;

  @override
  State<EventsListPage> createState() => _EventsListPageState();
}

class _EventsListPageState extends State<EventsListPage> {
  bool _loading = true;
  String? _error;
  List<EventBookingEntity> _bookings = const [];
  List<EventEntity> _available = const [];
  List<EventEntity> _previous = const [];
  bool _purchasing = false;

  bool get _isDiscover => widget.initialFocus == 'discover';
  bool get _isPrevious => widget.initialFocus == 'previous';

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        sl<CheckInRemoteDataSource>().getMyBookings(),
        sl<EventsRemoteDataSource>().listAvailable(),
        sl<EventsRemoteDataSource>().listPrevious(),
      ]);
      if (!mounted) return;
      final bookings = results[0] as List<EventBookingEntity>;
      final available = results[1] as List<EventEntity>;
      final previous = results[2] as List<EventEntity>;
      // Purchased for this edition (not content carried from another edition).
      final purchasedIds = bookings
          .where((b) => !b.carriedFromPrevious)
          .map((b) => b.event.id)
          .toSet();
      setState(() {
        _bookings = bookings
            .where((b) => !b.carriedFromPrevious)
            .toList(growable: false);
        _available = available
            .where((e) => !purchasedIds.contains(e.id))
            .toList(growable: false);
        _previous = previous;
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
        _error = 'Unable to load events';
      });
    }
  }

  Future<void> _selectEvent(EventEntity event) async {
    await context.read<SelectedEventCubit>().selectEventEntity(event);
  }

  Future<void> _openPurchase(EventEntity event) async {
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    if (user == null) {
      AppToast.error('Sign in to purchase a pass');
      return;
    }

    setState(() => _purchasing = true);
    try {
      List<MembershipEntity> memberships;
      try {
        memberships =
            await sl<MembershipsRemoteDataSource>().catalog(eventId: event.id);
      } catch (_) {
        memberships =
            await sl<MembershipsRemoteDataSource>().list(eventId: event.id);
      }
      if (!mounted) return;
      if (memberships.isEmpty) {
        AppToast.error('No memberships available for this event yet');
        return;
      }

      memberships = [...memberships]
        ..sort((a, b) {
          final bySort = a.sortOrder.compareTo(b.sortOrder);
          if (bySort != 0) return bySort;
          return a.price.compareTo(b.price);
        });

      final selected = await showModalBottomSheet<MembershipEntity>(
        context: context,
        isScrollControlled: true,
        backgroundColor: AppColors.bgBase,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (context) {
          final maxHeight = MediaQuery.sizeOf(context).height * 0.78;
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
                          'Book ${event.name}',
                          style: AppTypography.headline.copyWith(fontSize: 24),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Choose a membership and complete payment in Stripe.',
                          style: AppTypography.caption.copyWith(height: 1.4),
                        ),
                      ],
                    ),
                  ),
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      itemCount: memberships.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final plan = memberships[index];
                        return _PurchasePlanTile(
                          membership: plan,
                          onSelect: () => Navigator.pop(context, plan),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );

      if (selected == null || !mounted) return;
      await _checkout(user: user, membership: selected, eventId: event.id);
    } on NetworkException catch (error) {
      AppToast.error(error.message);
    } on ServerException catch (error) {
      AppToast.error(error.message);
    } catch (_) {
      AppToast.error('Unable to load memberships');
    } finally {
      if (mounted) setState(() => _purchasing = false);
    }
  }

  Future<void> _checkout({
    required UserEntity user,
    required MembershipEntity membership,
    required String eventId,
  }) async {
    try {
      final names = _splitDisplayName(user.name);
      final session =
          await sl<MembershipsRemoteDataSource>().createCheckoutSession(
        membershipId: membership.id,
        email: user.email,
        firstName: names.firstName,
        lastName: names.lastName,
        eventId: eventId,
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
      AppToast.success(
        'Complete payment in your browser, then return to refresh My events.',
      );
    } on NetworkException catch (error) {
      AppToast.error(error.message);
    } on ServerException catch (error) {
      AppToast.error(error.message);
    } catch (_) {
      AppToast.error('Unable to start checkout');
    }
  }

  List<EventBookingEntity> get _currentBookings => _bookings
      .where((b) => b.event.isLive || b.event.isUpcoming || b.event.isPaused)
      .toList(growable: false);

  EventBookingEntity? _purchaseFor(String eventId) {
    for (final booking in _bookings) {
      if (booking.event.id == eventId) return booking;
    }
    return null;
  }

  String get _pageTitle {
    if (_isDiscover) return 'Upcoming events';
    if (_isPrevious) return 'Previous events';
    return 'My events';
  }

  String get _pageHint {
    if (_isDiscover) {
      return 'Events you can still book. Purchase a membership to unlock agenda, materials, and check-in for that edition.';
    }
    if (_isPrevious) {
      return 'All past editions — whether you purchased a membership or not. Open one to view agenda when access allows.';
    }
    return 'Your purchased upcoming and live editions. Open any booking to view its agenda — access follows Event permissions set by admin.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: buildSubpageAppBar(
        context,
        title: _pageTitle,
        fallbackLocation: '/',
      ),
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: _load,
        child: AdaptiveScrollBody(
          child: _loading
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 64),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.accentPink),
                  ),
                )
              : _error != null
                  ? LoadErrorView(message: _error, onRetry: _load)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _pageHint,
                          style: AppTypography.caption.copyWith(height: 1.45),
                        ),
                        SizedBox(height: context.sectionGap),
                        if (_purchasing)
                          const Padding(
                            padding: EdgeInsets.only(bottom: 12),
                            child: LinearProgressIndicator(
                              color: AppColors.accentPink,
                              backgroundColor: AppColors.bgMaroon,
                              minHeight: 2,
                            ),
                          ),
                        if (_isDiscover) ...[
                          _SectionLabel('Open for booking'),
                          const SizedBox(height: 10),
                          if (_available.isEmpty)
                            const _EmptyHint(
                              'No upcoming events are open for booking right now.',
                            )
                          else
                            for (final event in _available) ...[
                              _AvailableEventCard(
                                event: event,
                                onOpen: () => context.push(
                                  '/events/${event.id}',
                                  extra: event,
                                ),
                                onBook: () => _openPurchase(event),
                                onViewMap: () {
                                  context.go('/map?eventId=${event.id}');
                                },
                              ),
                              const SizedBox(height: 12),
                            ],
                        ] else if (_isPrevious) ...[
                          _SectionLabel('Past editions'),
                          const SizedBox(height: 10),
                          if (_previous.isEmpty)
                            const _EmptyHint(
                              'No previous events to show yet.',
                            )
                          else
                            for (final event in _previous) ...[
                              _PreviousEventCard(
                                event: event,
                                purchase: _purchaseFor(event.id),
                                onOpen: () async {
                                  await _selectEvent(event);
                                  if (!context.mounted) return;
                                  final purchase = _purchaseFor(event.id);
                                  context.push(
                                    '/events/${event.id}',
                                    extra: purchase ?? event,
                                  );
                                },
                                onViewAgenda: () {
                                  context.go('/agenda?eventId=${event.id}');
                                },
                                onViewMap: () {
                                  context.go('/map?eventId=${event.id}');
                                },
                              ),
                              const SizedBox(height: 12),
                            ],
                        ] else ...[
                          _SectionLabel('Your bookings'),
                          const SizedBox(height: 10),
                          if (_currentBookings.isEmpty)
                            const _EmptyHint(
                              'You don’t have any purchased upcoming events yet. Open Upcoming events from the menu to book a pass.',
                            )
                          else
                            for (final booking in _currentBookings) ...[
                              _BookingCard(
                                booking: booking,
                                onOpen: () async {
                                  await _selectEvent(booking.event);
                                  if (!context.mounted) return;
                                  context.push(
                                    '/events/${booking.event.id}',
                                    extra: booking,
                                  );
                                },
                                onViewAgenda: () {
                                  context.go(
                                    '/agenda?eventId=${booking.event.id}',
                                  );
                                },
                                onViewMap: () {
                                  context.go(
                                    '/map?eventId=${booking.event.id}',
                                  );
                                },
                                onQr: booking.qrEntitled
                                    ? () async {
                                        await _selectEvent(booking.event);
                                        if (!context.mounted) return;
                                        context.push(
                                          '/check-in?eventId=${booking.event.id}',
                                        );
                                      }
                                    : null,
                              ),
                              const SizedBox(height: 12),
                            ],
                        ],
                      ],
                    ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: AppTypography.microLabel.copyWith(
        letterSpacing: 1.4,
        color: AppColors.textTertiary,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: context.cardPadding,
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Text(
        message,
        style: AppTypography.caption.copyWith(height: 1.45),
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  const _BookingCard({
    required this.booking,
    required this.onOpen,
    required this.onViewAgenda,
    required this.onViewMap,
    this.onQr,
  });

  final EventBookingEntity booking;
  final VoidCallback onOpen;
  final VoidCallback onViewAgenda;
  final VoidCallback onViewMap;
  final VoidCallback? onQr;

  @override
  Widget build(BuildContext context) {
    final event = booking.event;
    return Material(
      color: AppColors.bgCard,
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      event.name,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  _StatusChip(status: event.status),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                event.dateRangeLabel,
                style: AppTypography.caption.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              if (booking.effectiveMembershipName?.isNotEmpty == true) ...[
                const SizedBox(height: 6),
                Text(
                  booking.carriedFromPrevious
                      ? 'Carried · ${booking.effectiveMembershipName}'
                      : booking.effectiveMembershipName!,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.accentPink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ] else if (booking.carriedFromPrevious) ...[
                const SizedBox(height: 6),
                Text(
                  'Preview access · purchase to unlock QR',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.accentPink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              if (booking.checkedIn) ...[
                const SizedBox(height: 6),
                Text(
                  'Checked in',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onViewAgenda,
                      icon: const Icon(Icons.calendar_today_outlined, size: 16),
                      label: const Text('Agenda'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.borderSubtle),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onViewMap,
                      icon: const Icon(Icons.map_outlined, size: 16),
                      label: const Text('Map'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.borderSubtle),
                      ),
                    ),
                  ),
                  if (onQr != null) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: onQr,
                        icon: const Icon(Icons.qr_code_2, size: 18),
                        label: const Text('QR'),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PreviousEventCard extends StatelessWidget {
  const _PreviousEventCard({
    required this.event,
    required this.onOpen,
    required this.onViewAgenda,
    required this.onViewMap,
    this.purchase,
  });

  final EventEntity event;
  final EventBookingEntity? purchase;
  final VoidCallback onOpen;
  final VoidCallback onViewAgenda;
  final VoidCallback onViewMap;

  @override
  Widget build(BuildContext context) {
    final purchased = purchase != null;
    final membershipLabel = purchase?.effectiveMembershipName;
    return Material(
      color: AppColors.bgCard,
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      event.name,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  _StatusChip(status: event.status),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                event.dateRangeLabel,
                style: AppTypography.caption.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              if (event.venueLabel.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  event.venueLabel,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
              const SizedBox(height: 6),
              Text(
                purchased
                    ? (membershipLabel?.isNotEmpty == true
                        ? 'Purchased · $membershipLabel'
                        : 'Purchased')
                    : 'Not purchased',
                style: AppTypography.caption.copyWith(
                  color: purchased
                      ? AppColors.accentPink
                      : AppColors.textTertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onViewAgenda,
                      icon: const Icon(Icons.calendar_today_outlined, size: 16),
                      label: const Text('Agenda'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.borderSubtle),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onViewMap,
                      icon: const Icon(Icons.map_outlined, size: 16),
                      label: const Text('Map'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.borderSubtle),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AvailableEventCard extends StatelessWidget {
  const _AvailableEventCard({
    required this.event,
    required this.onOpen,
    required this.onBook,
    required this.onViewMap,
  });

  final EventEntity event;
  final VoidCallback onOpen;
  final VoidCallback onBook;
  final VoidCallback onViewMap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bgCard,
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      event.name,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  _StatusChip(status: event.status),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                event.dateRangeLabel,
                style: AppTypography.caption.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              if (event.venueLabel.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  event.venueLabel,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
              if (event.tagline.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  event.tagline,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(height: 1.4),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onViewMap,
                      icon: const Icon(Icons.map_outlined, size: 16),
                      label: const Text('Map'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.borderSubtle),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: onBook,
                      child: const Text('Book / Purchase'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PurchasePlanTile extends StatelessWidget {
  const _PurchasePlanTile({
    required this.membership,
    required this.onSelect,
  });

  final MembershipEntity membership;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  membership.name,
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
              Text(
                membership.priceLabel,
                style: AppTypography.body.copyWith(
                  color: AppColors.accentPink,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          if (membership.description.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              membership.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(height: 1.4),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onSelect,
              child: Text('Purchase ${membership.priceLabel}'),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.accentPink.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.toUpperCase(),
        style: AppTypography.microLabel.copyWith(
          color: AppColors.accentPink,
          letterSpacing: 1.1,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
