import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/agenda/data/models/session_feedback_model.dart';
import 'package:unleash_your_brave/features/agenda/data/models/session_model.dart';

class SessionsRemoteDataSource {
  SessionsRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<List<SessionModel>> list({
    required String eventId,
    int? eventDayNumber,
    String? search,
    int perPage = 100,
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.sessions,
        queryParameters: {
          'eventId': eventId,
          'perPage': perPage,
          if (eventDayNumber != null) 'eventDayNumber': eventDayNumber,
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        },
      );
      final data = (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ??
          const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(SessionModel.fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<SessionModel> getById(String id) async {
    try {
      final response = await _dioClient.client.get('${ApiConstants.sessions}/$id');
      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return SessionModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<List<SessionFeedbackModel>> listFeedback(
    String sessionId, {
    int page = 1,
    int perPage = 50,
  }) async {
    try {
      final response = await _dioClient.client.get(
        '${ApiConstants.sessions}/$sessionId/feedback',
        queryParameters: {
          'page': page,
          'perPage': perPage,
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ??
              const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(SessionFeedbackModel.fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  /// Returns the current user's review, or `null` when they have not reviewed yet.
  Future<SessionFeedbackModel?> getMyFeedback(String sessionId) async {
    try {
      final response = await _dioClient.client.get(
        '${ApiConstants.sessions}/$sessionId/feedback/me',
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>?;
      if (data == null) return null;
      return SessionFeedbackModel.fromJson(data);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      throwMappedDioError(error);
    }
  }

  Future<SessionFeedbackModel> upsertFeedback({
    required String sessionId,
    required int rating,
    String comment = '',
  }) async {
    try {
      final response = await _dioClient.client.post(
        '${ApiConstants.sessions}/$sessionId/feedback',
        data: {
          'rating': rating,
          'comment': comment.trim(),
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return SessionFeedbackModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<void> deleteMyFeedback(String sessionId) async {
    try {
      await _dioClient.client.delete(
        '${ApiConstants.sessions}/$sessionId/feedback/me',
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
