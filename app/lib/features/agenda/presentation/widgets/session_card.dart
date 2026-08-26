import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/utils/datetime_format.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/features/agenda/domain/entities/session_entity.dart';

class SessionCard extends StatelessWidget {
  const SessionCard({
    super.key,
    required this.session,
    this.onTap,
  });

  final SessionEntity session;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final speakerName = session.speaker?.name.trim() ?? '';
    final speakerTitle = session.speaker?.title.trim() ?? '';
    final description = session.description.trim();
    final materialCount = session.materials.length;
    final address = session.address.trim();
    final location = session.location.trim();
    final isExtraActivity = session.isExtraActivity;
    final timeRange = formatSessionTimeRange(session.startTime, session.endTime);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Ink(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.bgCard,
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isExtraActivity) ...[
                Row(
                  children: [
                    Text(
                      'EXTRA ACTIVITY',
                      style: AppTypography.microLabel.copyWith(
                        letterSpacing: 1.2,
                        color: AppColors.accentPink,
                      ),
                    ),
                    if (session.accessRestricted || session.agendaLocked) ...[
                      const SizedBox(width: 8),
                      Icon(
                        Icons.lock_outline,
                        size: 12,
                        color: AppColors.textTertiary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        session.agendaLocked ? 'LOCKED' : 'PASS REQUIRED',
                        style: AppTypography.microLabel.copyWith(
                          letterSpacing: 1.0,
                          color: AppColors.textTertiary,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
              ] else if (session.accessRestricted || session.agendaLocked) ...[
                Row(
                  children: [
                    Icon(
                      Icons.lock_outline,
                      size: 12,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      session.agendaLocked ? 'LOCKED' : 'PASS REQUIRED',
                      style: AppTypography.microLabel.copyWith(
                        letterSpacing: 1.0,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
              ],
              Text(
                session.name,
                style: AppTypography.body.copyWith(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                ),
              ),
              if (timeRange.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  timeRange,
                  style: AppTypography.caption.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentPink,
                  ),
                ),
              ],
              if (location.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  location,
                  style: AppTypography.caption.copyWith(fontSize: 13),
                ),
              ],
              if (description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  description,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    fontSize: 14,
                    height: 1.45,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              if (speakerName.isNotEmpty && !isExtraActivity) ...[
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.mic_none_rounded,
                      size: 16,
                      color: AppColors.accentPink,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            speakerName,
                            style: AppTypography.body.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          if (speakerTitle.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              speakerTitle,
                              style: AppTypography.caption.copyWith(fontSize: 12),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ],
              if (address.isNotEmpty && isExtraActivity) ...[
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 16,
                      color: AppColors.accentPink,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        address,
                        style: AppTypography.caption.copyWith(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ],
              if (materialCount > 0 && !isExtraActivity) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Icon(
                      Icons.folder_open_outlined,
                      size: 14,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '$materialCount ${materialCount == 1 ? 'resource' : 'resources'}',
                      style: AppTypography.caption.copyWith(
                        fontSize: 12,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
