import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_day_entity.dart';

class AgendaDayTabs extends StatelessWidget {
  const AgendaDayTabs({
    super.key,
    required this.days,
    required this.selectedDayNumber,
    required this.onDaySelected,
  });

  final List<EventDayEntity> days;
  final int selectedDayNumber;
  final ValueChanged<int> onDaySelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: days.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final day = days[index];
          final selected = day.dayNumber == selectedDayNumber;
          return _DayTab(
            day: day,
            selected: selected,
            onTap: () => onDaySelected(day.dayNumber),
          );
        },
      ),
    );
  }
}

class _DayTab extends StatelessWidget {
  const _DayTab({
    required this.day,
    required this.selected,
    required this.onTap,
  });

  final EventDayEntity day;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.bgMaroon : AppColors.bgCard,
            borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
            border: Border.all(
              color: selected
                  ? AppColors.accentPink.withValues(alpha: 0.55)
                  : AppColors.borderSubtle,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                day.tabTitle,
                style: AppTypography.microLabel.copyWith(
                  color: selected
                      ? AppColors.accentPink
                      : AppColors.textSecondary,
                  letterSpacing: 1.2,
                  fontSize: 11,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                day.shortDateLabel,
                style: AppTypography.body.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: selected
                      ? AppColors.textPrimary
                      : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
