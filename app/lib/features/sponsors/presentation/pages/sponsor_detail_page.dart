import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/features/home/presentation/cubit/selected_event_cubit.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/widgets/app_circle_avatar.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/sponsors/data/datasources/sponsors_remote_datasource.dart';
import 'package:unleash_your_brave/features/sponsors/domain/entities/sponsor_entity.dart';

class SponsorDetailPage extends StatefulWidget {
  const SponsorDetailPage({
    super.key,
    required this.sponsorId,
    this.initialSponsor,
  });

  final String sponsorId;
  final SponsorEntity? initialSponsor;

  @override
  State<SponsorDetailPage> createState() => _SponsorDetailPageState();
}

class _SponsorDetailPageState extends State<SponsorDetailPage> {
  SponsorEntity? _sponsor;
  bool _loading = true;
  bool _refreshing = false;
  String? _errorMessage;
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    _sponsor = widget.initialSponsor;
    unawaited(_load(isRefresh: _sponsor != null));
  }

  Future<void> _load({required bool isRefresh}) async {
    setState(() {
      if (isRefresh && _sponsor != null) {
        _refreshing = true;
      } else {
        _loading = true;
        _errorMessage = null;
      }
    });

    try {
      final eventId = context.read<SelectedEventCubit>().state.eventId;
      if (eventId == null || eventId.isEmpty) {
        throw const ServerException('Select an event to view sponsor offers');
      }
      final sponsor = await sl<SponsorsRemoteDataSource>().getById(
        widget.sponsorId,
        eventId: eventId,
      );
      if (!mounted) return;
      setState(() {
        _sponsor = sponsor;
        _loading = false;
        _refreshing = false;
        _errorMessage = null;
        _isOffline = false;
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      _handleFailure(isOffline: true, message: error.message);
    } on ServerException catch (error) {
      if (!mounted) return;
      _handleFailure(isOffline: false, message: error.message);
    } catch (_) {
      if (!mounted) return;
      _handleFailure(isOffline: false, message: 'Unexpected error');
    }
  }

  void _handleFailure({required bool isOffline, required String message}) {
    if (_sponsor != null) {
      setState(() {
        _loading = false;
        _refreshing = false;
        _isOffline = isOffline;
      });
      AppToast.info(
        isOffline
            ? 'You’re offline. Showing saved sponsor details.'
            : 'Couldn’t refresh. Showing saved sponsor details.',
      );
      return;
    }
    setState(() {
      _loading = false;
      _refreshing = false;
      _isOffline = isOffline;
      _errorMessage = message;
    });
  }

  Future<void> _openLink(String url) async {
    final resolved = resolveMediaUrl(url);
    if (resolved.isEmpty) {
      AppToast.error('This link is not available.');
      return;
    }
    final uri = Uri.tryParse(resolved);
    if (uri == null) {
      AppToast.error('Couldn’t open this link.');
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) AppToast.error('Couldn’t open this link.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
              context.go('/sponsors');
            }
          },
        ),
        title: Text(
          'Sponsor',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 17,
          ),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: () => _load(isRefresh: true),
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    final sponsor = _sponsor;
    if (_loading && sponsor == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 160),
          Center(child: CircularProgressIndicator(color: AppColors.accentPink)),
        ],
      );
    }

    if (sponsor == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.7,
            child: LoadErrorView(
              kind: _isOffline ? LoadErrorKind.offline : LoadErrorKind.generic,
              message: _errorMessage,
              onRetry: () => _load(isRefresh: false),
            ),
          ),
        ],
      );
    }

    final sidePad = context.pagePadding.left;
    final description = sponsor.description.trim();
    final offers = [...sponsor.offers]
      ..sort((a, b) => a.offerNumber.compareTo(b.offerNumber));

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(sidePad, 8, sidePad, 28),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: context.maxContentWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_refreshing)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: LinearProgressIndicator(
                          color: AppColors.accentPink,
                          backgroundColor: AppColors.bgMaroon,
                          minHeight: 2,
                        ),
                      ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppCircleAvatar(
                          radius: 36,
                          photoUrl: sponsor.image,
                          fallback: Icon(
                            Icons.storefront_outlined,
                            color: AppColors.accentPink,
                            size: 32,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                sponsor.name,
                                style: AppTypography.headline.copyWith(fontSize: 26),
                              ),
                              if (offers.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  '${offers.length} ${offers.length == 1 ? 'offer' : 'offers'}',
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.accentPink,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'ABOUT',
                      style: AppTypography.microLabel.copyWith(letterSpacing: 1.4),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      description.isEmpty
                          ? 'No description available for this sponsor.'
                          : description,
                      style: AppTypography.body.copyWith(
                        fontSize: 15,
                        height: 1.55,
                        color: description.isEmpty
                            ? AppColors.textSecondary
                            : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      'OFFERS',
                      style: AppTypography.microLabel.copyWith(letterSpacing: 1.4),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      offers.isEmpty
                          ? 'No offers from this sponsor yet.'
                          : '${offers.length} ${offers.length == 1 ? 'offer' : 'offers'} available',
                      style: AppTypography.caption,
                    ),
                    const SizedBox(height: 16),
                    if (offers.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: AppColors.bgCard,
                          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                          border: Border.all(color: AppColors.borderSubtle),
                        ),
                        child: Text(
                          'Check back later for partner offers and resources.',
                          style: AppTypography.caption,
                        ),
                      )
                    else
                      ...offers.map((offer) => _OfferCard(
                            offer: offer,
                            onOpenLink: _openLink,
                          )),
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

class _OfferCard extends StatelessWidget {
  const _OfferCard({
    required this.offer,
    required this.onOpenLink,
  });

  final SponsorOfferEntity offer;
  final Future<void> Function(String url) onOpenLink;

  @override
  Widget build(BuildContext context) {
    final description = offer.description.trim();
    final imageUrl = resolveMediaUrl(offer.image);
    final hasImage = isLoadableMediaUrl(offer.image);

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Offer ${offer.offerNumber > 0 ? offer.offerNumber : 1}',
              style: AppTypography.body.copyWith(
                fontWeight: FontWeight.w600,
                fontSize: 16,
              ),
            ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                description,
                style: AppTypography.body.copyWith(
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
            ],
            if (hasImage) ...[
              const SizedBox(height: 14),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                child: CachedNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.cover,
                  height: 180,
                  width: double.infinity,
                  errorWidget: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ],
            if (offer.links.isNotEmpty) ...[
              const SizedBox(height: 14),
              ...offer.links.map(
                (link) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: OutlinedButton.icon(
                    onPressed: link.url.trim().isEmpty
                        ? null
                        : () => onOpenLink(link.url),
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                    label: Text(link.displayLabel),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.accentPink,
                      side: const BorderSide(color: AppColors.borderSubtle),
                      alignment: Alignment.centerLeft,
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
