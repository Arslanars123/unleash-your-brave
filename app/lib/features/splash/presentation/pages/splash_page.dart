import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/widgets/auth_ambient_background.dart';
import 'package:unleash_your_brave/core/widgets/brand_logo.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';

/// Full-bleed branded splash with ambient motion, then auth / onboarding / home.
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage>
    with TickerProviderStateMixin {
  static const _minDisplay = Duration(milliseconds: 2200);

  late final AnimationController _entrance;
  late final AnimationController _pulse;
  late final AnimationController _exit;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  late final Animation<double> _glow;
  late final Animation<double> _loaderFade;
  late final Future<void> _hold;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _hold = Future<void>.delayed(_minDisplay);

    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _exit = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );

    final entranceCurve = CurvedAnimation(
      parent: _entrance,
      curve: Curves.easeOutCubic,
    );
    _fade = entranceCurve;
    _scale = Tween<double>(begin: 0.86, end: 1).animate(entranceCurve);
    _glow = Tween<double>(begin: 0.35, end: 1).animate(
      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
    );
    _loaderFade = CurvedAnimation(
      parent: _entrance,
      curve: const Interval(0.55, 1, curve: Curves.easeOut),
    );

    unawaited(_entrance.forward());
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeLeave());
  }

  @override
  void dispose() {
    _entrance.dispose();
    _pulse.dispose();
    _exit.dispose();
    super.dispose();
  }

  Future<void> _maybeLeave() async {
    await _hold;
    if (!mounted || _navigated) return;

    final state = context.read<AuthBloc>().state;
    if (state is AuthInitial || state is AuthCheckingSession) {
      return;
    }
    await _go(state);
  }

  Future<void> _go(AuthState state) async {
    if (!mounted || _navigated) return;
    _navigated = true;

    await _exit.forward();
    if (!mounted) return;

    if (state is AuthAuthenticated) {
      if (state.user.mustChangePassword) {
        context.go('/set-password');
      } else {
        context.go('/');
      }
      return;
    }

    final prefs = sl<SharedPreferences>();
    final seen = prefs.getBool(StorageKeys.onboardingCompleted) ?? false;
    context.go(seen ? '/login' : '/onboarding');
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
        body: FadeTransition(
          opacity: Tween<double>(begin: 1, end: 0).animate(
            CurvedAnimation(parent: _exit, curve: Curves.easeIn),
          ),
          child: AuthAmbientBackground(
            intensity: 1.15,
            child: SafeArea(
              child: Center(
                child: FadeTransition(
                  opacity: _fade,
                  child: ScaleTransition(
                    scale: _scale,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AnimatedBuilder(
                            animation: _glow,
                            builder: (context, child) {
                              return Container(
                                decoration: BoxDecoration(
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.accentPink.withValues(
                                        alpha: 0.18 * _glow.value,
                                      ),
                                      blurRadius: 48 + (18 * _glow.value),
                                      spreadRadius: 2,
                                    ),
                                  ],
                                ),
                                child: child,
                              );
                            },
                            child: const BrandLogo(
                              height: 84,
                              alignment: Alignment.center,
                            ),
                          ),
                          const SizedBox(height: 44),
                          FadeTransition(
                            opacity: _loaderFade,
                            child: const _SplashLoader(),
                          ),
                        ],
                      ),
                    ),
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

class _SplashLoader extends StatefulWidget {
  const _SplashLoader();

  @override
  State<_SplashLoader> createState() => _SplashLoaderState();
}

class _SplashLoaderState extends State<_SplashLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _spin;

  @override
  void initState() {
    super.initState();
    _spin = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RotationTransition(
      turns: _spin,
      child: SizedBox(
        width: 26,
        height: 26,
        child: CircularProgressIndicator(
          strokeWidth: 2.2,
          valueColor: AlwaysStoppedAnimation(
            AppColors.accentPink.withValues(alpha: 0.9),
          ),
          backgroundColor: AppColors.accentPink.withValues(alpha: 0.12),
        ),
      ),
    );
  }
}
