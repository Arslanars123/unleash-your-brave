import { randomUUID } from 'node:crypto';

/** Fixed singleton group for the whole event. */
export const GLOBAL_CHAT_GROUP_ID = '00000000-0000-4000-8000-000000000001';
export const GLOBAL_CHAT_GROUP_NAME = 'Unleash Your Brave';

export const CHAT_MESSAGE_TYPES = ['text', 'gif'] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'] as const;
export type ReactionEmoji = (typeof ALLOWED_REACTIONS)[number];

export interface ChatGroup {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  clientId: string;
  type: ChatMessageType;
  body: string;
  gifUrl: string;
  createdAt: Date;
}

export interface ChatMemberState {
  id: string;
  groupId: string;
  userId: string;
  lastDeliveredMessageId: string | null;
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  updatedAt: Date;
}

export interface ChatReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageView {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderPhotoUrl: string;
  clientId: string;
  type: ChatMessageType;
  body: string;
  gifUrl: string;
  createdAt: string;
  reactions: ChatReactionSummary[];
  /** For the requesting user's own messages. */
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

export interface CreateChatMessageInput {
  clientId: string;
  type: ChatMessageType;
  body?: string;
  gifUrl?: string;
}

export interface SyncResult {
  messages: ChatMessageView[];
  group: ChatGroupSummary;
}

export function newChatGroup(): ChatGroup {
  const now = new Date();
  return {
    id: GLOBAL_CHAT_GROUP_ID,
    name: GLOBAL_CHAT_GROUP_NAME,
    createdAt: now,
    updatedAt: now,
  };
}

export function newMemberState(groupId: string, userId: string): ChatMemberState {
  const now = new Date();
  return {
    id: randomUUID(),
    groupId,
    userId,
    lastDeliveredMessageId: null,
    lastReadMessageId: null,
    lastReadAt: null,
    updatedAt: now,
  };
}
