import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';

/// Typography + shared text styles. Spec: docs/DESIGN_SYSTEM.md
///
/// Display: Playfair Display
/// UI / body: Plus Jakarta Sans
abstract final class AppTypography {
  /// All-caps micro-labels (section headers, nav-adjacent labels).
  static TextStyle get microLabel => GoogleFonts.plusJakartaSans(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.65,
        color: AppColors.textSecondary,
        height: 1.2,
      );

  static TextStyle get headline => GoogleFonts.playfairDisplay(
        fontSize: 36,
        fontWeight: FontWeight.w500,
        height: 1.15,
        color: AppColors.textPrimary,
      );

  static TextStyle get headlineEmphasis => GoogleFonts.playfairDisplay(
        fontSize: 36,
        fontWeight: FontWeight.w500,
        height: 1.15,
        color: AppColors.accentPink,
      );

  /// Large countdown / stat numerals.
  static TextStyle get numeral => GoogleFonts.playfairDisplay(
        fontSize: 40,
        fontWeight: FontWeight.w500,
        letterSpacing: 1.0,
        height: 1.1,
        color: AppColors.accentPink,
      );

  static TextStyle get body => GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 1.5,
        color: AppColors.textPrimary,
      );

  static TextStyle get caption => GoogleFonts.plusJakartaSans(
        fontSize: 13,
        fontWeight: FontWeight.w400,
        height: 1.4,
        color: AppColors.textSecondary,
      );

  static TextStyle get button => GoogleFonts.plusJakartaSans(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.2,
        color: AppColors.textPrimary,
      );
}
