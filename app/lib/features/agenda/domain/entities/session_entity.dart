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
    this.accessRestricted = false,
    this.materialsLocked = false,
    this.reviewsLocked = false,
    this.agendaLocked = false,
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
  final bool accessRestricted;
  final bool materialsLocked;
  final bool reviewsLocked;
  final bool agendaLocked;

  bool get isExtraActivity => kind == 'event';

  /// Subtitle for agenda search suggestions and list context.
  String get agendaListSubtitle {
    if (isExtraActivity) {
      final parts = <String>['Extra activity'];
      final loc = location.trim();
      if (loc.isNotEmpty) parts.add(loc);
      return parts.join(' · ');
    }
    return speaker?.name.trim() ?? '';
  }

  bool matchesAgendaSearch(String rawQuery) {
    final query = rawQuery.trim().toLowerCase();
    if (query.isEmpty) return true;

    final speakerName = speaker?.name.toLowerCase() ?? '';
    if (name.toLowerCase().contains(query)) return true;
    if (description.toLowerCase().contains(query)) return true;
    if (speakerName.contains(query)) return true;
    if (location.toLowerCase().contains(query)) return true;
    if (address.toLowerCase().contains(query)) return true;
    if (isExtraActivity &&
        ('extra activity'.contains(query) ||
            query.contains('extra') ||
            query.contains('activity'))) {
      return true;
    }
    return false;
  }
}
