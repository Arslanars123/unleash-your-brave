import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/subpage_app_bar.dart';
import 'package:unleash_your_brave/features/legal/domain/legal_copy.dart';

class LegalDocumentPage extends StatelessWidget {
  const LegalDocumentPage({
    super.key,
    required this.title,
    required this.lastUpdated,
    required this.sections,
  });

  final String title;
  final String lastUpdated;
  final List<LegalSection> sections;

  factory LegalDocumentPage.privacy({Key? key}) {
    return LegalDocumentPage(
      key: key,
      title: LegalCopy.privacyTitle,
      lastUpdated: LegalCopy.privacyLastUpdated,
      sections: LegalCopy.privacySections,
    );
  }

  factory LegalDocumentPage.terms({Key? key}) {
    return LegalDocumentPage(
      key: key,
      title: LegalCopy.termsTitle,
      lastUpdated: LegalCopy.termsLastUpdated,
      sections: LegalCopy.termsSections,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: buildSubpageAppBar(
        context,
        title: title,
        fallbackLocation: '/profile',
      ),
      body: AdaptiveScrollBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Last updated $lastUpdated',
              style: AppTypography.caption.copyWith(
                color: AppColors.textTertiary,
              ),
            ),
            const SizedBox(height: 20),
            for (var i = 0; i < sections.length; i++) ...[
              if (i > 0) const SizedBox(height: 22),
              Text(
                sections[i].heading,
                style: AppTypography.body.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 17,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                sections[i].body,
                style: AppTypography.body.copyWith(
                  height: 1.55,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: 28),
          ],
        ),
      ),
    );
  }
}
