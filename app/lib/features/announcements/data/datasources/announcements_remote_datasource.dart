import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/announcements/data/models/announcement_model.dart';
import 'package:unleash_your_brave/features/announcements/domain/entities/announcement_entity.dart';

class AnnouncementsRemoteDataSource {
  AnnouncementsRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<AnnouncementFeedResult> getFeed({
    int page = 1,
    int perPage = 50,
    String filter = 'all',
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.announcementsFeed,
        queryParameters: {
          'page': page,
          'perPage': perPage,
          'filter': filter,
        },
      );
      final body = response.data as Map<String, dynamic>;
      final data = body['data'] as List<dynamic>? ?? const [];
      final meta = body['meta'] as Map<String, dynamic>? ?? const {};
      final items = data
          .whereType<Map<String, dynamic>>()
          .map(AnnouncementModel.fromJson)
          .map((m) => m.toEntity())
          .toList(growable: false);
      return AnnouncementFeedResult(
        items: items,
        unreadCount: (meta['unreadCount'] as num?)?.toInt() ??
            items.where((i) => !i.isRead).length,
        total: (meta['total'] as num?)?.toInt() ?? items.length,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<int> getUnreadCount() async {
    try {
      final response =
          await _dioClient.client.get(ApiConstants.announcementsUnreadCount);
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>?;
      return (data?['count'] as num?)?.toInt() ?? 0;
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<AnnouncementEntity> markRead(String id) async {
    try {
      final response =
          await _dioClient.client.post('${ApiConstants.announcements}/$id/read');
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return AnnouncementModel.fromJson(data).toEntity();
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<AnnouncementEntity> getById(String id) async {
    try {
      final response =
          await _dioClient.client.get('${ApiConstants.announcements}/$id');
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return AnnouncementModel.fromJson(data).toEntity();
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
