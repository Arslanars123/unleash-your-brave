class SponsorOfferLinkEntity {
  const SponsorOfferLinkEntity({
    required this.id,
    required this.label,
    required this.url,
  });

  final String id;
  final String label;
  final String url;

  String get displayLabel {
    final text = label.trim();
    return text.isNotEmpty ? text : 'Open link';
  }
}

class SponsorOfferEntity {
  const SponsorOfferEntity({
    required this.id,
    required this.offerNumber,
    required this.description,
    required this.image,
    required this.links,
  });

  final String id;
  final int offerNumber;
  final String description;
  final String image;
  final List<SponsorOfferLinkEntity> links;
}

class SponsorEntity {
  const SponsorEntity({
    required this.id,
    required this.eventId,
    required this.name,
    required this.description,
    required this.image,
    required this.offers,
  });

  final String id;
  final String eventId;
  final String name;
  final String description;
  final String image;
  final List<SponsorOfferEntity> offers;

  bool matchesSearch(String rawQuery) {
    final query = rawQuery.trim().toLowerCase();
    if (query.isEmpty) return true;
    if (name.toLowerCase().contains(query)) return true;
    if (description.toLowerCase().contains(query)) return true;
    for (final offer in offers) {
      if (offer.description.toLowerCase().contains(query)) return true;
    }
    return false;
  }
}
