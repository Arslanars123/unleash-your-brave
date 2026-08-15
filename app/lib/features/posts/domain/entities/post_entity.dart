import 'package:equatable/equatable.dart';

class PostAuthorEntity extends Equatable {
  const PostAuthorEntity({
    required this.id,
    required this.name,
    this.photoUrl = '',
  });

  final String id;
  final String name;
  final String photoUrl;

  @override
  List<Object?> get props => [id, name, photoUrl];
}

class PostEntity extends Equatable {
  const PostEntity({
    required this.id,
    required this.authorId,
    this.author,
    required this.text,
    this.image = '',
    required this.commentsEnabled,
    required this.likesCount,
    required this.commentsCount,
    required this.likedByMe,
    required this.createdAt,
  });

  final String id;
  final String authorId;
  final PostAuthorEntity? author;
  final String text;
  final String image;
  final bool commentsEnabled;
  final int likesCount;
  final int commentsCount;
  final bool likedByMe;
  final DateTime createdAt;

  PostEntity copyWith({
    int? likesCount,
    int? commentsCount,
    bool? likedByMe,
  }) {
    return PostEntity(
      id: id,
      authorId: authorId,
      author: author,
      text: text,
      image: image,
      commentsEnabled: commentsEnabled,
      likesCount: likesCount ?? this.likesCount,
      commentsCount: commentsCount ?? this.commentsCount,
      likedByMe: likedByMe ?? this.likedByMe,
      createdAt: createdAt,
    );
  }

  @override
  List<Object?> get props => [
        id,
        authorId,
        author,
        text,
        image,
        commentsEnabled,
        likesCount,
        commentsCount,
        likedByMe,
        createdAt,
      ];
}

class PostCommentEntity extends Equatable {
  const PostCommentEntity({
    required this.id,
    required this.postId,
    required this.userId,
    required this.userName,
    required this.text,
    required this.createdAt,
  });

  final String id;
  final String postId;
  final String userId;
  final String userName;
  final String text;
  final DateTime createdAt;

  @override
  List<Object?> get props => [id, postId, userId, userName, text, createdAt];
}
