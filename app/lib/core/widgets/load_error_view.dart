import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

enum LoadErrorKind { offline, generic }

/// Full-page / section error with retry for offline and request failures.
class LoadErrorView extends StatelessWidget {
  const LoadErrorView({
    super.key,
    required this.onRetry,
    this.kind = LoadErrorKind.generic,
    this.message,
    this.retrying = false,
  });

  final VoidCallback onRetry;
  final LoadErrorKind kind;
  final String? message;
  final bool retrying;

  @override
  Widget build(BuildContext context) {
    final isOffline = kind == LoadErrorKind.offline;
    final title = isOffline ? 'No internet connection' : 'Something went wrong';
    final body = message ??
        (isOffline
            ? 'Check your connection, then try again.'
            : 'We couldn’t load this right now. Please try again.');

    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: context.maxContentWidth),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: context.pagePadding.left,
            vertical: 32,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.bgMaroon,
                  borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Icon(
                  isOffline
                      ? Icons.wifi_off_rounded
                      : Icons.error_outline_rounded,
                  size: 32,
                  color: AppColors.accentPink,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                title,
                textAlign: TextAlign.center,
                style: AppTypography.headline.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 10),
              Text(
                body,
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                height: context.responsive(
                  compact: 52.0,
                  medium: 54.0,
                  expanded: 56.0,
                ),
                child: ElevatedButton(
                  onPressed: retrying ? null : onRetry,
                  child: retrying
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.textPrimary,
                          ),
                        )
                      : const Text('Try again'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
