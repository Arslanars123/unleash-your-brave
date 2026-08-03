import 'package:unleash_your_brave/features/home/domain/entities/event_day_entity.dart';

class EventEntity {
  const EventEntity({
    required this.id,
    required this.name,
    required this.tagline,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.venueCity,
    this.venueName = '',
    this.venueAddress = '',
    this.latitude,
    this.longitude,
    this.days = const [],
  });

  final String id;
  final String name;
  final String tagline;
  final DateTime startDate;
  final DateTime endDate;
  final String status;
  final String venueCity;
  final String venueName;
  final String venueAddress;
  final double? latitude;
  final double? longitude;
  final List<EventDayEntity> days;

  bool get isUpcoming => status == 'upcoming';
  bool get isLive => status == 'live';
  bool get isEnded => status == 'ended';

  bool get hasMapPin => latitude != null && longitude != null;

  String get venueLabel {
    final parts = [venueName, venueCity].where((p) => p.trim().isNotEmpty);
    return parts.join(' · ');
  }

  String get dateRangeLabel {
    final start = startDate.toUtc();
    final end = endDate.toUtc();
    final startLabel = _formatDay(start);
    final endLabel = _formatDay(end);
    if (start.year == end.year && start.month == end.month && start.day == end.day) {
      return startLabel;
    }
    if (start.year == end.year && start.month == end.month) {
      return '${_monthName(start.month)} ${start.day}–${end.day}, ${start.year}';
    }
    return '$startLabel – $endLabel';
  }

  static String _formatDay(DateTime date) {
    return '${_monthName(date.month)} ${date.day}, ${date.year}';
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
