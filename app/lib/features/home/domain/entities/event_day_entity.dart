import 'package:unleash_your_brave/core/utils/datetime_format.dart';

class EventDayEntity {
  const EventDayEntity({
    required this.dayNumber,
    required this.date,
    required this.label,
  });

  final int dayNumber;
  final DateTime date;
  final String label;

  String get tabTitle => 'Day $dayNumber';

  /// Short calendar date for the tab (UTC), e.g. "Sep 10".
  String get shortDateLabel => formatUsShortDate(date, utc: true);

  /// Fuller date under content, e.g. "Sep 10, 2026".
  String get fullDateLabel => formatUsDate(date, utc: true);
}
