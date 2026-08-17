import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/utils/datetime_format.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/widgets/app_circle_avatar.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/agenda/data/datasources/sessions_remote_datasource.dart';
import 'package:unleash_your_brave/features/agenda/domain/entities/session_entity.dart';
import 'package:unleash_your_brave/features/agenda/domain/entities/session_feedback_entity.dart';

class SessionDetailPage extends StatefulWidget {
  const SessionDetailPage({
    super.key,
    required this.sessionId,
    this.initialSession,
  });

  final String sessionId;
  final SessionEntity? initialSession;

  @override
  State<SessionDetailPage> createState() => _SessionDetailPageState();
}

class _SessionDetailPageState extends State<SessionDetailPage> {
  SessionEntity? _session;
  bool _loading = true;
  bool _refreshing = false;
  String? _errorMessage;
  bool _isOffline = false;

  SessionFeedbackEntity? _myFeedback;
  List<SessionFeedbackEntity> _reviews = const [];
  bool _feedbackLoading = false;
  bool _feedbackSaving = false;
  final _commentController = TextEditingController();
  final _reviewSectionKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _session = widget.initialSession;
    unawaited(_load(isRefresh: _session != null));
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _load({required bool isRefresh}) async {
    setState(() {
      if (isRefresh && _session != null) {
        _refreshing = true;
      } else {
        _loading = true;
        _errorMessage = null;
      }
    });

    try {
      final session =
          await sl<SessionsRemoteDataSource>().getById(widget.sessionId);
      if (!mounted) return;
      setState(() {
        _session = session;
        _loading = false;
        _refreshing = false;
        _errorMessage = null;
        _isOffline = false;
      });
      if (session.feedbackEnabled) {
        await _loadFeedback();
      } else if (mounted) {
        setState(() {
          _myFeedback = null;
          _reviews = const [];
          _commentController.clear();
        });
      }
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

  Future<void> _loadFeedback() async {
    setState(() => _feedbackLoading = true);
    try {
      final remote = sl<SessionsRemoteDataSource>();
      final results = await Future.wait([
        remote.getMyFeedback(widget.sessionId),
        remote.listFeedback(widget.sessionId),
      ]);
      if (!mounted) return;
      final mine = results[0] as SessionFeedbackEntity?;
      final reviews = results[1] as List<SessionFeedbackEntity>;
      setState(() {
        _myFeedback = mine;
        _reviews = reviews;
        _commentController.text = mine?.comment ?? '';
        _feedbackLoading = false;
      });
    } on NetworkException {
      if (!mounted) return;
      setState(() => _feedbackLoading = false);
    } on ServerException {
      if (!mounted) return;
      setState(() => _feedbackLoading = false);
    } catch (_) {
      if (!mounted) return;
      setState(() => _feedbackLoading = false);
    }
  }

  Future<void> _openReviewForm() async {
    var rating = _myFeedback?.rating ?? 0;
    _commentController.text = _myFeedback?.comment ?? '';
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
          ),
          child: StatefulBuilder(
            builder: (context, setModalState) {
              return _ReviewFormSheet(
                hasExisting: _myFeedback != null,
                selectedRating: rating,
                commentController: _commentController,
                saving: saving,
                onRatingChanged: (value) {
                  setModalState(() => rating = value);
                },
                onSubmit: () async {
                  if (saving) return;
                  if (rating < 1 || rating > 5) {
                    AppToast.error('Choose a rating from 1 to 5 stars.');
                    return;
                  }
                  setModalState(() => saving = true);
                  final ok = await _submitFeedback(rating: rating);
                  if (!sheetContext.mounted) return;
                  setModalState(() => saving = false);
                  if (ok) Navigator.pop(sheetContext);
                },
                onRemove: _myFeedback == null
                    ? null
                    : () async {
                        if (saving) return;
                        setModalState(() => saving = true);
                        final ok = await _removeFeedback();
                        if (!sheetContext.mounted) return;
                        setModalState(() => saving = false);
                        if (ok) Navigator.pop(sheetContext);
                      },
              );
            },
          ),
        );
      },
    );
  }

  Future<bool> _submitFeedback({required int rating}) async {
    if (_feedbackSaving) return false;
    if (rating < 1 || rating > 5) {
      AppToast.error('Choose a rating from 1 to 5 stars.');
      return false;
    }

    setState(() {
      _feedbackSaving = true;
    });
    try {
      final wasUpdate = _myFeedback != null;
      final saved = await sl<SessionsRemoteDataSource>().upsertFeedback(
        sessionId: widget.sessionId,
        rating: rating,
        comment: _commentController.text,
      );
      if (!mounted) return false;
      setState(() {
        _myFeedback = saved;
        _feedbackSaving = false;
      });
      AppToast.success(wasUpdate ? 'Review updated.' : 'Review submitted.');
      await _load(isRefresh: true);
      return true;
    } on NetworkException catch (error) {
      if (!mounted) return false;
      setState(() => _feedbackSaving = false);
      AppToast.error(error.message);
      return false;
    } on ServerException catch (error) {
      if (!mounted) return false;
      setState(() => _feedbackSaving = false);
      AppToast.error(error.message);
      return false;
    } catch (_) {
      if (!mounted) return false;
      setState(() => _feedbackSaving = false);
      AppToast.error('Couldn’t save your review.');
      return false;
    }
  }

  Future<bool> _removeFeedback() async {
    if (_feedbackSaving || _myFeedback == null) return false;

    setState(() => _feedbackSaving = true);
    try {
      await sl<SessionsRemoteDataSource>().deleteMyFeedback(widget.sessionId);
      if (!mounted) return false;
      setState(() {
        _myFeedback = null;
        _commentController.clear();
        _feedbackSaving = false;
      });
      AppToast.success('Review removed.');
      await _load(isRefresh: true);
      return true;
    } on NetworkException catch (error) {
      if (!mounted) return false;
      setState(() => _feedbackSaving = false);
      AppToast.error(error.message);
      return false;
    } on ServerException catch (error) {
      if (!mounted) return false;
      setState(() => _feedbackSaving = false);
      AppToast.error(error.message);
      return false;
    } catch (_) {
      if (!mounted) return false;
      setState(() => _feedbackSaving = false);
      AppToast.error('Couldn’t remove your review.');
      return false;
    }
  }

  void _handleFailure({required bool isOffline, required String message}) {
    if (_session != null) {
      setState(() {
        _loading = false;
        _refreshing = false;
        _isOffline = isOffline;
      });
      // Avoid a confusing toast when we already have usable cached details and
      // the failure is a transient server error during refresh.
      if (isOffline) {
        AppToast.info('You’re offline. Showing saved session details.');
      } else {
        AppToast.info(
          message.trim().isEmpty
              ? 'Couldn’t refresh. Showing saved session details.'
              : message,
        );
      }
      return;
    }

    setState(() {
      _loading = false;
      _refreshing = false;
      _isOffline = isOffline;
      _errorMessage = message;
    });
  }

  Future<void> _openMaterial(SessionMaterialEntity material) async {
    final resolved = resolveMediaUrl(material.url);
    if (resolved.isEmpty) {
      AppToast.error('This resource has no link.');
      return;
    }

    final uri = Uri.tryParse(resolved);
    if (uri == null) {
      AppToast.error('Couldn’t open this resource.');
      return;
    }

    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) {
      AppToast.error('Couldn’t open this resource.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;

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
              context.go('/agenda');
            }
          },
        ),
        title: Text(
          session?.isSideEvent == true ? 'Event' : 'Session',
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 17,
          ),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.accentPink,
        onRefresh: () => _load(isRefresh: true),
        child: _buildBody(session),
      ),
    );
  }

  Widget _buildBody(SessionEntity? session) {
    if (_loading && session == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 160),
          Center(
            child: CircularProgressIndicator(color: AppColors.accentPink),
          ),
        ],
      );
    }

    if (session == null) {
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
    final description = session.description.trim();
    final speaker = session.speaker;
    final materials = session.materials;
    final summary = session.feedbackSummary;
    final ratingsCount = summary?.ratingsCount ?? 0;
    final timeRange =
        formatSessionTimeRange(session.startTime, session.endTime);
    final location = session.location.trim();
    final address = session.address.trim();
    final isSideEvent = session.isSideEvent;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
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
                    if (_isOffline) ...[
                      const _OfflineBanner(),
                      const SizedBox(height: 16),
                    ],
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _MetaChip(label: 'Day ${session.eventDayNumber}'),
                        if (timeRange.isNotEmpty)
                          _MetaChip(
                            icon: Icons.schedule_rounded,
                            label: timeRange,
                          ),
                        if (location.isNotEmpty)
                          _MetaChip(
                            icon: Icons.place_outlined,
                            label: location,
                          ),
                        if (address.isNotEmpty)
                          _MetaChip(
                            icon: Icons.location_on_outlined,
                            label: address,
                          ),
                        if (!isSideEvent && ratingsCount > 0 && summary != null)
                          _MetaChip(
                            icon: Icons.star_rounded,
                            label:
                                '${summary.averageRating.toStringAsFixed(1)} · $ratingsCount ${ratingsCount == 1 ? 'review' : 'reviews'}',
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      session.name,
                      style: AppTypography.headline.copyWith(fontSize: 28),
                    ),
                    if (speaker != null && speaker.name.trim().isNotEmpty && !isSideEvent) ...[
                      const SizedBox(height: 20),
                      _SpeakerBlock(speaker: speaker),
                    ],
                    const SizedBox(height: 28),
                    Text(
                      'ABOUT',
                      style: AppTypography.microLabel.copyWith(
                        letterSpacing: 1.4,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      description.isEmpty
                          ? isSideEvent
                              ? 'No description available for this event.'
                              : 'No description available for this session.'
                          : description,
                      style: AppTypography.body.copyWith(
                        fontSize: 15,
                        height: 1.55,
                        color: description.isEmpty
                            ? AppColors.textSecondary
                            : AppColors.textPrimary,
                      ),
                    ),
                    if (!isSideEvent) ...[
                      const SizedBox(height: 32),
                      Text(
                        'RESOURCES',
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        materials.isEmpty
                            ? 'No materials for this session yet.'
                            : '${materials.length} ${materials.length == 1 ? 'item' : 'items'} available',
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: 14),
                      if (materials.isEmpty)
                        const _EmptyMaterials()
                      else
                        ...materials.map(
                          (material) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _MaterialTile(
                              material: material,
                              onOpen: () => _openMaterial(material),
                            ),
                          ),
                        ),
                      if (session.feedbackEnabled) ...[
                        const SizedBox(height: 32),
                        KeyedSubtree(
                          key: _reviewSectionKey,
                          child: _SessionReviewsSection(
                            loading: _feedbackLoading,
                            reviews: _reviews,
                            hasMyReview: _myFeedback != null,
                            onAddOrEdit: _openReviewForm,
                          ),
                        ),
                      ],
                    ],
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

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.bgMaroon,
        borderRadius: BorderRadius.circular(AppTheme.radiusChip),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: AppColors.accentPink),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: AppColors.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _SpeakerBlock extends StatelessWidget {
  const _SpeakerBlock({required this.speaker});

  final SessionSpeakerEntity speaker;

  @override
  Widget build(BuildContext context) {
    final title = speaker.title.trim();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        AppCircleAvatar(
          radius: 26,
          photoUrl: speaker.photo,
          backgroundColor: AppColors.bgMaroon,
          fallback: Text(
            speaker.name.trim().isNotEmpty
                ? speaker.name.trim()[0].toUpperCase()
                : '?',
            style: AppTypography.body.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.accentPink,
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                speaker.name,
                style: AppTypography.body.copyWith(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              if (title.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  title,
                  style: AppTypography.caption.copyWith(fontSize: 13),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _MaterialTile extends StatelessWidget {
  const _MaterialTile({
    required this.material,
    required this.onOpen,
  });

  final SessionMaterialEntity material;
  final VoidCallback onOpen;

  IconData get _icon => switch (material.type.toLowerCase()) {
        'pdf' => Icons.picture_as_pdf_outlined,
        'video' => Icons.play_circle_outline_rounded,
        'doc' => Icons.description_outlined,
        _ => Icons.link_rounded,
      };

  String get _typeLabel {
    final type = material.type.trim().toLowerCase();
    if (type.isEmpty) return 'LINK';
    return type.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgCard,
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.bgMaroon,
                  borderRadius: BorderRadius.circular(AppTheme.radiusChip),
                ),
                child: Icon(_icon, color: AppColors.accentPink, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      material.title.trim().isEmpty
                          ? 'Untitled resource'
                          : material.title,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _typeLabel,
                      style: AppTypography.microLabel.copyWith(
                        color: AppColors.textTertiary,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.open_in_new_rounded,
                size: 18,
                color: AppColors.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyMaterials extends StatelessWidget {
  const _EmptyMaterials();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.folder_open_outlined,
            size: 28,
            color: AppColors.textTertiary,
          ),
          const SizedBox(height: 12),
          Text(
            'Materials and links will appear here when they’re added.',
            textAlign: TextAlign.center,
            style: AppTypography.caption.copyWith(fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _SessionReviewsSection extends StatelessWidget {
  const _SessionReviewsSection({
    required this.loading,
    required this.reviews,
    required this.hasMyReview,
    required this.onAddOrEdit,
  });

  final bool loading;
  final List<SessionFeedbackEntity> reviews;
  final bool hasMyReview;
  final VoidCallback onAddOrEdit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'REVIEWS',
                style: AppTypography.microLabel.copyWith(letterSpacing: 1.4),
              ),
            ),
            TextButton.icon(
              onPressed: onAddOrEdit,
              icon: Icon(
                hasMyReview ? Icons.edit_outlined : Icons.rate_review_outlined,
                size: 18,
                color: AppColors.accentPink,
              ),
              label: Text(
                hasMyReview ? 'Edit review' : 'Add review',
                style: AppTypography.caption.copyWith(
                  color: AppColors.accentPink,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          hasMyReview
              ? 'See what attendees thought — or update yours.'
              : 'See what attendees thought — or add yours.',
          style: AppTypography.caption,
        ),
        const SizedBox(height: 14),
        if (loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: CircularProgressIndicator(color: AppColors.accentPink),
            ),
          )
        else if (reviews.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(AppTheme.radiusCard),
              border: Border.all(color: AppColors.borderSubtle),
            ),
            child: Column(
              children: [
                Text(
                  'No reviews yet',
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Be the first to rate this session.',
                  style: AppTypography.caption,
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: OutlinedButton(
                    onPressed: onAddOrEdit,
                    child: const Text('Add review'),
                  ),
                ),
              ],
            ),
          )
        else
          ...reviews.map(
            (review) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ReviewTile(review: review),
            ),
          ),
        if (!loading && reviews.isNotEmpty) ...[
          const SizedBox(height: 4),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: onAddOrEdit,
              child: Text(hasMyReview ? 'Edit your review' : 'Add review'),
            ),
          ),
        ],
      ],
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review});

  final SessionFeedbackEntity review;

  @override
  Widget build(BuildContext context) {
    final name = review.userName.trim().isEmpty ? 'Attendee' : review.userName.trim();
    final comment = review.comment.trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
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
                  name,
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(5, (index) {
                  final filled = index < review.rating;
                  return Icon(
                    filled ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 16,
                    color: filled
                        ? AppColors.accentPink
                        : AppColors.textTertiary,
                  );
                }),
              ),
            ],
          ),
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              comment,
              style: AppTypography.body.copyWith(
                fontSize: 14,
                height: 1.45,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReviewFormSheet extends StatelessWidget {
  const _ReviewFormSheet({
    required this.hasExisting,
    required this.selectedRating,
    required this.commentController,
    required this.saving,
    required this.onRatingChanged,
    required this.onSubmit,
    this.onRemove,
  });

  final bool hasExisting;
  final int selectedRating;
  final TextEditingController commentController;
  final bool saving;
  final ValueChanged<int> onRatingChanged;
  final VoidCallback onSubmit;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderSubtle,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              hasExisting ? 'Edit your review' : 'Add review',
              style: AppTypography.body.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Rate this session and leave an optional comment.',
              style: AppTypography.caption,
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (index) {
                final star = index + 1;
                final selected = star <= selectedRating;
                return IconButton(
                  onPressed: saving ? null : () => onRatingChanged(star),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                  icon: Icon(
                    selected ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 32,
                    color: selected
                        ? AppColors.accentPink
                        : AppColors.textTertiary,
                  ),
                );
              }),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: commentController,
              enabled: !saving,
              maxLines: 4,
              maxLength: 2000,
              style: AppTypography.body.copyWith(fontSize: 15),
              decoration: InputDecoration(
                hintText: 'Optional comment…',
                hintStyle: AppTypography.body.copyWith(
                  color: AppColors.textTertiary,
                  fontSize: 15,
                ),
                filled: true,
                fillColor: AppColors.bgBase,
                counterStyle: AppTypography.caption.copyWith(fontSize: 11),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  borderSide: const BorderSide(color: AppColors.borderSubtle),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  borderSide: const BorderSide(color: AppColors.borderSubtle),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  borderSide: const BorderSide(color: AppColors.accentPink),
                ),
                contentPadding: const EdgeInsets.all(14),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: saving ? null : onSubmit,
                child: saving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.textPrimary,
                        ),
                      )
                    : Text(hasExisting ? 'Update review' : 'Submit review'),
              ),
            ),
            if (onRemove != null) ...[
              const SizedBox(height: 8),
              SizedBox(
                height: 44,
                child: TextButton(
                  onPressed: saving ? null : onRemove,
                  child: Text(
                    'Remove review',
                    style: AppTypography.button.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 14,
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
              'Offline — showing saved session details',
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
