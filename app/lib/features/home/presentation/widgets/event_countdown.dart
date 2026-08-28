import 'dart:async';

import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/constants/event_constants.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

class EventCountdown extends StatefulWidget {
  const EventCountdown({
    super.key,
    this.target,
    this.status,
    this.title,
  });

  final DateTime? target;
  final String? status;
  final String? title;

  @override
  State<EventCountdown> createState() => _EventCountdownState();
}

class _EventCountdownState extends State<EventCountdown> {
  late Duration _remaining;
  Timer? _timer;

  DateTime get _target => widget.target ?? EventConstants.startsAt;

  @override
  void initState() {
    super.initState();
    _remaining = _compute();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _remaining = _compute());
    });
  }

  @override
  void didUpdateWidget(covariant EventCountdown oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.target != widget.target || oldWidget.status != widget.status) {
      _remaining = _compute();
    }
  }

  Duration _compute() {
    if (widget.status == 'live' ||
        widget.status == 'ended' ||
        widget.status == 'paused') {
      return Duration.zero;
    }
    final diff = _target.difference(DateTime.now());
    return diff.isNegative ? Duration.zero : diff;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.status;
    final title = widget.title ??
        (status == 'live'
            ? 'EVENT IS LIVE'
            : status == 'ended'
                ? 'EVENT HAS ENDED'
                : status == 'paused'
                    ? 'EVENT PAUSED'
                    : EventConstants.countdownTitle);

    if (status == 'live' || status == 'ended' || status == 'paused') {
      return Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(
          horizontal: context.responsive(compact: 16.0, medium: 20.0),
          vertical: context.responsive(compact: 18.0, medium: 22.0),
        ),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Text(
          title,
          textAlign: TextAlign.center,
          style: AppTypography.microLabel.copyWith(
            color: AppColors.textSecondary,
            letterSpacing: 1.8,
          ),
        ),
      );
    }

    final days = _remaining.inDays;
    final hours = _remaining.inHours.remainder(24);
    final minutes = _remaining.inMinutes.remainder(60);
    final seconds = _remaining.inSeconds.remainder(60);
    final numeralSize = context.responsive(compact: 34.0, medium: 40.0);

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: context.responsive(compact: 16.0, medium: 20.0),
        vertical: context.responsive(compact: 18.0, medium: 22.0),
      ),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: AppTypography.microLabel.copyWith(
              color: AppColors.textSecondary,
              letterSpacing: 1.8,
            ),
          ),
          SizedBox(height: context.responsive(compact: 14.0, medium: 16.0)),
          Row(
            children: [
              Expanded(
                child: _CountdownUnit(
                  value: days,
                  label: 'DAYS',
                  numeralSize: numeralSize,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _CountdownUnit(
                  value: hours,
                  label: 'HRS',
                  numeralSize: numeralSize,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _CountdownUnit(
                  value: minutes,
                  label: 'MIN',
                  numeralSize: numeralSize,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _CountdownUnit(
                  value: seconds,
                  label: 'SEC',
                  numeralSize: numeralSize,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CountdownUnit extends StatelessWidget {
  const _CountdownUnit({
    required this.value,
    required this.label,
    required this.numeralSize,
  });

  final int value;
  final String label;
  final double numeralSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
      decoration: BoxDecoration(
        color: AppColors.bgMaroon,
        borderRadius: BorderRadius.circular(AppTheme.radiusStat),
        border: Border.all(color: const Color(0x33E91E63)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22E91E63),
            blurRadius: 12,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            value.toString().padLeft(2, '0'),
            style: AppTypography.numeral.copyWith(fontSize: numeralSize),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: AppTypography.microLabel.copyWith(
              fontSize: 10,
              letterSpacing: 1.4,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
