import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/sponsors/data/models/sponsor_model.dart';

class SponsorsRemoteDataSource {
  SponsorsRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<List<SponsorModel>> list({
    required String eventId,
    String? search,
    int perPage = 100,
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.sponsors,
        queryParameters: {
          'eventId': eventId,
          'perPage': perPage,
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        },
      );
      final data = (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ??
          const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(SponsorModel.fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<SponsorModel> getById(String id, {required String eventId}) async {
    try {
      final response = await _dioClient.client.get(
        '${ApiConstants.sponsors}/$id',
        queryParameters: {'eventId': eventId},
      );
      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return SponsorModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
