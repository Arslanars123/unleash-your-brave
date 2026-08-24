import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/app_circle_avatar.dart';
import 'package:unleash_your_brave/features/sponsors/domain/entities/sponsor_entity.dart';

class SponsorCard extends StatelessWidget {
  const SponsorCard({
    super.key,
    required this.sponsor,
    this.onTap,
  });

  final SponsorEntity sponsor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final description = sponsor.description.trim();
    final offerCount = sponsor.offers.length;

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
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppCircleAvatar(
                radius: 28,
                photoUrl: sponsor.image,
                fallback: Icon(
                  Icons.storefront_outlined,
                  color: AppColors.accentPink,
                  size: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sponsor.name,
                      style: AppTypography.body.copyWith(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                    ),
                    if (description.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.caption.copyWith(
                          fontSize: 14,
                          height: 1.45,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    if (offerCount > 0) ...[
                      const SizedBox(height: 10),
                      Text(
                        '$offerCount ${offerCount == 1 ? 'offer' : 'offers'}',
                        style: AppTypography.caption.copyWith(
                          fontSize: 12,
                          color: AppColors.accentPink,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
