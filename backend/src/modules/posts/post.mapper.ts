import type {
  Post,
  PostComment,
  PublicPost,
  PublicPostAuthor,
  PublicPostComment,
  PublicPostCommentUser,
} from './post.types.js';

export function toPublicPost(
  post: Post,
  author: PublicPostAuthor | null,
  likesCount: number,
  commentsCount: number,
  likedByMe: boolean,
): PublicPost {
  return {
    id: post.id,
    authorId: post.authorId,
    author,
    text: post.text,
    image: post.image,
    commentsEnabled: post.commentsEnabled,
    likesCount,
    commentsCount,
    likedByMe,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function toPublicPostComment(
  comment: PostComment,
  user: PublicPostCommentUser | null,
): PublicPostComment {
  return {
    id: comment.id,
    postId: comment.postId,
    userId: comment.userId,
    user,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
