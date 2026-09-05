class LegalDocumentEntity {
  const LegalDocumentEntity({
    required this.title,
    required this.updated,
    required this.bodyHtml,
    this.subtitleHtml,
    this.eyebrow,
  });

  final String title;
  final String? subtitleHtml;
  final String updated;
  final String bodyHtml;
  final String? eyebrow;

  bool get hasContent =>
      bodyHtml.trim().isNotEmpty || title.trim().isNotEmpty;
}
