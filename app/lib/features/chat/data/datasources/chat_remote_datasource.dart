import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;
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
      final responseData = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
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

  // SSE Stream for real-time events
  Stream<Map<String, dynamic>> getEventStream() async* {
    final token = await _tokenStorage.readAccessToken();
    if (token == null) return;

    final baseUrl = _dioClient.client.options.baseUrl;
    final url = '$baseUrl${ApiConstants.chatStream}?access_token=$token';

    final client = http.Client();
    try {
      final request = http.Request('GET', Uri.parse(url));
      request.headers['Accept'] = 'text/event-stream';
      request.headers['Cache-Control'] = 'no-cache';

      final response = await client.send(request);
      if (response.statusCode != 200) {
        throw Exception('Failed to connect to SSE stream: ${response.statusCode}');
      }

      String? eventType;
      final buffer = StringBuffer();
      
      await for (final chunk in response.stream.transform(utf8.decoder)) {
        final lines = chunk.split('\n');
        for (final line in lines) {
          final trimmedLine = line.trim();
          
          if (trimmedLine.startsWith('event: ')) {
            eventType = trimmedLine.substring(7).trim();
          } else if (trimmedLine.startsWith('data: ')) {
            final data = trimmedLine.substring(6).trim();
            if (data.isNotEmpty && data != '[DONE]') {
              buffer.write(data);
            }
          } else if (trimmedLine.isEmpty && buffer.isNotEmpty) {
            // End of SSE event block
            try {
              final payload = jsonDecode(buffer.toString()) as Map<String, dynamic>;
              
              // Merge event type with payload, prioritizing payload's type if it exists
              final event = <String, dynamic>{
                'type': eventType ?? payload['type'],
                ...payload,
              };
              
              yield event;
            } catch (e) {
              // Skip malformed events
            } finally {
              buffer.clear();
              eventType = null;
            }
          }
        }
      }
    } catch (e) {
      // Handle connection errors silently - the stream will be retried
    } finally {
      client.close();
    }
  }
}