import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
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
}
