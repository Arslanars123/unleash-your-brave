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
  String get shortDateLabel {
    final utc = date.toUtc();
    return '${_shortMonth(utc.month)} ${utc.day}';
  }

  /// Fuller date under content, e.g. "September 10, 2026".
  String get fullDateLabel {
    final utc = date.toUtc();
    return '${_monthName(utc.month)} ${utc.day}, ${utc.year}';
  }

  static String _shortMonth(int month) {
    const names = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return names[month - 1];
  }

  static String _monthName(int month) {
    const names = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return names[month - 1];
  }
}
