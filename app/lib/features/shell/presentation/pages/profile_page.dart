import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        final user = state is AuthAuthenticated ? state.user : null;

        return Scaffold(
          backgroundColor: AppColors.bgBase,
          body: AdaptiveScrollBody(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SafeArea(
                  bottom: false,
                  child: Text(
                    'Profile',
                    style: AppTypography.headline.copyWith(
                      fontSize: context.headlineSize,
                    ),
                  ),
                ),
                SizedBox(height: context.sectionGap),
                if (user != null) ...[
                  Container(
                    width: double.infinity,
                    padding: context.cardPadding,
                    decoration: BoxDecoration(
                      color: AppColors.bgCard,
                      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user.name, style: AppTypography.body.copyWith(
                          fontWeight: FontWeight.w600,
                          fontSize: 18,
                        )),
                        const SizedBox(height: 6),
                        Text(user.email, style: AppTypography.caption),
                        const SizedBox(height: 6),
                        Text(
                          user.role.toUpperCase(),
                          style: AppTypography.microLabel.copyWith(
                            color: AppColors.accentPink,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: context.sectionGap),
                ],
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      context.read<AuthBloc>().add(const AuthLogoutRequested());
                      context.go('/login');
                    },
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('Sign out'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
