import 'package:unleash_your_brave/features/agenda/domain/entities/session_entity.dart';

class SessionModel extends SessionEntity {
  const SessionModel({
    required super.id,
    required super.eventId,
    super.kind,
    required super.name,
    required super.description,
    required super.eventDayNumber,
    super.startTime,
    super.endTime,
    super.location,
    super.address,
    super.speaker,
    super.materials,
    super.feedbackEnabled,
    super.feedbackSummary,
    super.accessRestricted,
  });

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    final speakerJson = json['speaker'];
    final materialsJson = json['materials'];
    final feedbackJson = json['feedbackSummary'];

    return SessionModel(
      id: json['id'] as String,
      eventId: json['eventId'] as String? ?? '',
      kind: json['kind'] as String? ?? 'session',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      eventDayNumber: (json['eventDayNumber'] as num?)?.toInt() ?? 0,
      startTime: json['startTime'] as String? ?? '',
      endTime: json['endTime'] as String? ?? '',
      location: json['location'] as String? ?? '',
      address: json['address'] as String? ?? '',
      speaker: speakerJson is Map<String, dynamic>
          ? SessionSpeakerModel.fromJson(speakerJson)
          : null,
      materials: materialsJson is List
          ? materialsJson
              .whereType<Map<String, dynamic>>()
              .map(SessionMaterialModel.fromJson)
              .toList(growable: false)
          : const [],
      feedbackEnabled: json['feedbackEnabled'] as bool? ?? true,
      feedbackSummary: feedbackJson is Map<String, dynamic>
          ? SessionFeedbackSummaryModel.fromJson(feedbackJson)
          : null,
      accessRestricted: json['accessRestricted'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'eventId': eventId,
      'kind': kind,
      'name': name,
      'description': description,
      'eventDayNumber': eventDayNumber,
      'startTime': startTime,
      'endTime': endTime,
      'location': location,
      'address': address,
      'speaker': speaker == null
          ? null
          : {
              'id': speaker!.id,
              'name': speaker!.name,
              'title': speaker!.title,
              'photo': speaker!.photo,
            },
      'materials': materials
          .map(
            (m) => {
              'id': m.id,
              'type': m.type,
              'title': m.title,
              'url': m.url,
            },
          )
          .toList(growable: false),
      'feedbackEnabled': feedbackEnabled,
      'feedbackSummary': feedbackSummary == null
          ? null
          : {
              'averageRating': feedbackSummary!.averageRating,
              'ratingsCount': feedbackSummary!.ratingsCount,
            },
      'accessRestricted': accessRestricted,
    };
  }
}

class SessionSpeakerModel extends SessionSpeakerEntity {
  const SessionSpeakerModel({
    required super.id,
    required super.name,
    required super.title,
    required super.photo,
  });

  factory SessionSpeakerModel.fromJson(Map<String, dynamic> json) {
    return SessionSpeakerModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      title: json['title'] as String? ?? '',
      photo: json['photo'] as String? ?? '',
    );
  }
}

class SessionMaterialModel extends SessionMaterialEntity {
  const SessionMaterialModel({
    required super.id,
    required super.type,
    required super.title,
    required super.url,
  });

  factory SessionMaterialModel.fromJson(Map<String, dynamic> json) {
    return SessionMaterialModel(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? 'link',
      title: json['title'] as String? ?? '',
      url: json['url'] as String? ?? '',
    );
  }
}

class SessionFeedbackSummaryModel extends SessionFeedbackSummaryEntity {
  const SessionFeedbackSummaryModel({
    required super.averageRating,
    required super.ratingsCount,
  });

  factory SessionFeedbackSummaryModel.fromJson(Map<String, dynamic> json) {
    return SessionFeedbackSummaryModel(
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      ratingsCount: (json['ratingsCount'] as num?)?.toInt() ?? 0,
    );
  }
}
