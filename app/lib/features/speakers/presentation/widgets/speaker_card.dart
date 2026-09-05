import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/app_circle_avatar.dart';
import 'package:unleash_your_brave/features/speakers/domain/entities/speaker_entity.dart';

class SpeakerCard extends StatelessWidget {
  const SpeakerCard({super.key, required this.speaker});

  final SpeakerEntity speaker;

  @override
  Widget build(BuildContext context) {
    final name = speaker.name.trim();
    final title = speaker.title.trim();
    final description = speaker.description.trim();
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCircleAvatar(
            radius: 28,
            photoUrl: speaker.photo,
            cacheBust: speaker.photo,
            fallback: Text(
              initial,
              style: AppTypography.body.copyWith(
                fontWeight: FontWeight.w700,
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
                  name,
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                if (title.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    title,
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    description,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(height: 1.4),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
