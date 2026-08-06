import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/features/auth/domain/entities/user_entity.dart';
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
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Profile',
                          style: AppTypography.headline.copyWith(
                            fontSize: context.headlineSize,
                          ),
                        ),
                      ),
                      if (user != null)
                        TextButton(
                          onPressed: () => context.push('/profile/edit'),
                          child: const Text('Edit'),
                        ),
                    ],
                  ),
                ),
                SizedBox(height: context.sectionGap),
                if (user != null) ...[
                  _ProfileHeader(user: user),
                  SizedBox(height: context.sectionGap),
                  _ProfileDetails(user: user),
                  SizedBox(height: context.sectionGap),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.qr_code_2),
                    title: const Text('Check-in QR'),
                    subtitle: const Text('Show at the door for this event'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/check-in'),
                  ),
                  SizedBox(height: context.sectionGap),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.notifications_outlined),
                    title: const Text('Notifications'),
                    subtitle: const Text('Announcements and reminders'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/notifications'),
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

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.user});

  final UserEntity user;

  @override
  Widget build(BuildContext context) {
    final photo = resolveMediaUrl(user.photoUrl);

    return Container(
      width: double.infinity,
      padding: context.cardPadding,
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: AppColors.accentPink.withValues(alpha: 0.15),
            backgroundImage: photo.isNotEmpty ? NetworkImage(photo) : null,
            child: photo.isEmpty
                ? Text(
                    _initials(user.name),
                    style: AppTypography.body.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.accentPink,
                      fontSize: 18,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.name,
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 18,
                  ),
                ),
                if (user.title.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(user.title, style: AppTypography.caption),
                ],
                if (user.business.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(user.business, style: AppTypography.caption),
                ],
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
        ],
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class _ProfileDetails extends StatelessWidget {
  const _ProfileDetails({required this.user});

  final UserEntity user;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String)>[
      if (user.industry.isNotEmpty) ('Industry', user.industry),
      if (user.location.isNotEmpty) ('Location', user.location),
      if (user.bio.isNotEmpty) ('Bio', user.bio),
      if (user.goals.isNotEmpty) ('Goals', user.goals.join(', ')),
      if (user.interests.isNotEmpty) ('Interests', user.interests.join(', ')),
      ('Networking', _networkingLabel(user.networkingPrefs)),
      if (user.linkedinUrl.isNotEmpty) ('LinkedIn', user.linkedinUrl),
      if (user.instagramUrl.isNotEmpty) ('Instagram', user.instagramUrl),
      if (user.websiteUrl.isNotEmpty) ('Website', user.websiteUrl),
    ];

    if (rows.isEmpty) {
      return Text(
        'Add your photo, title, and bio so others can find you.',
        style: AppTypography.caption,
      );
    }

    return Container(
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
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 14),
            Text(
              rows[i].$1,
              style: AppTypography.microLabel.copyWith(
                color: AppColors.textTertiary,
              ),
            ),
            const SizedBox(height: 4),
            Text(rows[i].$2, style: AppTypography.body),
          ],
        ],
      ),
    );
  }

  String _networkingLabel(String value) {
    return switch (value) {
      'open_to_all' => 'Open to all',
      'industry_peers' => 'Industry peers',
      'investors' => 'Investors',
      'mentors' => 'Mentors',
      'closed' => 'Closed',
      _ => value,
    };
  }
}
