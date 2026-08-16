import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/auth_ambient_background.dart';
import 'package:unleash_your_brave/core/widgets/brand_logo.dart';
import 'package:unleash_your_brave/core/widgets/staggered_entrance.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final _controller = PageController();
  int _index = 0;

  static const _pages = <_OnboardingSlide>[
    _OnboardingSlide(
      icon: Icons.auto_awesome_rounded,
      title: 'Unleash Your Brave',
      body:
          'Your event companion for bold connections, clear schedules, and moments that matter.',
    ),
    _OnboardingSlide(
      icon: Icons.calendar_month_rounded,
      title: 'Know every moment',
      body:
          'Browse the agenda, open sessions, and find your way — all in one calm, focused place.',
    ),
    _OnboardingSlide(
      icon: Icons.forum_rounded,
      title: 'Stay in the room',
      body:
          'Chat with attendees, catch announcements, and never miss what’s next.',
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    final prefs = sl<SharedPreferences>();
    await prefs.setBool(StorageKeys.onboardingCompleted, true);
    if (!mounted) return;
    context.go('/login');
  }

  void _next() {
    if (_index >= _pages.length - 1) {
      _finish();
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 480),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _pages.length - 1;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: AuthAmbientBackground(
        intensity: 1.05,
        child: SafeArea(
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: context.pagePadding.left,
              vertical: 12,
            ),
            child: Column(
              children: [
                StaggeredEntrance(
                  child: Row(
                    children: [
                      const BrandLogo(height: 40, alignment: Alignment.centerLeft),
                      const Spacer(),
                      if (!isLast)
                        TextButton(
                          onPressed: _finish,
                          child: Text(
                            'Skip',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _pages.length,
                    onPageChanged: (value) => setState(() => _index = value),
                    itemBuilder: (context, index) {
                      return _OnboardingSlideView(
                        key: ValueKey('onboarding_$index'),
                        slide: _pages[index],
                        active: index == _index,
                      );
                    },
                  ),
                ),
                StaggeredEntrance(
                  delay: const Duration(milliseconds: 180),
                  child: Column(
                    children: [
                      _PageDots(count: _pages.length, index: _index),
                      const SizedBox(height: 28),
                      SizedBox(
                        width: double.infinity,
                        height: context.responsive(
                          compact: 52.0,
                          medium: 54.0,
                          expanded: 56.0,
                        ),
                        child: ElevatedButton(
                          onPressed: _next,
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 220),
                            child: Text(
                              isLast ? 'Get started' : 'Continue',
                              key: ValueKey(isLast),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: _finish,
                        child: Text.rich(
                          TextSpan(
                            style: AppTypography.caption,
                            children: [
                              const TextSpan(text: 'Already have an account? '),
                              TextSpan(
                                text: 'Sign in',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.accentPink,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OnboardingSlide {
  const _OnboardingSlide({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;
}

class _OnboardingSlideView extends StatefulWidget {
  const _OnboardingSlideView({
    super.key,
    required this.slide,
    required this.active,
  });

  final _OnboardingSlide slide;
  final bool active;

  @override
  State<_OnboardingSlideView> createState() => _OnboardingSlideViewState();
}

class _OnboardingSlideViewState extends State<_OnboardingSlideView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _motion;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    final curved = CurvedAnimation(parent: _motion, curve: Curves.easeOutCubic);
    _fade = curved;
    _scale = Tween<double>(begin: 0.92, end: 1).animate(curved);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(curved);
    if (widget.active) _motion.forward();
  }

  @override
  void didUpdateWidget(covariant _OnboardingSlideView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) {
      _motion.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: ScaleTransition(
          scale: _scale,
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: context.isCompact ? 4 : 12,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _IconStage(icon: widget.slide.icon),
                SizedBox(height: context.isShortViewport ? 28 : 40),
                Text(
                  widget.slide.title,
                  textAlign: TextAlign.center,
                  style: AppTypography.headline.copyWith(
                    fontSize: context.headlineSize,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  widget.slide.body,
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.55,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _IconStage extends StatefulWidget {
  const _IconStage({required this.icon});

  final IconData icon;

  @override
  State<_IconStage> createState() => _IconStageState();
}

class _IconStageState extends State<_IconStage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = context.responsive(compact: 128.0, medium: 148.0, expanded: 160.0);

    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_pulse.value);
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                AppColors.accentPink.withValues(alpha: 0.22 + (0.08 * t)),
                AppColors.bgCard.withValues(alpha: 0.9),
              ],
            ),
            border: Border.all(
              color: AppColors.accentPink.withValues(alpha: 0.28 + (0.12 * t)),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.accentPink.withValues(alpha: 0.18 + (0.1 * t)),
                blurRadius: 36 + (12 * t),
                spreadRadius: 1,
              ),
            ],
          ),
          child: child,
        );
      },
      child: Icon(
        widget.icon,
        size: size * 0.38,
        color: AppColors.accentPink,
      ),
    );
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final active = i == index;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: active ? 28 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: active
                ? AppColors.accentPink
                : AppColors.textTertiary.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(8),
          ),
        );
      }),
    );
  }
}
