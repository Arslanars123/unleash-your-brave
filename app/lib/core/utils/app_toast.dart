import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

enum ToastKind { success, error, info }

/// App-wide toast/snackbar helper. Uses a root [ScaffoldMessenger] so toasts
/// survive route changes (e.g. showing "Signed in" as we navigate to home).
abstract final class AppToast {
  static final GlobalKey<ScaffoldMessengerState> messengerKey =
      GlobalKey<ScaffoldMessengerState>();

  static void success(String message) => _show(message, ToastKind.success);
  static void error(String message) => _show(message, ToastKind.error);
  static void info(String message) => _show(message, ToastKind.info);

  static void _show(String message, ToastKind kind) {
    final messenger = messengerKey.currentState;
    if (messenger == null) return;

    final (Color accent, IconData icon) = switch (kind) {
      ToastKind.success => (AppColors.accentPink, Icons.check_circle_rounded),
      ToastKind.error => (const Color(0xFFE5484D), Icons.error_rounded),
      ToastKind.info => (AppColors.textSecondary, Icons.info_rounded),
    };

    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.bgCard,
          elevation: 0,
          duration: const Duration(seconds: 3),
          margin: const EdgeInsets.all(16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: accent.withValues(alpha: 0.4)),
          ),
          content: Row(
            children: [
              Icon(icon, color: accent, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: AppTypography.body.copyWith(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
  }
}
