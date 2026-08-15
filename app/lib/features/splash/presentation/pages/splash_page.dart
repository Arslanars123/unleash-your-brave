import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/widgets/brand_logo.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';

/// Full-bleed black splash with brand logo, then routes into auth/home.
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage>
    with SingleTickerProviderStateMixin {
  static const _minDisplay = Duration(milliseconds: 1800);

  late final AnimationController _motion;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  late final Future<void> _hold;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _hold = Future<void>.delayed(_minDisplay);
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade = CurvedAnimation(parent: _motion, curve: Curves.easeOut);
    _scale = Tween<double>(begin: 0.92, end: 1).animate(
      CurvedAnimation(parent: _motion, curve: Curves.easeOutCubic),
    );
    unawaited(_motion.forward());
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeLeave());
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  Future<void> _maybeLeave() async {
    await _hold;
    if (!mounted || _navigated) return;

    final state = context.read<AuthBloc>().state;
    if (state is AuthInitial || state is AuthCheckingSession) {
      // Still bootstrapping — wait for the next auth emission.
      return;
    }
    _go(state);
  }

  void _go(AuthState state) {
    if (!mounted || _navigated) return;
    _navigated = true;

    if (state is AuthAuthenticated) {
      if (state.user.mustChangePassword) {
        context.go('/set-password');
      } else {
        context.go('/');
      }
      return;
    }
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listenWhen: (prev, next) =>
          next is AuthAuthenticated ||
          next is AuthUnauthenticated ||
          next is AuthFailureState,
      listener: (context, state) => unawaited(_maybeLeave()),
      child: Scaffold(
        backgroundColor: AppColors.bgBase,
        body: SafeArea(
          child: Center(
            child: FadeTransition(
              opacity: _fade,
              child: ScaleTransition(
                scale: _scale,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 36),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const BrandLogo(height: 96, alignment: Alignment.center),
                      const SizedBox(height: 36),
                      SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.accentPink.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
