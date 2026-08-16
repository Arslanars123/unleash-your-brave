import { apiClient } from '@/shared/api/client';
import { createClientId } from '@/shared/lib/client-id';
import type { SuccessEnvelope } from '@/shared/types/api';

export interface ChatMessageView {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderPhotoUrl: string;
  clientId: string;
  type: 'text' | 'gif';
  body: string;
  gifUrl: string;
  createdAt: string;
  reactions: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
  deliveryStatus: 'sent' | 'delivered' | 'read';
}

export interface ChatGroupSummary {
  id: string;
  name: string;
  memberCount: number;
  unreadCount: number;
  lastMessage: ChatMessageView | null;
}

export interface ChatMemberView {
  id: string;
  name: string;
  photoUrl: string;
  title: string;
  role: string;
}

export const chatApi = {
  async getGroup(): Promise<ChatGroupSummary> {
    const { data } = await apiClient.get<SuccessEnvelope<ChatGroupSummary>>('/chat/group');
    return data.data;
  },

  async listMessages(params: { before?: string; limit?: number } = {}): Promise<ChatMessageView[]> {
    const { data } = await apiClient.get<SuccessEnvelope<ChatMessageView[]>>('/chat/messages', {
      params,
    });
    return data.data;
  },

  async listMembers(params: { page?: number; perPage?: number } = {}): Promise<{
    items: ChatMemberView[];
    total: number;
  }> {
    const { data } = await apiClient.get<SuccessEnvelope<ChatMemberView[]>>('/chat/members', {
      params,
    });
    return {
      items: data.data,
      total: data.meta?.total ?? data.data.length,
    };
  },

  async sendText(body: string, clientIdOverride?: string): Promise<ChatMessageView> {
    const { data } = await apiClient.post<SuccessEnvelope<ChatMessageView>>('/chat/messages', {
      clientId: clientIdOverride ?? createClientId(),
      type: 'text',
      body,
    });
    return data.data;
  },

  async removeMessage(id: string): Promise<void> {
    await apiClient.delete(`/chat/messages/${id}`);
  },
};
