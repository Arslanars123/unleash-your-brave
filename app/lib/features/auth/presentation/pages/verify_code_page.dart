import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/utils/validators.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/auth/presentation/widgets/auth_form_fields.dart';

/// First-time attendee flow: email + verification code from purchase email.
class VerifyCodePage extends StatefulWidget {
  const VerifyCodePage({super.key});

  @override
  State<VerifyCodePage> createState() => _VerifyCodePageState();
}

class _VerifyCodePageState extends State<VerifyCodePage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  AutovalidateMode _autovalidateMode = AutovalidateMode.disabled;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
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
            password: _codeController.text.trim(),
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: BlocConsumer<AuthBloc, AuthState>(
        listenWhen: (previous, current) =>
            current is AuthAuthenticated || current is AuthFailureState,
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            if (state.user.mustChangePassword) {
              AppToast.success('Code verified. Create your password.');
              context.go('/set-password');
            } else {
              AppToast.success('Signed in successfully');
              context.go('/');
            }
          } else if (state is AuthFailureState) {
            AppToast.error(state.message);
          }
        },
        builder: (context, state) {
          final loading = state is AuthLoading;

          return AdaptiveCenteredBody(
            child: Form(
              key: _formKey,
              autovalidateMode: _autovalidateMode,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const AuthBrandHeader(
                    title: 'Verify your',
                    emphasis: 'email',
                    subtitle:
                        'Enter the verification code we sent after your purchase. Then you will create a password.',
                  ),
                  SizedBox(height: context.sectionGap),
                  Container(
                    padding: context.cardPadding,
                    decoration: BoxDecoration(
                      color: AppColors.bgCard,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: Column(
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
                            FilteringTextInputFormatter.deny(RegExp(r'\s')),
                          ],
                          validator: Validators.email,
                        ),
                        const SizedBox(height: 14),
                        AuthTextField(
                          controller: _codeController,
                          label: 'Verification code',
                          prefixIcon: Icons.pin_outlined,
                          textInputAction: TextInputAction.done,
                          enabled: !loading,
                          onFieldSubmitted: (_) => _submit(),
                          inputFormatters: [
                            FilteringTextInputFormatter.deny(RegExp(r'\s')),
                          ],
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Enter the code from your email';
                            }
                            if (value.trim().length < 4) {
                              return 'Code looks too short';
                            }
                            return null;
                          },
                        ),
                        SizedBox(height: context.isShortViewport ? 18 : 24),
                        AuthPrimaryButton(
                          label: 'Verify code',
                          loading: loading,
                          onPressed: _submit,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: loading ? null : () => context.go('/login'),
                    child: Text(
                      'Already set a password? Sign in',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.accentPink,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
