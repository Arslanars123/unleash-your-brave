import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

class QuickActionCard extends StatelessWidget {
  const QuickActionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final chipSize = context.responsive(compact: 44.0, medium: 48.0);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Ink(
          padding: EdgeInsets.all(
            context.responsive(compact: 16.0, medium: 18.0),
          ),
          decoration: BoxDecoration(
            color: AppColors.bgCard,
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: chipSize,
                height: chipSize,
                decoration: BoxDecoration(
                  color: AppColors.accentPink,
                  borderRadius: BorderRadius.circular(AppTheme.radiusChip),
                ),
                child: Icon(
                  icon,
                  color: AppColors.bgBase,
                  size: chipSize * 0.48,
                ),
              ),
              SizedBox(height: context.responsive(compact: 14.0, medium: 16.0)),
              Text(
                title,
                style: AppTypography.body.copyWith(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: AppTypography.caption,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
