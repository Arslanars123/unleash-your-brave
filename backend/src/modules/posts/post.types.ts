export interface Post {
  id: string;
  authorId: string;
  text: string;
  image: string;
  /** When false, attendees cannot add new comments. */
  commentsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostLike {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPostAuthor {
  id: string;
  name: string;
  photoUrl: string;
}

export interface PublicPost {
  id: string;
  authorId: string;
  author: PublicPostAuthor | null;
  text: string;
  image: string;
  commentsEnabled: boolean;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPostCommentUser {
  id: string;
  name: string;
  email: string;
}

export interface PublicPostComment {
  id: string;
  postId: string;
  userId: string;
  user: PublicPostCommentUser | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  text: string;
  image?: string;
  commentsEnabled?: boolean;
}

export interface UpdatePostInput {
  text?: string;
  image?: string;
  commentsEnabled?: boolean;
}

export interface CreatePostCommentInput {
  text: string;
}

export interface UpdatePostCommentInput {
  text: string;
}

export interface ListPostsQuery {
  page: number;
  perPage: number;
  search?: string;
}

export interface ListPostCommentsQuery {
  page: number;
  perPage: number;
}
