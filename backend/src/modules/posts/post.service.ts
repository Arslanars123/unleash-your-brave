import { ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';
import type { UserRepository } from '../users/user.repository.js';
import { toPublicPost, toPublicPostComment } from './post.mapper.js';
import type { PaginatedResult, PostRepository } from './post.repository.js';
import type {
  CreatePostCommentInput,
  CreatePostInput,
  ListPostCommentsQuery,
  ListPostsQuery,
  Post,
  PublicPost,
  PublicPostComment,
  UpdatePostCommentInput,
  UpdatePostInput,
} from './post.types.js';

export class PostService {
  constructor(
    private readonly posts: PostRepository,
    private readonly users: UserRepository,
  ) {}

  async list(query: ListPostsQuery, viewerUserId?: string | null): Promise<PaginatedResult<PublicPost>> {
    const { items, total } = await this.posts.list(query);
    const mapped = await Promise.all(items.map((post) => this.toPublic(post, viewerUserId)));
    return { items: mapped, total };
  }

  async getById(id: string, viewerUserId?: string | null): Promise<PublicPost> {
    return this.toPublic(await this.requirePost(id), viewerUserId);
  }

  async create(authorId: string, input: CreatePostInput): Promise<PublicPost> {
    const created = await this.posts.create({
      authorId,
      text: input.text,
      image: input.image ?? '',
      commentsEnabled: input.commentsEnabled ?? true,
    });
    return this.toPublic(created, authorId);
  }

  async update(id: string, input: UpdatePostInput, viewerUserId?: string | null): Promise<PublicPost> {
    await this.requirePost(id);
    const updated = await this.posts.update(id, {
      ...(input.text !== undefined ? { text: input.text } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.commentsEnabled !== undefined
        ? { commentsEnabled: input.commentsEnabled }
        : {}),
    });
    if (!updated) throw new NotFoundError('Post');
    return this.toPublic(updated, viewerUserId);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.posts.delete(id))) {
      throw new NotFoundError('Post');
    }
  }

  async like(postId: string, userId: string): Promise<PublicPost> {
    await this.requirePost(postId);
    const existing = await this.posts.findLike(postId, userId);
    if (!existing) {
      await this.posts.createLike({ postId, userId });
    }
    return this.getById(postId, userId);
  }

  async unlike(postId: string, userId: string): Promise<PublicPost> {
    await this.requirePost(postId);
    await this.posts.deleteLike(postId, userId);
    return this.getById(postId, userId);
  }

  async listComments(
    postId: string,
    query: ListPostCommentsQuery,
  ): Promise<PaginatedResult<PublicPostComment>> {
    await this.requirePost(postId);
    const { items, total } = await this.posts.listComments(postId, query);
    const mapped = await Promise.all(items.map((comment) => this.toPublicComment(comment)));
    return { items: mapped, total };
  }

  async addComment(
    postId: string,
    userId: string,
    input: CreatePostCommentInput,
  ): Promise<PublicPostComment> {
    const post = await this.requirePost(postId);
    if (!post.commentsEnabled) {
      throw new ForbiddenError('Comments are turned off for this post');
    }
    const created = await this.posts.createComment({
      postId,
      userId,
      text: input.text.trim(),
    });
    return this.toPublicComment(created);
  }

  async updateComment(
    postId: string,
    commentId: string,
    actor: { userId: string; role: string },
    input: UpdatePostCommentInput,
  ): Promise<PublicPostComment> {
    await this.requirePost(postId);
    const comment = await this.requireCommentOnPost(postId, commentId);

    if (actor.role !== 'admin' && comment.userId !== actor.userId) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    const updated = await this.posts.updateComment(commentId, { text: input.text.trim() });
    if (!updated) throw new NotFoundError('Comment');
    return this.toPublicComment(updated);
  }

  async deleteComment(
    postId: string,
    commentId: string,
    actor: { userId: string; role: string },
  ): Promise<void> {
    await this.requirePost(postId);
    const comment = await this.requireCommentOnPost(postId, commentId);

    if (actor.role !== 'admin' && comment.userId !== actor.userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    await this.posts.deleteComment(commentId);
  }

  private async requirePost(id: string): Promise<Post> {
    const post = await this.posts.findById(id);
    if (!post) throw new NotFoundError('Post');
    return post;
  }

  private async requireCommentOnPost(postId: string, commentId: string) {
    const comment = await this.posts.findCommentById(commentId);
    if (!comment || comment.postId !== postId) throw new NotFoundError('Comment');
    return comment;
  }

  private async toPublic(post: Post, viewerUserId?: string | null): Promise<PublicPost> {
    const [author, likesCount, commentsCount, like] = await Promise.all([
      this.users.findById(post.authorId),
      this.posts.countLikes(post.id),
      this.posts.countComments(post.id),
      viewerUserId ? this.posts.findLike(post.id, viewerUserId) : Promise.resolve(null),
    ]);

    return toPublicPost(
      post,
      author
        ? {
            id: author.id,
            name: author.name,
            photoUrl: author.photoUrl ?? '',
          }
        : null,
      likesCount,
      commentsCount,
      Boolean(like),
    );
  }

  private async toPublicComment(
    comment: Awaited<ReturnType<PostRepository['findCommentById']>>,
  ): Promise<PublicPostComment> {
    if (!comment) throw new NotFoundError('Comment');
    const user = await this.users.findById(comment.userId);
    return toPublicPostComment(
      comment,
      user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
          }
        : null,
    );
  }
}
