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
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/features/agenda/data/datasources/sessions_remote_datasource.dart';
import 'package:unleash_your_brave/features/agenda/domain/entities/session_entity.dart';

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

  @override
  void initState() {
    super.initState();
    _session = widget.initialSession;
    unawaited(_load(isRefresh: _session != null));
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
    if (_session != null) {
      setState(() {
        _loading = false;
        _refreshing = false;
        _isOffline = isOffline;
      });
      AppToast.info(
        isOffline
            ? 'You’re offline. Showing saved session details.'
            : 'Couldn’t refresh. Showing saved session details.',
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
          'Session',
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
                        if (ratingsCount > 0 && summary != null)
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
                    if (speaker != null && speaker.name.trim().isNotEmpty) ...[
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
                          ? 'No description available for this session.'
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
    final photoUrl = resolveMediaUrl(speaker.photo);
    final title = speaker.title.trim();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        CircleAvatar(
          radius: 26,
          backgroundColor: AppColors.bgMaroon,
          backgroundImage:
              photoUrl.isNotEmpty ? NetworkImage(photoUrl) : null,
          child: photoUrl.isEmpty
              ? Text(
                  speaker.name.trim().isNotEmpty
                      ? speaker.name.trim()[0].toUpperCase()
                      : '?',
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentPink,
                  ),
                )
              : null,
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
