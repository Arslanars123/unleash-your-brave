import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

/// Standard back affordance for screens opened from another screen.
PreferredSizeWidget buildSubpageAppBar(
  BuildContext context, {
  required String title,
  String? fallbackLocation,
}) {
  return AppBar(
    backgroundColor: AppColors.bgBase,
    elevation: 0,
    scrolledUnderElevation: 0,
    title: Text(
      title,
      style: AppTypography.body.copyWith(fontWeight: FontWeight.w600, fontSize: 17),
    ),
    leading: IconButton(
      icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
      onPressed: () {
        if (context.canPop()) {
          context.pop();
          return;
        }
        context.go(fallbackLocation ?? '/');
      },
    ),
  );
}
