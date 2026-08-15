import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:keyboard_actions/keyboard_actions.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/utils/validators.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/features/auth/domain/repositories/auth_repository.dart';
import 'package:unleash_your_brave/features/auth/presentation/widgets/auth_form_fields.dart';

enum _ForgotPasswordStep { email, otp, password }

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  _ForgotPasswordStep _step = _ForgotPasswordStep.email;
  String _resetToken = '';
  bool _loading = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  AutovalidateMode _autovalidateMode = AutovalidateMode.disabled;

  AuthRepository get _auth => sl<AuthRepository>();

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submitEmail() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      setState(() => _autovalidateMode = AutovalidateMode.onUserInteraction);
      return;
    }

    setState(() => _loading = true);
    final result = await _auth.forgotPassword(
      email: _emailController.text.trim(),
    );
    if (!mounted) return;
    setState(() => _loading = false);

    result.fold(
      (failure) => AppToast.error(failure.message),
      (message) {
        AppToast.success(message);
        setState(() {
          _step = _ForgotPasswordStep.otp;
          _autovalidateMode = AutovalidateMode.disabled;
        });
      },
    );
  }

  Future<void> _submitOtp() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      setState(() => _autovalidateMode = AutovalidateMode.onUserInteraction);
      return;
    }

    setState(() => _loading = true);
    final result = await _auth.verifyResetOtp(
      email: _emailController.text.trim(),
      otp: _otpController.text.trim(),
    );
    if (!mounted) return;
    setState(() => _loading = false);

    result.fold(
      (failure) => AppToast.error(failure.message),
      (token) {
        setState(() {
          _resetToken = token;
          _step = _ForgotPasswordStep.password;
          _autovalidateMode = AutovalidateMode.disabled;
        });
      },
    );
  }

  Future<void> _submitPassword() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      setState(() => _autovalidateMode = AutovalidateMode.onUserInteraction);
      return;
    }

    setState(() => _loading = true);
    final result = await _auth.resetPassword(
      resetToken: _resetToken,
      newPassword: _passwordController.text,
    );
    if (!mounted) return;
    setState(() => _loading = false);

    result.fold(
      (failure) => AppToast.error(failure.message),
      (_) {
        AppToast.success('Password updated — sign in with your new password');
        context.go('/login');
      },
    );
  }

  void _submit() {
    switch (_step) {
      case _ForgotPasswordStep.email:
        _submitEmail();
      case _ForgotPasswordStep.otp:
        _submitOtp();
      case _ForgotPasswordStep.password:
        _submitPassword();
    }
  }

  String get _title {
    switch (_step) {
      case _ForgotPasswordStep.email:
        return 'Reset password';
      case _ForgotPasswordStep.otp:
        return 'Verify code';
      case _ForgotPasswordStep.password:
        return 'New password';
    }
  }

  String get _subtitle {
    switch (_step) {
      case _ForgotPasswordStep.email:
        return 'Enter your email and we will send a 6-digit verification code.';
      case _ForgotPasswordStep.otp:
        return 'Enter the code from your email to continue.';
      case _ForgotPasswordStep.password:
        return 'Choose a new password for your account.';
    }
  }

  String get _buttonLabel {
    switch (_step) {
      case _ForgotPasswordStep.email:
        return 'Send code';
      case _ForgotPasswordStep.otp:
        return 'Verify code';
      case _ForgotPasswordStep.password:
        return 'Reset password';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: KeyboardActions.done(
        child: AdaptiveCenteredBody(
          child: Form(
          key: _formKey,
          autovalidateMode: _autovalidateMode,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AuthBrandHeader(
                title: _title,
                subtitle: _subtitle,
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
                    if (_step == _ForgotPasswordStep.email)
                      AuthTextField(
                        controller: _emailController,
                        label: 'Email',
                        prefixIcon: Icons.mail_outline_rounded,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.done,
                        enabled: !_loading,
                        onFieldSubmitted: (_) => _submit(),
                        validator: Validators.email,
                      ),
                    if (_step == _ForgotPasswordStep.otp) ...[
                      AuthTextField(
                        controller: _otpController,
                        label: 'Verification code',
                        prefixIcon: Icons.pin_outlined,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        enabled: !_loading,
                        onFieldSubmitted: (_) => _submit(),
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(6),
                        ],
                        validator: (value) {
                          if (value == null || !RegExp(r'^\d{6}$').hasMatch(value)) {
                            return 'Enter the 6-digit code';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: _loading
                            ? null
                            : () => setState(() => _step = _ForgotPasswordStep.email),
                        child: Text(
                          'Use a different email',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.accentPink,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                    if (_step == _ForgotPasswordStep.password) ...[
                      AuthTextField(
                        controller: _passwordController,
                        label: 'New password',
                        prefixIcon: Icons.lock_outline_rounded,
                        obscureText: _obscurePassword,
                        enabled: !_loading,
                        onToggleObscure: () {
                          setState(() => _obscurePassword = !_obscurePassword);
                        },
                        textInputAction: TextInputAction.next,
                        validator: Validators.signupPassword,
                      ),
                      const SizedBox(height: 14),
                      AuthTextField(
                        controller: _confirmController,
                        label: 'Confirm password',
                        prefixIcon: Icons.lock_outline_rounded,
                        obscureText: _obscureConfirm,
                        enabled: !_loading,
                        onToggleObscure: () {
                          setState(() => _obscureConfirm = !_obscureConfirm);
                        },
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        validator: (value) => Validators.confirmPassword(
                          value,
                          _passwordController.text,
                        ),
                      ),
                    ],
                    SizedBox(height: context.isShortViewport ? 18 : 24),
                    AuthPrimaryButton(
                      label: _buttonLabel,
                      loading: _loading,
                      onPressed: _submit,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: _loading ? null : () => context.go('/login'),
                child: Text(
                  'Back to sign in',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.accentPink,
                    fontWeight: FontWeight.w600,
                  ),
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
