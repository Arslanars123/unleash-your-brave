import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';

class EventBookingEntity {
  const EventBookingEntity({
    required this.event,
    required this.entitled,
    required this.qrEntitled,
    this.effectiveMembershipName,
    required this.checkedIn,
    this.checkedInAt,
    required this.carriedFromPrevious,
  });

  final EventEntity event;
  final bool entitled;
  final bool qrEntitled;
  final String? effectiveMembershipName;
  final bool checkedIn;
  final DateTime? checkedInAt;
  final bool carriedFromPrevious;
}
