import 'package:unleash_your_brave/features/speakers/domain/entities/speaker_entity.dart';

class SpeakerModel extends SpeakerEntity {
  const SpeakerModel({
    required super.id,
    required super.eventId,
    required super.name,
    required super.title,
    required super.description,
    required super.photo,
  });

  factory SpeakerModel.fromJson(Map<String, dynamic> json) {
    return SpeakerModel(
      id: json['id'] as String? ?? '',
      eventId: json['eventId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      photo: json['photo'] as String? ?? '',
    );
  }
}
