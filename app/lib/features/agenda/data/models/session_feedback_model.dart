import 'package:unleash_your_brave/features/agenda/domain/entities/session_feedback_entity.dart';

class SessionFeedbackModel extends SessionFeedbackEntity {
  const SessionFeedbackModel({
    required super.id,
    required super.sessionId,
    required super.rating,
    super.comment,
  });

  factory SessionFeedbackModel.fromJson(Map<String, dynamic> json) {
    return SessionFeedbackModel(
      id: json['id'] as String? ?? '',
      sessionId: json['sessionId'] as String? ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      comment: json['comment'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sessionId': sessionId,
      'rating': rating,
      'comment': comment,
    };
  }
}
