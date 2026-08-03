import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _destinations = [
    _NavDestination(
      label: 'Home',
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_outlined,
    ),
    _NavDestination(
      label: 'Agenda',
      icon: Icons.calendar_today_outlined,
      selectedIcon: Icons.calendar_today_outlined,
    ),
    _NavDestination(
      label: 'Network',
      icon: Icons.groups_outlined,
      selectedIcon: Icons.groups_outlined,
    ),
    _NavDestination(
      label: 'Map',
      icon: Icons.map_outlined,
      selectedIcon: Icons.map_outlined,
    ),
    _NavDestination(
      label: 'Profile',
      icon: Icons.person_outline,
      selectedIcon: Icons.person_outline,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final index = navigationShell.currentIndex;

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: navigationShell,
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          color: AppColors.bgBase,
          border: Border(
            top: BorderSide(color: AppColors.borderSubtle, width: 1),
          ),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                for (var i = 0; i < _destinations.length; i++)
                  Expanded(
                    child: _NavItem(
                      destination: _destinations[i],
                      selected: index == i,
                      onTap: () => _onTap(context, i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _onTap(BuildContext context, int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }
}

class _NavDestination {
  const _NavDestination({
    required this.label,
    required this.icon,
    required this.selectedIcon,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final _NavDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.accentPink : AppColors.textTertiary;

    return InkWell(
      onTap: onTap,
      splashColor: AppColors.accentPink.withValues(alpha: 0.08),
      highlightColor: Colors.transparent,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            selected ? destination.selectedIcon : destination.icon,
            size: 22,
            color: color,
          ),
          const SizedBox(height: 4),
          Text(
            destination.label,
            style: AppTypography.microLabel.copyWith(
              color: color,
              fontSize: 10,
              letterSpacing: 0.4,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
