import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/subpage_app_bar.dart';
import 'package:unleash_your_brave/features/home/data/datasources/app_branding_remote_datasource.dart';
import 'package:unleash_your_brave/features/home/domain/entities/app_branding_entity.dart';

class HelpSupportPage extends StatefulWidget {
  const HelpSupportPage({super.key});

  @override
  State<HelpSupportPage> createState() => _HelpSupportPageState();
}

class _HelpSupportPageState extends State<HelpSupportPage> {
  AppBrandingEntity? _branding;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final branding = await sl<AppBrandingRemoteDataSource>().get();
      if (!mounted) return;
      setState(() {
        _branding = branding;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _branding = const AppBrandingEntity(
          homeCoverImage: '',
          supportEmail: 'dedee@fittoprofit.com',
          supportPhone: '',
        );
        _loading = false;
      });
    }
  }

  Future<void> _openEmail(String email) async {
    final uri = Uri(scheme: 'mailto', path: email);
    if (!await launchUrl(uri)) {
      // ignore: use_build_context_synchronously
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Email: $email')),
        );
      }
    }
  }

  Future<void> _openPhone(String phone) async {
    final normalized = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri(scheme: 'tel', path: normalized);
    if (!await launchUrl(uri)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Phone: $phone')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final sidePad = context.pagePadding.left;
    final branding = _branding;
    final email = branding?.supportEmail.trim() ?? '';
    final phone = branding?.supportPhone.trim() ?? '';

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: buildSubpageAppBar(
        context,
        title: 'Help & Support',
        fallbackLocation: '/',
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accentPink),
            )
          : ListView(
              padding: EdgeInsets.fromLTRB(sidePad, 24, sidePad, 32),
              children: [
                Text(
                  'HELP & SUPPORT',
                  style: AppTypography.microLabel.copyWith(
                    color: AppColors.accentPink,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Any help you need, please contact us using the following details.',
                  style: AppTypography.body.copyWith(
                    height: 1.55,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 24),
                if (email.isNotEmpty)
                  _ContactTile(
                    icon: Icons.email_outlined,
                    label: 'Email',
                    value: email,
                    onTap: () => _openEmail(email),
                  ),
                if (phone.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _ContactTile(
                    icon: Icons.phone_outlined,
                    label: 'Phone',
                    value: phone,
                    onTap: () => _openPhone(phone),
                  ),
                ],
                if (email.isEmpty && phone.isEmpty)
                  Text(
                    'Support contact details will appear here once configured.',
                    style: AppTypography.caption,
                  ),
              ],
            ),
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bgCard,
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.accentPink),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: AppTypography.caption),
                    const SizedBox(height: 4),
                    Text(
                      value,
                      style: AppTypography.body.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
