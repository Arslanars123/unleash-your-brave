import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';

/// Soft drifting pink / maroon glows behind auth, splash, and onboarding.
class AuthAmbientBackground extends StatefulWidget {
  const AuthAmbientBackground({
    super.key,
    this.intensity = 1,
    this.child,
  });

  final double intensity;
  final Widget? child;

  @override
  State<AuthAmbientBackground> createState() => _AuthAmbientBackgroundState();
}

class _AuthAmbientBackgroundState extends State<AuthAmbientBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _drift;

  @override
  void initState() {
    super.initState();
    _drift = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final i = widget.intensity.clamp(0.35, 1.4);

    return AnimatedBuilder(
      animation: _drift,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_drift.value);
        return Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: AppColors.bgBase),
            Positioned(
              left: -size.width * 0.28 + (t * 28),
              top: -size.height * 0.12 + (t * 18),
              child: _GlowOrb(
                diameter: size.width * 0.85,
                color: AppColors.accentPink.withValues(alpha: 0.16 * i),
              ),
            ),
            Positioned(
              right: -size.width * 0.32 - (t * 20),
              bottom: size.height * 0.08 - (t * 24),
              child: _GlowOrb(
                diameter: size.width * 0.9,
                color: AppColors.bgMaroon.withValues(alpha: 0.55 * i),
              ),
            ),
            Positioned(
              left: size.width * 0.2 + math.sin(t * math.pi) * 16,
              bottom: -size.height * 0.05,
              child: _GlowOrb(
                diameter: size.width * 0.55,
                color: AppColors.accentPinkDark.withValues(alpha: 0.1 * i),
              ),
            ),
            if (child != null) child,
          ],
        );
      },
      child: widget.child,
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.diameter, required this.color});

  final double diameter;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: diameter,
        height: diameter,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color,
              color.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}
