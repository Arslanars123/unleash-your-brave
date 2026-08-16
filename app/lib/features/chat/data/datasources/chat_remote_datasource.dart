import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/core/network/token_storage.dart';
import 'package:unleash_your_brave/features/chat/data/models/chat_group_model.dart';
import 'package:unleash_your_brave/features/chat/data/models/chat_member_model.dart';
import 'package:unleash_your_brave/features/chat/data/models/chat_message_model.dart';

class ChatRemoteDataSource {
  ChatRemoteDataSource(this._dioClient, this._tokenStorage);

  final DioClient _dioClient;
  final TokenStorage _tokenStorage;

  Future<ChatGroupModel> getGroup() async {
    try {
      final response = await _dioClient.client.get(ApiConstants.chatGroup);
      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return ChatGroupModel.fromJson(data);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<List<ChatMemberModel>> getMembers({
    required int page,
    required int perPage,
  }) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.chatMembers,
        queryParameters: {'page': page, 'perPage': perPage},
      );
      final data = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      return data
          .cast<Map<String, dynamic>>()
          .map((json) => ChatMemberModel.fromJson(json))
          .toList();
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<List<ChatMessageModel>> getMessages({
    String? before,
    required int limit,
  }) async {
    try {
      final queryParams = <String, dynamic>{'limit': limit};
      if (before != null) queryParams['before'] = before;

      final response = await _dioClient.client.get(
        ApiConstants.chatMessages,
        queryParameters: queryParams,
      );
      final data = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      return data
          .cast<Map<String, dynamic>>()
          .map((json) => ChatMessageModel.fromJson(json))
          .toList();
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<ChatMessageModel> sendMessage({
    required String clientId,
    required String type,
    String? body,
    String? gifUrl,
  }) async {
    try {
      final data = <String, dynamic>{
        'clientId': clientId,
        'type': type,
      };
      if (body != null) data['body'] = body;
      if (gifUrl != null) data['gifUrl'] = gifUrl;

      final response = await _dioClient.client.post(
        ApiConstants.chatMessages,
        data: data,
      );
      final responseData =
          (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      return ChatMessageModel.fromJson(responseData);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<void> markDelivered(String messageId) async {
    try {
      await _dioClient.client.post(
        ApiConstants.chatDelivered,
        data: {'messageId': messageId},
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<void> markRead(String messageId) async {
    try {
      await _dioClient.client.post(
        ApiConstants.chatRead,
        data: {'messageId': messageId},
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<void> addReaction({
    required String messageId,
    required String emoji,
  }) async {
    try {
      await _dioClient.client.post(
        '${ApiConstants.chatMessages}/$messageId/reactions',
        data: {'emoji': emoji},
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<void> removeReaction(String messageId) async {
    try {
      await _dioClient.client.delete(
        '${ApiConstants.chatMessages}/$messageId/reactions',
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<Map<String, dynamic>> sync(DateTime since) async {
    try {
      final response = await _dioClient.client.get(
        ApiConstants.chatSync,
        queryParameters: {'since': since.toIso8601String()},
      );
      return (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<void> registerDevice({
    required String token,
    required String platform,
  }) async {
    try {
      await _dioClient.client.post(
        ApiConstants.chatDevices,
        data: {'token': token, 'platform': platform},
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<void> unregisterDevice(String token) async {
    try {
      await _dioClient.client.delete(
        ApiConstants.chatDevices,
        data: {'token': token},
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  /// Live chat events via SSE (`/chat/stream`).
  ///
  /// App Runner currently rejects WebSocket upgrades (403), while SSE works.
  Stream<Map<String, dynamic>> getEventStream() async* {
    final token = await _tokenStorage.readAccessToken();
    if (token == null || token.isEmpty) return;

    final base = _dioClient.client.options.baseUrl.replaceAll(RegExp(r'/$'), '');
    final url = '$base${ApiConstants.chatStream}';

    Response<ResponseBody>? response;
    try {
      response = await _dioClient.client.get<ResponseBody>(
        url,
        queryParameters: {'access_token': token},
        options: Options(
          responseType: ResponseType.stream,
          headers: const {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          receiveTimeout: Duration.zero,
        ),
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }

    final stream = response.data?.stream;
    if (stream == null) return;

    final buffer = StringBuffer();
    String? eventName;

    await for (final chunk in stream) {
      buffer.write(utf8.decode(chunk, allowMalformed: true));
      var content = buffer.toString();

      while (true) {
        final sep = content.indexOf('\n\n');
        if (sep < 0) break;

        final rawEvent = content.substring(0, sep);
        content = content.substring(sep + 2);
        buffer
          ..clear()
          ..write(content);

        final parsed = _parseSseBlock(rawEvent, fallbackEvent: eventName);
        eventName = parsed.eventName;
        if (parsed.data != null) {
          yield parsed.data!;
        }
      }
    }
  }

  _SseParseResult _parseSseBlock(String rawEvent, {String? fallbackEvent}) {
    String? eventName = fallbackEvent;
    final dataLines = <String>[];

    for (final line in rawEvent.split('\n')) {
      final trimmed = line.trimRight();
      if (trimmed.isEmpty || trimmed.startsWith(':')) continue;
      if (trimmed.startsWith('event:')) {
        eventName = trimmed.substring(6).trim();
        continue;
      }
      if (trimmed.startsWith('data:')) {
        dataLines.add(trimmed.substring(5).trimLeft());
      }
    }

    if (dataLines.isEmpty) {
      return _SseParseResult(eventName: eventName);
    }

    final rawData = dataLines.join('\n');
    try {
      final decoded = jsonDecode(rawData);
      if (decoded is Map<String, dynamic>) {
        final type = decoded['type'] as String? ?? eventName;
        return _SseParseResult(
          eventName: eventName,
          data: <String, dynamic>{
            if (type != null) 'type': type,
            ...decoded,
          },
        );
      }
    } catch (_) {
      // Ignore malformed frames
    }
    return _SseParseResult(eventName: eventName);
  }
}

class _SseParseResult {
  const _SseParseResult({this.eventName, this.data});

  final String? eventName;
  final Map<String, dynamic>? data;
}
