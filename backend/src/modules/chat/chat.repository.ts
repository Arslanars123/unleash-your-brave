import type {
  ChatGroup,
  ChatMemberState,
  ChatMessage,
  ChatReaction,
  DevicePlatform,
  DeviceToken,
} from './chat.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface ChatGroupRepository {
  getById(id: string): Promise<ChatGroup | null>;
  ensure(group: ChatGroup): Promise<ChatGroup>;
}

export interface ChatMessageRepository {
  create(message: ChatMessage): Promise<ChatMessage>;
  findByClientId(groupId: string, clientId: string): Promise<ChatMessage | null>;
  findById(id: string): Promise<ChatMessage | null>;
  deleteById(id: string): Promise<boolean>;
  listBefore(params: {
    groupId: string;
    beforeCreatedAt?: Date;
    beforeId?: string;
    limit: number;
  }): Promise<ChatMessage[]>;
  listSince(params: { groupId: string; since: Date; limit: number }): Promise<ChatMessage[]>;
  countUnread(params: {
    groupId: string;
    userId: string;
    afterCreatedAt: Date | null;
    afterId: string | null;
  }): Promise<number>;
  getLatest(groupId: string): Promise<ChatMessage | null>;
}

export interface ChatMemberStateRepository {
  get(groupId: string, userId: string): Promise<ChatMemberState | null>;
  upsert(state: ChatMemberState): Promise<ChatMemberState>;
  listByGroup(groupId: string): Promise<ChatMemberState[]>;
  countDeliveredBeyond(params: {
    groupId: string;
    messageId: string;
    excludeUserId: string;
  }): Promise<number>;
  countReadBeyond(params: {
    groupId: string;
    messageId: string;
    excludeUserId: string;
  }): Promise<number>;
}

export interface ChatReactionRepository {
  upsert(reaction: ChatReaction): Promise<ChatReaction>;
  remove(messageId: string, userId: string): Promise<void>;
  removeForMessage(messageId: string): Promise<void>;
  listForMessages(messageIds: string[]): Promise<ChatReaction[]>;
}

export interface DeviceTokenRepository {
  upsert(token: DeviceToken): Promise<DeviceToken>;
  listByUserIds(userIds: string[]): Promise<DeviceToken[]>;
  removeByToken(token: string): Promise<void>;
  removeByUserAndToken(userId: string, token: string): Promise<void>;
  listAllExceptUser(userId: string): Promise<DeviceToken[]>;
}

export type { DevicePlatform };
