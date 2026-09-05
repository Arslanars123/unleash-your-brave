class SpeakerEntity {
  const SpeakerEntity({
    required this.id,
    required this.eventId,
    required this.name,
    required this.title,
    required this.description,
    required this.photo,
  });

  final String id;
  final String eventId;
  final String name;
  final String title;
  final String description;
  final String photo;

  bool matchesSearch(String rawQuery) {
    final query = rawQuery.trim().toLowerCase();
    if (query.isEmpty) return true;
    return name.toLowerCase().contains(query) ||
        title.toLowerCase().contains(query) ||
        description.toLowerCase().contains(query);
  }
}
