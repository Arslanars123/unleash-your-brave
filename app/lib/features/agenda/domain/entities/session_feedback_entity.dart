class SessionFeedbackEntity {
  const SessionFeedbackEntity({
    required this.id,
    required this.sessionId,
    required this.rating,
    this.comment = '',
  });

  final String id;
  final String sessionId;
  final int rating;
  final String comment;
}
