import 'package:flutter/material.dart';

/// Design tokens for Unleash Your Brave.
/// Spec: docs/DESIGN_SYSTEM.md
abstract final class AppColors {
  static const Color bgBase = Color(0xFF000000);
  static const Color bgCard = Color(0xFF0A0A0A);
  static const Color bgMaroon = Color(0xFF14080E);

  static const Color accentPink = Color(0xFFDB457B);
  static const Color accentPinkDark = Color(0xFFC93E70);

  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFBDBDBD);
  static const Color textTertiary = Color(0xFF757575);

  /// Card / divider border — rgba(255,255,255,0.08)
  static const Color borderSubtle = Color(0x14FFFFFF);

  /// Top color of the hero overlay gradient (warm brown @ 30%).
  static const Color heroOverlayTop = Color(0x4D4A3524);

  static const LinearGradient gradientHero = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [heroOverlayTop, bgBase],
  );
}
