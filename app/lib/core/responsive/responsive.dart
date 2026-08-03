import 'package:flutter/material.dart';

/// Window size classes, aligned with Material 3 breakpoints.
enum ScreenSize {
  /// Phones in portrait (< 600dp).
  compact,

  /// Large phones landscape, small tablets, foldables (600–839dp).
  medium,

  /// Tablets, small desktop windows (840–1199dp).
  expanded,

  /// Large desktop / wide web (>= 1200dp).
  large,
}

abstract final class AppBreakpoints {
  static const double compact = 600;
  static const double medium = 840;
  static const double expanded = 1200;
}

extension ResponsiveContext on BuildContext {
  MediaQueryData get _mq => MediaQuery.of(this);

  Size get screenSize => _mq.size;
  double get screenWidth => _mq.size.width;
  double get screenHeight => _mq.size.height;

  bool get isLandscape => _mq.orientation == Orientation.landscape;

  /// True on very short viewports (small phones in landscape) where vertical
  /// rhythm must tighten to avoid excessive scrolling.
  bool get isShortViewport => _mq.size.height < 640;

  ScreenSize get sizeClass {
    final width = _mq.size.width;
    if (width < AppBreakpoints.compact) return ScreenSize.compact;
    if (width < AppBreakpoints.medium) return ScreenSize.medium;
    if (width < AppBreakpoints.expanded) return ScreenSize.expanded;
    return ScreenSize.large;
  }

  bool get isCompact => sizeClass == ScreenSize.compact;
  bool get isTablet =>
      sizeClass == ScreenSize.medium || sizeClass == ScreenSize.expanded;
  bool get isDesktop => sizeClass == ScreenSize.large;

  /// Picks a value for the current size class, falling back to the closest
  /// smaller breakpoint that was supplied.
  T responsive<T>({
    required T compact,
    T? medium,
    T? expanded,
    T? large,
  }) {
    return switch (sizeClass) {
      ScreenSize.compact => compact,
      ScreenSize.medium => medium ?? compact,
      ScreenSize.expanded => expanded ?? medium ?? compact,
      ScreenSize.large => large ?? expanded ?? medium ?? compact,
    };
  }

  /// Outer page padding that grows with available width.
  EdgeInsets get pagePadding => EdgeInsets.symmetric(
        horizontal: responsive(compact: 20, medium: 32, expanded: 40, large: 48),
        vertical: isShortViewport ? 16 : 24,
      );

  /// Inner card padding — stays within the 16–24px design-system range.
  EdgeInsets get cardPadding =>
      EdgeInsets.all(responsive(compact: 18, medium: 22, expanded: 24));

  /// Caps line length on tablets and desktop so content stays readable.
  double get maxContentWidth =>
      responsive(compact: 520, medium: 560, expanded: 720, large: 840);

  /// Narrower cap tuned for single-column forms.
  double get maxFormWidth =>
      responsive(compact: 440, medium: 460, expanded: 480, large: 480);

  /// Headline size stays inside the 32–40px design-system range.
  double get headlineSize =>
      responsive(compact: 32, medium: 36, expanded: 38, large: 40);

  /// Vertical gap between major blocks.
  double get sectionGap => isShortViewport ? 20 : responsive(compact: 28, medium: 32);
}
