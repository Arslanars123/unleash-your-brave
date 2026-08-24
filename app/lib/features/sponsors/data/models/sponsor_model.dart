import 'package:unleash_your_brave/features/sponsors/domain/entities/sponsor_entity.dart';

class SponsorModel extends SponsorEntity {
  const SponsorModel({
    required super.id,
    required super.eventId,
    required super.name,
    required super.description,
    required super.image,
    required super.offers,
  });

  factory SponsorModel.fromJson(Map<String, dynamic> json) {
    final offersJson = json['offers'];
    return SponsorModel(
      id: json['id'] as String,
      eventId: json['eventId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      image: json['image'] as String? ?? '',
      offers: offersJson is List
          ? offersJson
              .whereType<Map<String, dynamic>>()
              .map(SponsorOfferModel.fromJson)
              .toList(growable: false)
          : const [],
    );
  }
}

class SponsorOfferModel extends SponsorOfferEntity {
  const SponsorOfferModel({
    required super.id,
    required super.offerNumber,
    required super.description,
    required super.image,
    required super.links,
  });

  factory SponsorOfferModel.fromJson(Map<String, dynamic> json) {
    final linksJson = json['links'];
    return SponsorOfferModel(
      id: json['id'] as String? ?? '',
      offerNumber: (json['offerNumber'] as num?)?.toInt() ?? 0,
      description: json['description'] as String? ?? '',
      image: json['image'] as String? ?? '',
      links: linksJson is List
          ? linksJson
              .whereType<Map<String, dynamic>>()
              .map(SponsorOfferLinkModel.fromJson)
              .toList(growable: false)
          : const [],
    );
  }
}

class SponsorOfferLinkModel extends SponsorOfferLinkEntity {
  const SponsorOfferLinkModel({
    required super.id,
    required super.label,
    required super.url,
  });

  factory SponsorOfferLinkModel.fromJson(Map<String, dynamic> json) {
    return SponsorOfferLinkModel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      url: json['url'] as String? ?? '',
    );
  }
}
