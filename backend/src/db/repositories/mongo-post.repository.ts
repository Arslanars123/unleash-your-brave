import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type { PaginatedResult, PostRepository } from '../../modules/posts/post.repository.js';
import type {
  ListPostCommentsQuery,
  ListPostsQuery,
  Post,
  PostComment,
  PostLike,
} from '../../modules/posts/post.types.js';

export class MongoPostRepository implements PostRepository {
  private get posts(): Collection<MongoDoc<Post>> {
    return getDb().collection<MongoDoc<Post>>('posts');
  }

  private get likes(): Collection<MongoDoc<PostLike>> {
    return getDb().collection<MongoDoc<PostLike>>('post_likes');
  }

  private get comments(): Collection<MongoDoc<PostComment>> {
    return getDb().collection<MongoDoc<PostComment>>('post_comments');
  }

  async findById(id: string): Promise<Post | null> {
    return fromDoc<Post>(await this.posts.findOne({ _id: id }));
  }

  async list(query: ListPostsQuery): Promise<PaginatedResult<Post>> {
    const filter: Filter<MongoDoc<Post>> = {};
    if (query.search?.trim()) {
      filter.$or = [containsCi('text', query.search.trim())];
    }

    const total = await this.posts.countDocuments(filter);
    const docs = await this.posts
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<Post>(docs), total };
  }

  async create(data: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>): Promise<Post> {
    const now = new Date();
    const post: Post = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.posts.insertOne(toDoc(post));
    return post;
  }

  async update(
    id: string,
    data: Partial<Omit<Post, 'id' | 'createdAt'>>,
  ): Promise<Post | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: Post = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.posts.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.posts.deleteOne({ _id: id });
    if (result.deletedCount === 1) {
      await this.deleteLikesByPost(id);
      await this.deleteCommentsByPost(id);
      return true;
    }
    return false;
  }

  async findLike(postId: string, userId: string): Promise<PostLike | null> {
    return fromDoc<PostLike>(await this.likes.findOne({ postId, userId }));
  }

  async countLikes(postId: string): Promise<number> {
    return this.likes.countDocuments({ postId });
  }

  async createLike(data: Omit<PostLike, 'id' | 'createdAt'>): Promise<PostLike> {
    const like: PostLike = { id: randomUUID(), ...data, createdAt: new Date() };
    await this.likes.insertOne(toDoc(like));
    return like;
  }

  async deleteLike(postId: string, userId: string): Promise<boolean> {
    const result = await this.likes.deleteOne({ postId, userId });
    return result.deletedCount === 1;
  }

  async deleteLikesByPost(postId: string): Promise<number> {
    const result = await this.likes.deleteMany({ postId });
    return result.deletedCount;
  }

  async findCommentById(id: string): Promise<PostComment | null> {
    return fromDoc<PostComment>(await this.comments.findOne({ _id: id }));
  }

  async listComments(
    postId: string,
    query: ListPostCommentsQuery,
  ): Promise<PaginatedResult<PostComment>> {
    const filter = { postId };
    const total = await this.comments.countDocuments(filter);
    const docs = await this.comments
      .find(filter)
      .sort({ createdAt: 1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();
    return { items: fromDocs<PostComment>(docs), total };
  }

  async countComments(postId: string): Promise<number> {
    return this.comments.countDocuments({ postId });
  }

  async createComment(
    data: Omit<PostComment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PostComment> {
    const now = new Date();
    const comment: PostComment = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.comments.insertOne(toDoc(comment));
    return comment;
  }

  async updateComment(
    id: string,
    data: Partial<Pick<PostComment, 'text'>>,
  ): Promise<PostComment | null> {
    const existing = await this.findCommentById(id);
    if (!existing) return null;
    const updated: PostComment = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.comments.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }

  async deleteComment(id: string): Promise<boolean> {
    const result = await this.comments.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async deleteCommentsByPost(postId: string): Promise<number> {
    const result = await this.comments.deleteMany({ postId });
    return result.deletedCount;
  }
}
