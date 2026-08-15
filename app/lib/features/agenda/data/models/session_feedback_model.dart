import 'package:unleash_your_brave/features/agenda/domain/entities/session_feedback_entity.dart';

class SessionFeedbackModel extends SessionFeedbackEntity {
  const SessionFeedbackModel({
    required super.id,
    required super.sessionId,
    required super.rating,
    super.comment,
    super.userId,
    super.userName,
    super.createdAt,
  });

  factory SessionFeedbackModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    final userMap = user is Map<String, dynamic> ? user : null;
    final createdRaw = json['createdAt'];
    DateTime? createdAt;
    if (createdRaw is String && createdRaw.isNotEmpty) {
      createdAt = DateTime.tryParse(createdRaw)?.toLocal();
    }

    return SessionFeedbackModel(
      id: json['id'] as String? ?? '',
      sessionId: json['sessionId'] as String? ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      comment: json['comment'] as String? ?? '',
      userId: json['userId'] as String? ?? userMap?['id'] as String? ?? '',
      userName: userMap?['name'] as String? ?? '',
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sessionId': sessionId,
      'rating': rating,
      'comment': comment,
      'userId': userId,
      'user': userName.isEmpty
          ? null
          : {
              'id': userId,
              'name': userName,
            },
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    };
  }
}
