import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';

/// Brand wordmark used across splash, auth, and chrome.
class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.height = 72,
    this.alignment = Alignment.centerLeft,
  });

  final double height;
  final Alignment alignment;

  static const assetPath = 'assets/images/brand_logo.png';

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: Image.asset(
        assetPath,
        height: height,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
        errorBuilder: (_, __, ___) => Text(
          'Unleash Your Brave',
          style: TextStyle(
            color: AppColors.textPrimary.withValues(alpha: 0.9),
            fontWeight: FontWeight.w700,
            fontSize: height * 0.28,
          ),
        ),
      ),
    );
  }
}
