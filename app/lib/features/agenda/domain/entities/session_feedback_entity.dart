class SessionFeedbackEntity {
  const SessionFeedbackEntity({
    required this.id,
    required this.sessionId,
    required this.rating,
    this.comment = '',
    this.userId = '',
    this.userName = '',
    this.createdAt,
  });

  final String id;
  final String sessionId;
  final int rating;
  final String comment;
  final String userId;
  final String userName;
  final DateTime? createdAt;
}
