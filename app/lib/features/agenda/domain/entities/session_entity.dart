class SessionSpeakerEntity {
  const SessionSpeakerEntity({
    required this.id,
    required this.name,
    required this.title,
    required this.photo,
  });

  final String id;
  final String name;
  final String title;
  final String photo;
}

class SessionMaterialEntity {
  const SessionMaterialEntity({
    required this.id,
    required this.type,
    required this.title,
    required this.url,
  });

  final String id;

  /// One of: `pdf`, `video`, `doc`, `link`.
  final String type;
  final String title;
  final String url;
}

class SessionFeedbackSummaryEntity {
  const SessionFeedbackSummaryEntity({
    required this.averageRating,
    required this.ratingsCount,
  });

  final double averageRating;
  final int ratingsCount;
}

class SessionEntity {
  const SessionEntity({
    required this.id,
    required this.eventId,
    this.kind = 'session',
    required this.name,
    required this.description,
    required this.eventDayNumber,
    this.startTime = '',
    this.endTime = '',
    this.location = '',
    this.address = '',
    this.speaker,
    this.materials = const [],
    this.feedbackEnabled = true,
    this.feedbackSummary,
  });

  final String id;
  final String eventId;

  /// `session` = speaker talk; `event` = extra activity (VIP dinner, etc.).
  final String kind;
  final String name;
  final String description;
  final int eventDayNumber;

  /// Wall-clock start on the event day, `HH:mm` (24h). Empty if unset.
  final String startTime;

  /// Wall-clock end on the event day, `HH:mm` (24h). Empty if unset.
  final String endTime;
  final String location;
  final String address;
  final SessionSpeakerEntity? speaker;
  final List<SessionMaterialEntity> materials;
  final bool feedbackEnabled;
  final SessionFeedbackSummaryEntity? feedbackSummary;

  bool get isExtraActivity => kind == 'event';
}
