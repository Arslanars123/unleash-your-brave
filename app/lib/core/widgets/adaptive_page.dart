import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';

/// Scrollable page body that vertically centres its child when it fits and
/// scrolls once it does not.
///
/// This is the behaviour we want on every device: centred on tall phones and
/// tablets, scrollable on small/landscape screens and whenever the keyboard
/// shrinks the viewport.
class AdaptiveCenteredBody extends StatelessWidget {
  const AdaptiveCenteredBody({
    super.key,
    required this.child,
    this.maxWidth,
    this.padding,
  });

  final Widget child;
  final double? maxWidth;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    final resolvedPadding = padding ?? context.pagePadding;
    final resolvedMaxWidth = maxWidth ?? context.maxFormWidth;

    return SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            padding: resolvedPadding,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            // Keeps the submit button reachable while the keyboard is open.
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: constraints.maxHeight -
                    resolvedPadding.top -
                    resolvedPadding.bottom,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: resolvedMaxWidth),
                  child: child,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Top-aligned scrollable body with a responsive max content width.
/// Used for content screens (home, future event screens).
class AdaptiveScrollBody extends StatelessWidget {
  const AdaptiveScrollBody({
    super.key,
    required this.child,
    this.maxWidth,
    this.padding,
    this.useSafeArea = true,
  });

  final Widget child;
  final double? maxWidth;
  final EdgeInsets? padding;
  final bool useSafeArea;

  @override
  Widget build(BuildContext context) {
    final scroll = SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: padding ?? context.pagePadding,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth ?? context.maxContentWidth),
          child: child,
        ),
      ),
    );

    if (!useSafeArea) return scroll;
    return SafeArea(child: scroll);
  }
}
