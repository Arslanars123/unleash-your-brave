import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/validators.dart';
import 'package:unleash_your_brave/core/widgets/brand_logo.dart';

class AuthTextField extends StatelessWidget {
  const AuthTextField({
    super.key,
    required this.controller,
    required this.label,
    this.keyboardType,
    this.obscureText = false,
    this.onToggleObscure,
    this.textInputAction,
    this.onFieldSubmitted,
    this.onChanged,
    this.validator,
    this.autofillHints,
    this.inputFormatters,
    this.prefixIcon,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final bool obscureText;
  final VoidCallback? onToggleObscure;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;
  final ValueChanged<String>? onChanged;
  final String? Function(String?)? validator;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final IconData? prefixIcon;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      onChanged: onChanged,
      autofillHints: autofillHints,
      inputFormatters: inputFormatters,
      enabled: enabled,
      style: AppTypography.body,
      cursorColor: AppColors.accentPink,
      validator: validator,
      textInputAction: textInputAction ?? TextInputAction.done,
      onFieldSubmitted: onFieldSubmitted ??
          (_) => FocusManager.instance.primaryFocus?.unfocus(),
      onEditingComplete: () => FocusManager.instance.primaryFocus?.unfocus(),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: AppTypography.caption,
        errorStyle: AppTypography.caption.copyWith(
          color: const Color(0xFFE5484D),
          fontSize: 12,
        ),
        prefixIcon: prefixIcon == null
            ? null
            : Icon(prefixIcon, color: AppColors.textTertiary, size: 20),
        suffixIcon: onToggleObscure == null
            ? null
            : IconButton(
                onPressed: onToggleObscure,
                icon: Icon(
                  obscureText
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: AppColors.textTertiary,
                  size: 20,
                ),
              ),
      ),
    );
  }
}

/// Advisory strength meter shown under the signup password field.
class PasswordStrengthMeter extends StatelessWidget {
  const PasswordStrengthMeter({super.key, required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    final strength = estimatePasswordStrength(password);
    if (strength == PasswordStrength.empty) {
      return const SizedBox.shrink();
    }

    final color = switch (strength) {
      PasswordStrength.weak => const Color(0xFFE5484D),
      PasswordStrength.fair => const Color(0xFFE2A03F),
      PasswordStrength.good => const Color(0xFFE9C46A),
      PasswordStrength.strong => AppColors.accentPink,
      PasswordStrength.empty => AppColors.borderSubtle,
    };

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(4, (index) {
              final filled = index < strength.segments;
              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(right: index < 3 ? 6 : 0),
                  decoration: BoxDecoration(
                    color: filled ? color : AppColors.borderSubtle,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 6),
          Text(
            'Password strength: ${strength.label}',
            style: AppTypography.caption.copyWith(color: color, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: context.responsive(compact: 52.0, medium: 54.0, expanded: 56.0),
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
          ),
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.textPrimary,
                ),
              )
            : Text(label),
      ),
    );
  }
}

class AuthBrandHeader extends StatelessWidget {
  const AuthBrandHeader({
    super.key,
    required this.title,
    this.subtitle,
  });

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final headlineSize = context.headlineSize;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const _AuthLogoGlow(
          child: BrandLogo(height: 88, alignment: Alignment.center),
        ),
        SizedBox(height: context.isShortViewport ? 18 : 28),
        Text(
          title,
          textAlign: TextAlign.center,
          style: AppTypography.headline.copyWith(fontSize: headlineSize),
        ),
        if (subtitle != null && subtitle!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: AppTypography.caption,
          ),
        ],
      ],
    );
  }
}

class _AuthLogoGlow extends StatefulWidget {
  const _AuthLogoGlow({required this.child});

  final Widget child;

  @override
  State<_AuthLogoGlow> createState() => _AuthLogoGlowState();
}

class _AuthLogoGlowState extends State<_AuthLogoGlow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_pulse.value);
        return Container(
          decoration: BoxDecoration(
            boxShadow: [
              BoxShadow(
                color: AppColors.accentPink.withValues(alpha: 0.1 + (0.08 * t)),
                blurRadius: 28 + (10 * t),
                spreadRadius: 1,
              ),
            ],
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}
