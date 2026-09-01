import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/features/memberships/domain/entities/membership_entity.dart';

/// Admin badge + purchase deadline for a membership tier on an event.
class MembershipSaleMeta extends StatelessWidget {
  const MembershipSaleMeta({
    super.key,
    required this.membership,
    this.compact = false,
  });

  final MembershipEntity membership;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final badge = membership.hasBadgeLabel ? membership.badgeLabel!.trim() : null;
    final deadline = membership.saleDeadlineLabel;
    if (badge == null && deadline == null) return const SizedBox.shrink();

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (badge != null) ...[
            MembershipBadgeChip(label: badge),
            if (deadline != null) const SizedBox(height: 4),
          ],
          if (deadline != null)
            Text(
              deadline,
              style: AppTypography.caption.copyWith(
                color: AppColors.textTertiary,
              ),
            ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (badge != null) ...[
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [MembershipBadgeChip(label: badge)],
          ),
          const SizedBox(height: 8),
        ],
        if (deadline != null)
          Text(
            deadline,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
      ],
    );
  }
}

class MembershipPurchaseListTile extends StatelessWidget {
  const MembershipPurchaseListTile({
    super.key,
    required this.membership,
    required this.onTap,
  });

  final MembershipEntity membership;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final deadline = membership.saleDeadlineLabel;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Row(
        children: [
          Expanded(
            child: Text(
              membership.name,
              style: AppTypography.body.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          if (membership.hasBadgeLabel) ...[
            const SizedBox(width: 8),
            MembershipBadgeChip(label: membership.badgeLabel!.trim()),
          ],
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(membership.priceLabel),
          if (deadline != null) ...[
            const SizedBox(height: 4),
            Text(
              deadline,
              style: AppTypography.caption.copyWith(
                color: AppColors.textTertiary,
              ),
            ),
          ],
        ],
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}

class MembershipBadgeChip extends StatelessWidget {
  const MembershipBadgeChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.accentPink.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.accentPink.withValues(alpha: 0.28)),
      ),
      child: Text(
        label.toUpperCase(),
        style: AppTypography.microLabel.copyWith(
          color: AppColors.accentPink,
          letterSpacing: 1.1,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
