import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/core/widgets/subpage_app_bar.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
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

class EventDetailPage extends StatefulWidget {
  const EventDetailPage({
    super.key,
    required this.eventId,
    this.initialEvent,
    this.initialBooking,
  });

  final String eventId;
  final EventEntity? initialEvent;
  final EventBookingEntity? initialBooking;

  @override
  State<EventDetailPage> createState() => _EventDetailPageState();
}

class _EventDetailPageState extends State<EventDetailPage> {
  bool _loading = true;
  String? _error;
  EventEntity? _event;
  EventBookingEntity? _booking;
  EffectiveEventAccess? _access;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _event = widget.initialEvent ?? widget.initialBooking?.event;
    _booking = widget.initialBooking;
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = _event == null;
      _error = null;
    });
    try {
      final event = await sl<EventsRemoteDataSource>().getById(widget.eventId);
      EffectiveEventAccess? access;
      try {
        access = await sl<MembershipsRemoteDataSource>()
            .myAccess(eventId: widget.eventId);
      } catch (_) {
        access = null;
      }
      if (!mounted) return;
      setState(() {
        _event = event;
        _access = access;
        _loading = false;
        _error = null;
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
        _error = 'Unable to load event';
      });
    }
  }

  bool get _entitled =>
      _booking?.entitled == true || _access?.entitled == true;

  bool get _qrEntitled =>
      _booking?.qrEntitled == true || _access?.qrEntitled == true;

  Future<void> _setActive() async {
    final event = _event;
    if (event == null) return;
    setState(() => _busy = true);
    try {
      await context.read<SelectedEventCubit>().selectEventEntity(event);
      if (!mounted) return;
      AppToast.success('${event.name} is now your active event');
      context.go('/');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _purchase() async {
    final event = _event;
    if (event == null) return;
    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    if (user == null) {
      AppToast.error('Sign in to purchase a pass');
      return;
    }

    setState(() => _busy = true);
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
          return SafeArea(
            top: false,
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              children: [
                Text(
                  'Book ${event.name}',
                  style: AppTypography.headline.copyWith(fontSize: 24),
                ),
                const SizedBox(height: 12),
                for (final plan in memberships) ...[
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      plan.name,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: Text(plan.priceLabel),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.pop(context, plan),
                  ),
                  const Divider(color: AppColors.borderSubtle),
                ],
              ],
            ),
          );
        },
      );
      if (selected == null || !mounted) return;

      final names = _splitDisplayName(user.name);
      final session =
          await sl<MembershipsRemoteDataSource>().createCheckoutSession(
        membershipId: selected.id,
        email: user.email,
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
      AppToast.success('Complete payment in your browser, then return here.');
    } on NetworkException catch (error) {
      AppToast.error(error.message);
    } on ServerException catch (error) {
      AppToast.error(error.message);
    } catch (_) {
      AppToast.error('Unable to start checkout');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedId = context.watch<SelectedEventCubit>().state.eventId;
    final event = _event;
    final isActive = event != null && event.id == selectedId;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: buildSubpageAppBar(
        context,
        title: event?.name ?? 'Event',
        fallbackLocation: '/events',
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
              : _error != null && event == null
                  ? LoadErrorView(message: _error, onRetry: _load)
                  : event == null
                      ? const SizedBox.shrink()
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              event.status.toUpperCase(),
                              style: AppTypography.microLabel.copyWith(
                                color: AppColors.accentPink,
                                letterSpacing: 1.4,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              event.name,
                              style:
                                  AppTypography.headline.copyWith(fontSize: 28),
                            ),
                            if (event.tagline.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(
                                event.tagline,
                                style: AppTypography.body.copyWith(
                                  color: AppColors.textSecondary,
                                  height: 1.45,
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                            _InfoRow(
                              icon: Icons.calendar_today_outlined,
                              label: event.dateRangeLabel,
                            ),
                            if (event.venueLabel.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              _InfoRow(
                                icon: Icons.place_outlined,
                                label: event.venueLabel,
                              ),
                            ],
                            if (_access?.effectiveMembershipName != null ||
                                _booking?.effectiveMembershipName != null) ...[
                              const SizedBox(height: 10),
                              _InfoRow(
                                icon: Icons.badge_outlined,
                                label: _access?.effectiveMembershipName ??
                                    _booking!.effectiveMembershipName!,
                              ),
                            ],
                            SizedBox(height: context.sectionGap),
                            if (_busy)
                              const Padding(
                                padding: EdgeInsets.only(bottom: 12),
                                child: LinearProgressIndicator(
                                  color: AppColors.accentPink,
                                  backgroundColor: AppColors.bgMaroon,
                                  minHeight: 2,
                                ),
                              ),
                            if (_entitled) ...[
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton(
                                  onPressed: _busy || isActive ? null : _setActive,
                                  child: Text(
                                    isActive
                                        ? 'Active event'
                                        : 'Use as active event',
                                  ),
                                ),
                              ),
                              if (_qrEntitled) ...[
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: OutlinedButton.icon(
                                    onPressed: _busy
                                        ? null
                                        : () => context.push(
                                              '/check-in?eventId=${event.id}',
                                            ),
                                    icon: const Icon(Icons.qr_code_2),
                                    label: const Text('Check-in QR'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: AppColors.textPrimary,
                                      side: const BorderSide(
                                        color: AppColors.borderSubtle,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ] else ...[
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton(
                                  onPressed: _busy ? null : _purchase,
                                  child: const Text('Book / Purchase'),
                                ),
                              ),
                            ],
                          ],
                        ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppColors.textTertiary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: AppTypography.body.copyWith(
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
