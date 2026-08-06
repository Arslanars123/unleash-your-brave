class AnnouncementEntity {
  const AnnouncementEntity({
    required this.id,
    required this.title,
    required this.description,
    required this.kind,
    required this.status,
    required this.publishedAt,
    required this.createdAt,
    required this.isRead,
  });

  final String id;
  final String title;
  final String description;
  final String kind;
  final String status;
  final DateTime? publishedAt;
  final DateTime createdAt;
  final bool isRead;

  bool get isSystem => kind == 'system';

  AnnouncementEntity copyWith({bool? isRead}) {
    return AnnouncementEntity(
      id: id,
      title: title,
      description: description,
      kind: kind,
      status: status,
      publishedAt: publishedAt,
      createdAt: createdAt,
      isRead: isRead ?? this.isRead,
    );
  }
}

class AnnouncementFeedResult {
  const AnnouncementFeedResult({
    required this.items,
    required this.unreadCount,
    required this.total,
  });

  final List<AnnouncementEntity> items;
  final int unreadCount;
  final int total;
}
