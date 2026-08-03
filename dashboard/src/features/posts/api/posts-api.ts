import { apiClient } from '@/shared/api/client';
import type {
  PaginationMeta,
  PostCommentPayload,
  PostPayload,
  PublicPost,
  PublicPostComment,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListPostsParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface ListPostsResult {
  items: PublicPost[];
  meta: PaginationMeta;
}

export interface ListPostCommentsResult {
  items: PublicPostComment[];
  meta: PaginationMeta;
}

export const postsApi = {
  async list(params: ListPostsParams = {}): Promise<ListPostsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicPost[]>>('/posts', { params });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async create(payload: PostPayload): Promise<PublicPost> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicPost>>('/posts', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<PostPayload>): Promise<PublicPost> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicPost>>(`/posts/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/posts/${id}`);
  },

  async listComments(
    postId: string,
    params: { page?: number; perPage?: number } = {},
  ): Promise<ListPostCommentsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicPostComment[]>>(
      `/posts/${postId}/comments`,
      { params },
    );
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 50, total: data.data.length, totalPages: 1 },
    };
  },

  async updateComment(
    postId: string,
    commentId: string,
    payload: PostCommentPayload,
  ): Promise<PublicPostComment> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicPostComment>>(
      `/posts/${postId}/comments/${commentId}`,
      payload,
    );
    return data.data;
  },

  async removeComment(postId: string, commentId: string): Promise<void> {
    await apiClient.delete(`/posts/${postId}/comments/${commentId}`);
  },
};
