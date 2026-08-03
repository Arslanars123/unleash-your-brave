import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';

/// Lightweight placeholder for tabs that are not built yet.
class PlaceholderTabPage extends StatelessWidget {
  const PlaceholderTabPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: AdaptiveCenteredBody(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.accentPink,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: AppColors.bgBase, size: 28),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: AppTypography.headline.copyWith(fontSize: 28),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: AppTypography.caption,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
