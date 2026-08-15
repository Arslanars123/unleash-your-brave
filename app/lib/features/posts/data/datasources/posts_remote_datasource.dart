import 'package:dio/dio.dart';
import 'package:unleash_your_brave/core/constants/app_constants.dart';
import 'package:unleash_your_brave/core/network/dio_client.dart';
import 'package:unleash_your_brave/features/posts/domain/entities/post_entity.dart';

class PostsRemoteDataSource {
  PostsRemoteDataSource(this._dio);

  final DioClient _dio;

  Future<List<PostEntity>> list({int page = 1, int perPage = 20}) async {
    try {
      final response = await _dio.client.get(
        ApiConstants.posts,
        queryParameters: {'page': page, 'perPage': perPage},
      );
      final raw = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      return raw
          .cast<Map<String, dynamic>>()
          .map(_postFromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<PostEntity> like(String postId) async {
    try {
      final response = await _dio.client.post('${ApiConstants.posts}/$postId/likes');
      return _postFromJson(
        (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<PostEntity> unlike(String postId) async {
    try {
      final response = await _dio.client.delete('${ApiConstants.posts}/$postId/likes');
      return _postFromJson(
        (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<List<PostCommentEntity>> listComments(String postId) async {
    try {
      final response = await _dio.client.get(
        '${ApiConstants.posts}/$postId/comments',
        queryParameters: {'perPage': 50},
      );
      final raw = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      return raw
          .cast<Map<String, dynamic>>()
          .map(_commentFromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  Future<PostCommentEntity> addComment(String postId, String text) async {
    try {
      final response = await _dio.client.post(
        '${ApiConstants.posts}/$postId/comments',
        data: {'text': text},
      );
      return _commentFromJson(
        (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
      );
    } on DioException catch (error) {
      throwMappedDioError(error);
    }
  }

  PostEntity _postFromJson(Map<String, dynamic> json) {
    final authorJson = json['author'] as Map<String, dynamic>?;
    return PostEntity(
      id: json['id'] as String,
      authorId: json['authorId'] as String? ?? '',
      author: authorJson == null
          ? null
          : PostAuthorEntity(
              id: authorJson['id'] as String? ?? '',
              name: authorJson['name'] as String? ?? 'Admin',
              photoUrl: authorJson['photoUrl'] as String? ?? '',
            ),
      text: json['text'] as String? ?? '',
      image: json['image'] as String? ?? '',
      commentsEnabled: json['commentsEnabled'] as bool? ?? true,
      likesCount: json['likesCount'] as int? ?? 0,
      commentsCount: json['commentsCount'] as int? ?? 0,
      likedByMe: json['likedByMe'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  PostCommentEntity _commentFromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    return PostCommentEntity(
      id: json['id'] as String,
      postId: json['postId'] as String,
      userId: json['userId'] as String? ?? '',
      userName: user?['name'] as String? ?? 'Attendee',
      text: json['text'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}
