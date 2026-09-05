import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/features/home/presentation/widgets/quick_action_card.dart';

/// Always-visible home shortcuts to speakers and sponsors for the current event.
class HomeEventSections extends StatelessWidget {
  const HomeEventSections({super.key, required this.eventId});

  final String? eventId;

  @override
  Widget build(BuildContext context) {
    final id = eventId?.trim();
    if (id == null || id.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        Expanded(
          child: QuickActionCard(
            icon: Icons.record_voice_over_outlined,
            title: 'Speakers',
            subtitle: 'View the lineup',
            onTap: () {
              final q = id.isNotEmpty ? '/speakers?eventId=$id' : '/speakers';
              context.push(q);
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: QuickActionCard(
            icon: Icons.storefront_outlined,
            title: 'Sponsors',
            subtitle: 'Partner offers',
            onTap: () {
              final q = id.isNotEmpty ? '/sponsors?eventId=$id' : '/sponsors';
              context.push(q);
            },
          ),
        ),
      ],
    );
  }
}
