/// Featured gathering shown on the member home screen.
abstract final class EventConstants {
  static const String brandLiveLabel = 'UNLEASH YOUR BRAVE LIVE';
  static const String headlineLead = 'The countdown to';
  static const String headlineEmphasis = 'your transformation';
  static const String dateLabel = 'September 10–12, 2026';
  static const String countdownTitle = 'DAYS UNTIL WE GATHER';

  /// Event start calendar day (local) — fallback when API date is unavailable.
  /// API dates are UTC midnights of the calendar day; see [eventCalendarDayLocal].
  static final DateTime startsAt = DateTime(2026, 9, 10);
}
