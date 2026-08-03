import { randomUUID } from 'node:crypto';
import type {
  ListPostCommentsQuery,
  ListPostsQuery,
  Post,
  PostComment,
  PostLike,
} from './post.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface PostRepository {
  findById(id: string): Promise<Post | null>;
  list(query: ListPostsQuery): Promise<PaginatedResult<Post>>;
  create(data: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>): Promise<Post>;
  update(id: string, data: Partial<Omit<Post, 'id' | 'createdAt'>>): Promise<Post | null>;
  delete(id: string): Promise<boolean>;

  findLike(postId: string, userId: string): Promise<PostLike | null>;
  countLikes(postId: string): Promise<number>;
  createLike(data: Omit<PostLike, 'id' | 'createdAt'>): Promise<PostLike>;
  deleteLike(postId: string, userId: string): Promise<boolean>;
  deleteLikesByPost(postId: string): Promise<number>;

  findCommentById(id: string): Promise<PostComment | null>;
  listComments(
    postId: string,
    query: ListPostCommentsQuery,
  ): Promise<PaginatedResult<PostComment>>;
  countComments(postId: string): Promise<number>;
  createComment(data: Omit<PostComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<PostComment>;
  updateComment(
    id: string,
    data: Partial<Pick<PostComment, 'text'>>,
  ): Promise<PostComment | null>;
  deleteComment(id: string): Promise<boolean>;
  deleteCommentsByPost(postId: string): Promise<number>;
}

export class InMemoryPostRepository implements PostRepository {
  private readonly posts = new Map<string, Post>();
  private readonly likes = new Map<string, PostLike>();
  private readonly comments = new Map<string, PostComment>();

  async findById(id: string): Promise<Post | null> {
    return this.posts.get(id) ?? null;
  }

  async list(query: ListPostsQuery): Promise<PaginatedResult<Post>> {
    const search = query.search?.toLowerCase();
    const filtered = [...this.posts.values()]
      .filter((post) => {
        if (!search) return true;
        return post.text.toLowerCase().includes(search);
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async create(data: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>): Promise<Post> {
    const now = new Date();
    const post: Post = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.posts.set(post.id, post);
    return post;
  }

  async update(id: string, data: Partial<Omit<Post, 'id' | 'createdAt'>>): Promise<Post | null> {
    const existing = this.posts.get(id);
    if (!existing) return null;
    const updated: Post = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.posts.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const removed = this.posts.delete(id);
    if (removed) {
      await this.deleteLikesByPost(id);
      await this.deleteCommentsByPost(id);
    }
    return removed;
  }

  async findLike(postId: string, userId: string): Promise<PostLike | null> {
    for (const like of this.likes.values()) {
      if (like.postId === postId && like.userId === userId) return like;
    }
    return null;
  }

  async countLikes(postId: string): Promise<number> {
    let count = 0;
    for (const like of this.likes.values()) {
      if (like.postId === postId) count += 1;
    }
    return count;
  }

  async createLike(data: Omit<PostLike, 'id' | 'createdAt'>): Promise<PostLike> {
    const like: PostLike = {
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
    };
    this.likes.set(like.id, like);
    return like;
  }

  async deleteLike(postId: string, userId: string): Promise<boolean> {
    for (const [id, like] of this.likes.entries()) {
      if (like.postId === postId && like.userId === userId) {
        this.likes.delete(id);
        return true;
      }
    }
    return false;
  }

  async deleteLikesByPost(postId: string): Promise<number> {
    let removed = 0;
    for (const [id, like] of this.likes.entries()) {
      if (like.postId === postId) {
        this.likes.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  async findCommentById(id: string): Promise<PostComment | null> {
    return this.comments.get(id) ?? null;
  }

  async listComments(
    postId: string,
    query: ListPostCommentsQuery,
  ): Promise<PaginatedResult<PostComment>> {
    const filtered = [...this.comments.values()]
      .filter((comment) => comment.postId === postId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async countComments(postId: string): Promise<number> {
    let count = 0;
    for (const comment of this.comments.values()) {
      if (comment.postId === postId) count += 1;
    }
    return count;
  }

  async createComment(
    data: Omit<PostComment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PostComment> {
    const now = new Date();
    const comment: PostComment = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.comments.set(comment.id, comment);
    return comment;
  }

  async updateComment(
    id: string,
    data: Partial<Pick<PostComment, 'text'>>,
  ): Promise<PostComment | null> {
    const existing = this.comments.get(id);
    if (!existing) return null;
    const updated: PostComment = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.comments.set(id, updated);
    return updated;
  }

  async deleteComment(id: string): Promise<boolean> {
    return this.comments.delete(id);
  }

  async deleteCommentsByPost(postId: string): Promise<number> {
    let removed = 0;
    for (const [id, comment] of this.comments.entries()) {
      if (comment.postId === postId) {
        this.comments.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
