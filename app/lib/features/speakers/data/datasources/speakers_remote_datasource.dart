import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/speakers/data/models/speaker_model.dart';

class SpeakersRemoteDataSource {
  SpeakersRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<List<SpeakerModel>> list({
    required String eventId,
    String? search,
    int perPage = 100,
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.speakers,
        queryParameters: {
          'eventId': eventId,
          'perPage': perPage,
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        },
      );
      final data =
          (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ?? const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(SpeakerModel.fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
