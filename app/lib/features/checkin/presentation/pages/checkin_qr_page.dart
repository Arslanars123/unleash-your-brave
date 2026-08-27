import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
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
import 'package:unleash_your_brave/features/checkin/domain/entities/checkin_form_entity.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/checkin_qr_entity.dart';
import 'package:unleash_your_brave/features/checkin/presentation/widgets/checkin_waiver_form.dart';
import 'package:unleash_your_brave/features/home/data/datasources/events_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';
import 'package:unleash_your_brave/features/home/presentation/cubit/selected_event_cubit.dart';
import 'package:unleash_your_brave/features/memberships/data/datasources/memberships_remote_datasource.dart';
import 'package:unleash_your_brave/features/memberships/domain/entities/membership_entity.dart';

({String firstName, String lastName}) _splitDisplayName(String name) {
  final parts =
      name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return (firstName: 'Attendee', lastName: 'Member');
  if (parts.length == 1) return (firstName: parts.first, lastName: parts.first);
  return (firstName: parts.first, lastName: parts.sublist(1).join(' '));
}

bool _isPurchaseRequiredError(ServerException error) {
  if (error.statusCode != 403) return false;
  final message = error.message.toLowerCase();
  if (message.contains('renewal')) return false;
  return message.contains('membership') ||
      message.contains('purchase') ||
      message.contains('check-in qr');
}

class CheckInQrPage extends StatefulWidget {
  const CheckInQrPage({super.key, this.eventId});

  final String? eventId;

  @override
  State<CheckInQrPage> createState() => _CheckInQrPageState();
}

class _CheckInQrPageState extends State<CheckInQrPage> {
  bool _loading = true;
  bool _purchasing = false;
  bool _submittingWaiver = false;
  String? _error;
  bool _needsPurchase = false;
  CheckInQrEntity? _qr;
  CheckInFormEntity? _pendingForm;
  Timer? _pendingPoll;
  /// Only accept door scans that happen after this screen is ready.
  DateTime? _listenFrom;

  String? get _resolvedEventId {
    final fromWidget = widget.eventId?.trim();
    if (fromWidget != null && fromWidget.isNotEmpty) return fromWidget;
    return context.read<SelectedEventCubit>().selectedEventId;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void didUpdateWidget(covariant CheckInQrPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.eventId != widget.eventId) {
      _load();
    }
  }

  @override
  void dispose() {
    _pendingPoll?.cancel();
    super.dispose();
  }

  void _startPendingPoll() {
    _pendingPoll?.cancel();
    _pendingPoll = Timer.periodic(const Duration(seconds: 2), (_) {
      unawaited(_pollPendingForm());
    });
  }

  void _stopPendingPoll() {
    _pendingPoll?.cancel();
    _pendingPoll = null;
  }

  Future<void> _pollPendingForm() async {
    final qr = _qr;
    final listenFrom = _listenFrom;
    if (!mounted || qr == null || qr.checkedIn || _submittingWaiver) return;
    if (_pendingForm != null || listenFrom == null) return;
    try {
      final pending = await sl<CheckInRemoteDataSource>().getMyPendingForm(
        eventId: qr.eventId.isNotEmpty ? qr.eventId : _resolvedEventId,
      );
      if (!mounted || pending == null) return;
      // Ignore leftover sessions from earlier unfinished scans.
      if (!pending.scannedAt.isAfter(listenFrom.subtract(const Duration(seconds: 2)))) {
        return;
      }
      setState(() => _pendingForm = pending.form);
      _stopPendingPoll();
    } catch (_) {
      // Soft-fail; keep showing QR and try again on the next tick.
    }
  }

  Future<void> _load() async {
    _stopPendingPoll();
    setState(() {
      _loading = true;
      _error = null;
      _needsPurchase = false;
      _pendingForm = null;
      _listenFrom = null;
    });
    try {
      final eventHint = _resolvedEventId;
      // Unfinished prior scans must not open the form on entry — QR first.
      try {
        await sl<CheckInRemoteDataSource>().cancelMyPendingForm(
          eventId: eventHint,
        );
      } catch (_) {
        // Best-effort; still load QR.
      }

      final qr =
          await sl<CheckInRemoteDataSource>().getMyQr(eventId: eventHint);
      if (!mounted) return;
      setState(() {
        _qr = qr;
        _loading = false;
        // Accept only scans that happen after QR is on screen.
        _listenFrom = DateTime.now();
      });
      if (!qr.checkedIn) {
        _startPendingPoll();
      }
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
        _needsPurchase = false;
      });
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
        _needsPurchase = _isPurchaseRequiredError(error);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load your check-in QR';
        _needsPurchase = false;
      });
    }
  }

  Future<void> _submitWaiver({
    required Map<String, dynamic> answers,
    required String signedName,
    required String signatureDataUrl,
  }) async {
    final form = _pendingForm;
    final eventId = form?.eventId.isNotEmpty == true
        ? form!.eventId
        : (_qr?.eventId.isNotEmpty == true ? _qr!.eventId : _resolvedEventId);
    if (eventId == null || eventId.isEmpty) {
      AppToast.error('Missing event for waiver');
      return;
    }

    setState(() => _submittingWaiver = true);
    try {
      final qr = await sl<CheckInRemoteDataSource>().completeMyForm(
        eventId: eventId,
        answers: answers,
        signedName: signedName,
        signatureDataUrl: signatureDataUrl,
      );
      if (!mounted) return;
      setState(() {
        _qr = qr;
        _pendingForm = null;
        _submittingWaiver = false;
      });
      AppToast.success('Checked in — waiver submitted.');
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() => _submittingWaiver = false);
      AppToast.error(error.message);
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() => _submittingWaiver = false);
      AppToast.error(error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _submittingWaiver = false);
      AppToast.error('Unable to submit waiver');
    }
  }

  Future<void> _purchaseMembership() async {
    final eventId = _resolvedEventId;
    if (eventId == null || eventId.isEmpty) {
      if (!mounted) return;
      context.push('/events?focus=discover');
      return;
    }

    final authState = context.read<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;
    if (user == null) {
      AppToast.error('Sign in to purchase a pass');
      return;
    }

    setState(() => _purchasing = true);
    try {
      EventEntity event;
      try {
        event = await sl<EventsRemoteDataSource>().getById(eventId);
      } catch (_) {
        final selected = context.read<SelectedEventCubit>().state.event;
        if (selected == null || selected.id != eventId) {
          AppToast.error('Unable to load this event for purchase');
          return;
        }
        event = selected;
      }

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
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Book ${event.name}',
                        style: AppTypography.headline.copyWith(fontSize: 24),
                      ),
                    ),
                  ),
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                      itemCount: memberships.length,
                      separatorBuilder: (_, __) =>
                          const Divider(color: AppColors.borderSubtle),
                      itemBuilder: (context, index) {
                        final plan = memberships[index];
                        return ListTile(
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
      AppToast.error('Unable to start checkout');
    } finally {
      if (mounted) setState(() => _purchasing = false);
    }
  }

  Future<void> _checkout({
    required UserEntity user,
    required MembershipEntity membership,
    required String eventId,
  }) async {
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
      'Complete payment in your browser, then return here to refresh your QR.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final qr = _qr;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: buildSubpageAppBar(
        context,
        title: 'Check-in QR',
        fallbackLocation: '/profile',
      ),
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: _load,
        child: AdaptiveScrollBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _pendingForm != null
                    ? 'Staff scanned your QR. Complete and submit the waiver below to finish check-in.'
                    : 'Show this QR at the door. Keep this screen open — after staff scan it, the waiver appears here. You are checked in only after you submit.',
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              SizedBox(height: context.sectionGap),
              if (_purchasing || _submittingWaiver)
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: LinearProgressIndicator(
                    color: AppColors.accentPink,
                    backgroundColor: AppColors.bgMaroon,
                    minHeight: 2,
                  ),
                ),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_needsPurchase)
                _PurchaseRequiredView(
                  message: _error ??
                      'You do not have a membership for this event. Please purchase a membership to receive your check-in QR code.',
                  busy: _purchasing,
                  onPurchase: _purchaseMembership,
                )
              else if (_error != null)
                LoadErrorView(message: _error, onRetry: _load)
              else if (_pendingForm != null)
                Builder(
                  builder: (context) {
                    final authState = context.read<AuthBloc>().state;
                    final name = authState is AuthAuthenticated
                        ? authState.user.name
                        : '';
                    return CheckInWaiverForm(
                      form: _pendingForm!,
                      initialSignedName: name,
                      submitting: _submittingWaiver,
                      onSubmit: _submitWaiver,
                    );
                  },
                )
              else if (qr == null || qr.token.isEmpty)
                Text(
                  'No event QR available yet.',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                )
              else
                _QrCard(qr: qr),
            ],
          ),
        ),
      ),
    );
  }
}

class _PurchaseRequiredView extends StatelessWidget {
  const _PurchaseRequiredView({
    required this.message,
    required this.onPurchase,
    required this.busy,
  });

  final String message;
  final VoidCallback onPurchase;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: context.maxContentWidth),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 32),
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.bgMaroon,
                  borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: const Icon(
                  Icons.qr_code_2_outlined,
                  size: 32,
                  color: AppColors.accentPink,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Membership required',
                textAlign: TextAlign.center,
                style: AppTypography.headline.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                height: context.responsive(
                  compact: 52.0,
                  medium: 54.0,
                  expanded: 56.0,
                ),
                child: ElevatedButton(
                  onPressed: busy ? null : onPurchase,
                  child: busy
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.textPrimary,
                          ),
                        )
                      : const Text('Purchase Membership'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QrCard extends StatelessWidget {
  const _QrCard({required this.qr});

  final CheckInQrEntity qr;

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
      child: Column(
        children: [
          Text(
            qr.eventName,
            style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            qr.eventStatus.toUpperCase(),
            style: AppTypography.caption.copyWith(
              color: AppColors.accentPink,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: QrImageView(
              data: qr.token,
              version: QrVersions.auto,
              size: 220,
              backgroundColor: Colors.white,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: Color(0xFF120F0F),
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Color(0xFF120F0F),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'CHECK-IN CODE',
              style: AppTypography.microLabel.copyWith(
                color: AppColors.textTertiary,
                letterSpacing: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Material(
            color: AppColors.bgBase,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () async {
                await Clipboard.setData(ClipboardData(text: qr.token));
                AppToast.success('Check-in code copied');
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: SelectableText(
                        qr.token,
                        style: AppTypography.caption.copyWith(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          height: 1.4,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: 'Copy code',
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: qr.token));
                        AppToast.success('Check-in code copied');
                      },
                      icon: const Icon(
                        Icons.copy_rounded,
                        size: 18,
                        color: AppColors.accentPink,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Staff can paste this into “Or paste QR token” on the admin Check-in page.',
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          if (qr.checkedIn)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.accentPink.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                qr.checkedInAt != null
                    ? 'Checked in · ${_format(qr.checkedInAt!)}'
                    : 'Checked in',
                style: AppTypography.body.copyWith(
                  color: AppColors.accentPink,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
            )
          else
            Text(
              'Not checked in yet',
              style: AppTypography.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
        ],
      ),
    );
  }

  String _format(DateTime when) {
    final local = when.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day}/${local.month}/${local.year}, $hour:$minute $period';
  }
}
