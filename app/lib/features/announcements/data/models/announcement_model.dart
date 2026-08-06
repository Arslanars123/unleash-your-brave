import 'package:unleash_your_brave/features/announcements/domain/entities/announcement_entity.dart';

class AnnouncementModel {
  const AnnouncementModel({
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

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic value) {
      if (value is! String || value.isEmpty) return null;
      return DateTime.tryParse(value)?.toLocal();
    }

    return AnnouncementModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      kind: json['kind'] as String? ?? 'manual',
      status: json['status'] as String? ?? 'published',
      publishedAt: parseDate(json['publishedAt']),
      createdAt: parseDate(json['createdAt']) ?? DateTime.now(),
      isRead: json['isRead'] as bool? ?? false,
    );
  }

  AnnouncementEntity toEntity() {
    return AnnouncementEntity(
      id: id,
      title: title,
      description: description,
      kind: kind,
      status: status,
      publishedAt: publishedAt,
      createdAt: createdAt,
      isRead: isRead,
    );
  }
}
