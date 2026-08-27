import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/home/data/models/event_model.dart';

class EventsRemoteDataSource {
  EventsRemoteDataSource(this._dioClient);

  final DioClient _dioClient;

  Future<EventModel> getCurrent() async {
    try {
      final response = await _dioClient.client.get(ApiConstants.currentEvent);
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return EventModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<List<EventModel>> listAvailable() async {
    try {
      final response = await _dioClient.client.get(ApiConstants.availableEvents);
      final data =
          (response.data as Map<String, dynamic>)['data'] as List<dynamic>? ??
              const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(EventModel.fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  /// Published ended editions (purchased or not).
  ///
  /// Uses workspace `pastEditions` so it works on live before `/events/previous`
  /// is deployed (that path currently hits `/:id` and fails UUID validation).
  Future<List<EventModel>> listPrevious() async {
    try {
      return await _listPreviousFromWorkspace();
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<List<EventModel>> _listPreviousFromWorkspace() async {
    final response = await _dioClient.client.get(ApiConstants.eventWorkspace);
    final payload =
        (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>?;
    final past = payload?['pastEditions'] as List<dynamic>? ?? const [];
    return past
        .whereType<Map<String, dynamic>>()
        .map(EventModel.fromJson)
        .where((e) => e.isEnded)
        .toList(growable: false);
  }

  Future<EventModel> getById(String id) async {
    try {
      final response =
          await _dioClient.client.get('${ApiConstants.events}/$id');
      final data =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return EventModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }
}
