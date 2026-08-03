import 'package:unleash_your_brave/features/home/domain/entities/event_day_entity.dart';
import 'package:unleash_your_brave/features/home/domain/entities/event_entity.dart';

class EventModel extends EventEntity {
  const EventModel({
    required super.id,
    required super.name,
    required super.tagline,
    required super.startDate,
    required super.endDate,
    required super.status,
    required super.venueCity,
    super.venueName,
    super.venueAddress,
    super.latitude,
    super.longitude,
    super.days,
  });

  factory EventModel.fromJson(Map<String, dynamic> json) {
    final rawDays = json['days'] as List<dynamic>? ?? const [];
    final days = rawDays
        .whereType<Map<String, dynamic>>()
        .map(EventDayModel.fromJson)
        .toList(growable: false);

    return EventModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      tagline: json['tagline'] as String? ?? '',
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: DateTime.parse(json['endDate'] as String),
      status: json['status'] as String? ?? 'upcoming',
      venueCity: json['venueCity'] as String? ?? '',
      venueName: json['venueName'] as String? ?? '',
      venueAddress: json['venueAddress'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      days: days,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'tagline': tagline,
      'startDate': startDate.toIso8601String(),
      'endDate': endDate.toIso8601String(),
      'status': status,
      'venueCity': venueCity,
      'venueName': venueName,
      'venueAddress': venueAddress,
      'latitude': latitude,
      'longitude': longitude,
      'days': days
          .map(
            (day) => {
              'dayNumber': day.dayNumber,
              'date': day.date.toIso8601String(),
              'label': day.label,
            },
          )
          .toList(growable: false),
    };
  }
}

class EventDayModel extends EventDayEntity {
  const EventDayModel({
    required super.dayNumber,
    required super.date,
    required super.label,
  });

  factory EventDayModel.fromJson(Map<String, dynamic> json) {
    return EventDayModel(
      dayNumber: (json['dayNumber'] as num?)?.toInt() ?? 0,
      date: DateTime.parse(json['date'] as String),
      label: json['label'] as String? ?? '',
    );
  }
}
