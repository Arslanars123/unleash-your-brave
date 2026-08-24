import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:keyboard_actions/keyboard_actions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/utils/validators.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/auth_ambient_background.dart';
import 'package:unleash_your_brave/core/widgets/staggered_entrance.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/auth/presentation/widgets/auth_form_fields.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  AutovalidateMode _autovalidateMode = AutovalidateMode.disabled;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate()) {
      setState(() => _autovalidateMode = AutovalidateMode.onUserInteraction);
      return;
    }

    context.read<AuthBloc>().add(
          AuthLoginRequested(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          ),
        );
  }

  Future<void> _showInviteAlreadyUsedDialog(String message) async {
    final goReset = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: AppColors.bgCard,
          title: Text(
            'Invite code already used',
            style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
          ),
          content: Text(
            message,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
              height: 1.45,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(
                'Enter password',
                style: AppTypography.caption.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(
                'Reset password',
                style: AppTypography.caption.copyWith(
                  color: AppColors.accentPink,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        );
      },
    );

    if (!mounted) return;
    if (goReset == true) {
      context.go('/forgot-password');
    } else {
      _passwordController.clear();
      setState(() => _obscurePassword = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: AuthAmbientBackground(
        child: BlocConsumer<AuthBloc, AuthState>(
          listenWhen: (previous, current) =>
              current is AuthAuthenticated || current is AuthFailureState,
          listener: (context, state) {
            if (state is AuthAuthenticated) {
              if (state.user.mustChangePassword) {
                AppToast.success('Create your password to finish setup.');
                context.go('/set-password');
              } else {
                AppToast.success('Signed in successfully');
                context.go('/');
              }
            } else if (state is AuthFailureState) {
              if (Validators.isInviteAlreadyUsedMessage(state.message)) {
                _showInviteAlreadyUsedDialog(state.message);
              } else {
                AppToast.error(state.message);
              }
            }
          },
          builder: (context, state) {
            final loading = state is AuthLoading;

            return KeyboardActions.done(
              child: AdaptiveCenteredBody(
                child: Form(
                  key: _formKey,
                  autovalidateMode: _autovalidateMode,
                  child: AutofillGroup(
                    child: StaggeredColumn(
                      children: [
                        const AuthBrandHeader(
                          title: 'Login',
                          subtitle:
                              'Use your email with your password, or your invite code the first time you sign in.',
                        ),
                        SizedBox(height: context.sectionGap),
                        Container(
                          padding: context.cardPadding,
                          decoration: BoxDecoration(
                            color: AppColors.bgCard.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.borderSubtle),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.accentPink.withValues(
                                  alpha: 0.06,
                                ),
                                blurRadius: 28,
                                offset: const Offset(0, 12),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              AuthTextField(
                                controller: _emailController,
                                label: 'Email',
                                prefixIcon: Icons.mail_outline_rounded,
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                enabled: !loading,
                                autofillHints: const [AutofillHints.email],
                                inputFormatters: [
                                  FilteringTextInputFormatter.deny(
                                    RegExp(r'\s'),
                                  ),
                                ],
                                validator: Validators.email,
                              ),
                              const SizedBox(height: 14),
                              AuthTextField(
                                controller: _passwordController,
                                label: 'Password or invite code',
                                prefixIcon: Icons.lock_outline_rounded,
                                obscureText: _obscurePassword,
                                enabled: !loading,
                                onToggleObscure: () {
                                  setState(
                                    () =>
                                        _obscurePassword = !_obscurePassword,
                                  );
                                },
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _submit(),
                                autofillHints: const [AutofillHints.password],
                                validator: Validators.loginPassword,
                              ),
                              SizedBox(
                                height: context.isShortViewport ? 18 : 24,
                              ),
                              AuthPrimaryButton(
                                label: 'Sign in',
                                loading: loading,
                                onPressed: _submit,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextButton(
                          onPressed: loading
                              ? null
                              : () => context.go('/forgot-password'),
                          child: Text.rich(
                            textAlign: TextAlign.center,
                            TextSpan(
                              style: AppTypography.caption,
                              children: [
                                TextSpan(
                                  text: 'Forgot password?',
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.accentPink,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
