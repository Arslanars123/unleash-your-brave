import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

/// Dark luxury / editorial theme. Spec: docs/DESIGN_SYSTEM.md
abstract final class AppTheme {
  static const double radiusCard = 20;
  static const double radiusSmall = 12;
  static const double radiusStat = 16;
  static const double radiusChip = 14;
  static const EdgeInsets cardPadding = EdgeInsets.all(20);

  static ThemeData get dark {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: const ColorScheme.dark(
        surface: AppColors.bgBase,
        primary: AppColors.accentPink,
        onPrimary: AppColors.textPrimary,
        secondary: AppColors.accentPinkDark,
        onSecondary: AppColors.textPrimary,
        onSurface: AppColors.textPrimary,
        outline: AppColors.borderSubtle,
      ),
    );

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.bgBase,
      canvasColor: AppColors.bgBase,
      dividerColor: AppColors.borderSubtle,
      textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.bgBase,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: AppTypography.headline,
      ),
      cardTheme: CardThemeData(
        color: AppColors.bgCard,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusCard),
          side: const BorderSide(color: AppColors.borderSubtle),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.bgCard,
        hintStyle: AppTypography.caption,
        labelStyle: AppTypography.caption,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: const BorderSide(color: AppColors.borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: const BorderSide(color: AppColors.borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: const BorderSide(color: AppColors.accentPink),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accentPink,
          foregroundColor: AppColors.textPrimary,
          disabledBackgroundColor: AppColors.bgMaroon,
          disabledForegroundColor: AppColors.textTertiary,
          minimumSize: const Size.fromHeight(52),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusSmall),
          ),
          textStyle: AppTypography.button,
        ).copyWith(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed) ||
                states.contains(WidgetState.hovered)) {
              return AppColors.accentPinkDark;
            }
            if (states.contains(WidgetState.disabled)) {
              return AppColors.bgMaroon;
            }
            return AppColors.accentPink;
          }),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accentPink,
          textStyle: AppTypography.button,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.bgBase,
        indicatorColor: Colors.transparent,
        elevation: 0,
        height: 72,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final active = states.contains(WidgetState.selected);
          return AppTypography.microLabel.copyWith(
            color: active ? AppColors.accentPink : AppColors.textTertiary,
            fontSize: 11,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final active = states.contains(WidgetState.selected);
          return IconThemeData(
            color: active ? AppColors.accentPink : AppColors.textTertiary,
            size: 22,
          );
        }),
      ),
    );
  }

  /// Product is dark-only; alias kept for older call sites.
  static ThemeData get light => dark;
}
