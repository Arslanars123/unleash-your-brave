import { randomUUID } from 'node:crypto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';
import type { UserRepository } from '../users/user.repository.js';
import type { User } from '../users/user.types.js';
import type { ChatHub } from './chat.hub.js';
import type {
  ChatGroupRepository,
  ChatMemberStateRepository,
  ChatMessageRepository,
  ChatReactionRepository,
} from './chat.repository.js';
import type { PushNotificationService } from './push.service.js';
import {
  ALLOWED_REACTIONS,
  GLOBAL_CHAT_GROUP_ID,
  newChatGroup,
  newMemberState,
  type ChatGroupSummary,
  type ChatMemberView,
  type ChatMessage,
  type ChatMessageView,
  type ChatReactionSummary,
  type CreateChatMessageInput,
  type SyncResult,
} from './chat.types.js';

export class ChatService {
  constructor(
    private readonly groups: ChatGroupRepository,
    private readonly messages: ChatMessageRepository,
    private readonly memberState: ChatMemberStateRepository,
    private readonly reactions: ChatReactionRepository,
    private readonly users: UserRepository,
    private readonly hub: ChatHub,
    private readonly push: PushNotificationService,
  ) {}

  async ensureGroup() {
    return this.groups.ensure(newChatGroup());
  }

  private async requireActiveUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.status !== 'active') {
      throw new ForbiddenError('Your account is suspended');
    }
    return user;
  }

  private async ensureMemberState(userId: string) {
    await this.ensureGroup();
    const existing = await this.memberState.get(GLOBAL_CHAT_GROUP_ID, userId);
    if (existing) return existing;
    return this.memberState.upsert(newMemberState(GLOBAL_CHAT_GROUP_ID, userId));
  }

  async getGroupSummary(userId: string): Promise<ChatGroupSummary> {
    await this.requireActiveUser(userId);
    await this.ensureMemberState(userId);
    const group = await this.ensureGroup();
    const members = await this.users.list({ page: 1, perPage: 1, status: 'active' });
    const state = await this.memberState.get(GLOBAL_CHAT_GROUP_ID, userId);
    let afterCreatedAt: Date | null = null;
    if (state?.lastReadMessageId) {
      const lastRead = await this.messages.findById(state.lastReadMessageId);
      afterCreatedAt = lastRead?.createdAt ?? null;
    }
    const unreadCount = await this.messages.countUnread({
      groupId: GLOBAL_CHAT_GROUP_ID,
      userId,
      afterCreatedAt,
      afterId: state?.lastReadMessageId ?? null,
    });
    const latest = await this.messages.getLatest(GLOBAL_CHAT_GROUP_ID);
    const lastMessage = latest
      ? (await this.toMessageViews([latest], userId))[0] ?? null
      : null;

    return {
      id: group.id,
      name: group.name,
      memberCount: members.total,
      unreadCount,
      lastMessage,
    };
  }

  async listMembers(userId: string, page: number, perPage: number) {
    await this.requireActiveUser(userId);
    await this.ensureMemberState(userId);
    const { items, total } = await this.users.list({
      page,
      perPage,
      status: 'active',
    });
    const mapped: ChatMemberView[] = items.map((user) => ({
      id: user.id,
      name: user.name,
      photoUrl: user.photoUrl,
      title: user.title,
      role: user.role,
    }));
    return { items: mapped, total };
  }

  async listMessages(userId: string, before?: string, limit = 40) {
    await this.requireActiveUser(userId);
    await this.ensureMemberState(userId);

    let beforeCreatedAt: Date | undefined;
    let beforeId: string | undefined;
    if (before) {
      const pivot = await this.messages.findById(before);
      if (!pivot) throw new BadRequestError('Invalid pagination cursor');
      beforeCreatedAt = pivot.createdAt;
      beforeId = pivot.id;
    }

    const rows = await this.messages.listBefore({
      groupId: GLOBAL_CHAT_GROUP_ID,
      beforeCreatedAt,
      beforeId,
      limit,
    });
    // Always return oldest → newest by createdAt (stable by id).
    const chronological = [...rows].sort((a, b) => {
      const delta = a.createdAt.getTime() - b.createdAt.getTime();
      if (delta !== 0) return delta;
      return a.id.localeCompare(b.id);
    });
    return this.toMessageViews(chronological, userId);
  }

  async sendMessage(userId: string, input: CreateChatMessageInput): Promise<ChatMessageView> {
    const user = await this.requireActiveUser(userId);
    await this.ensureMemberState(userId);

    const existing = await this.messages.findByClientId(GLOBAL_CHAT_GROUP_ID, input.clientId);
    if (existing) {
      return (await this.toMessageViews([existing], userId))[0]!;
    }

    if (input.type === 'text') {
      const body = (input.body ?? '').trim();
      if (!body) throw new BadRequestError('Message body is required');
      if (body.length > 4000) throw new BadRequestError('Message is too long');
    } else if (input.type === 'gif') {
      const gifUrl = (input.gifUrl ?? '').trim();
      if (!gifUrl || !/^https?:\/\//i.test(gifUrl)) {
        throw new BadRequestError('A valid GIF URL is required');
      }
    }

    const message: ChatMessage = {
      id: randomUUID(),
      groupId: GLOBAL_CHAT_GROUP_ID,
      senderId: userId,
      clientId: input.clientId,
      type: input.type,
      body: input.type === 'text' ? (input.body ?? '').trim() : '',
      gifUrl: input.type === 'gif' ? (input.gifUrl ?? '').trim() : '',
      createdAt: new Date(),
    };

    await this.messages.create(message);

    // Sender has delivered+read their own message.
    const state = await this.ensureMemberState(userId);
    await this.memberState.upsert({
      ...state,
      lastDeliveredMessageId: message.id,
      lastReadMessageId: message.id,
      lastReadAt: new Date(),
      updatedAt: new Date(),
    });

    const view = (await this.toMessageViews([message], userId))[0]!;
    this.hub.publish({
      type: 'message.created',
      payload: { message: view },
    });

    void this.push
      .notifyNewChatMessage({
        senderUserId: userId,
        groupId: GLOBAL_CHAT_GROUP_ID,
        groupName: (await this.ensureGroup()).name,
        message: {
          ...view,
          senderName: user.name,
          senderPhotoUrl: user.photoUrl,
        },
      })
      .catch(() => undefined);

    this.hub.publish({
      type: 'group.updated',
      payload: { groupId: GLOBAL_CHAT_GROUP_ID },
    });

    return view;
  }

  /**
   * Admins can delete any message; members can delete their own.
   */
  async deleteMessage(actorUserId: string, messageId: string): Promise<{ ok: true }> {
    const actor = await this.requireActiveUser(actorUserId);
    const message = await this.messages.findById(messageId);
    if (!message || message.groupId !== GLOBAL_CHAT_GROUP_ID) {
      throw new NotFoundError('Message not found');
    }

    const isAdmin = actor.role === 'admin';
    const isOwner = message.senderId === actorUserId;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenError('You can only delete your own messages');
    }

    await this.reactions.removeForMessage(messageId);
    await this.messages.deleteById(messageId);

    this.hub.publish({
      type: 'message.deleted',
      payload: {
        groupId: GLOBAL_CHAT_GROUP_ID,
        messageId,
        deletedBy: actorUserId,
      },
    });
    this.hub.publish({
      type: 'group.updated',
      payload: { groupId: GLOBAL_CHAT_GROUP_ID },
    });

    return { ok: true as const };
  }

  async markDelivered(userId: string, messageId: string) {
    await this.requireActiveUser(userId);
    const message = await this.messages.findById(messageId);
    if (!message || message.groupId !== GLOBAL_CHAT_GROUP_ID) {
      throw new NotFoundError('Message not found');
    }

    const state = await this.ensureMemberState(userId);
    const current = state.lastDeliveredMessageId
      ? await this.messages.findById(state.lastDeliveredMessageId)
      : null;

    const shouldUpdate =
      !current ||
      message.createdAt.getTime() > current.createdAt.getTime() ||
      (message.createdAt.getTime() === current.createdAt.getTime() && message.id > current.id);

    if (shouldUpdate) {
      await this.memberState.upsert({
        ...state,
        lastDeliveredMessageId: message.id,
        updatedAt: new Date(),
      });
      this.hub.publish({
        type: 'receipt.delivered',
        payload: {
          groupId: GLOBAL_CHAT_GROUP_ID,
          userId,
          messageId: message.id,
          senderId: message.senderId,
        },
      });
    }

    return { ok: true as const };
  }

  async markRead(userId: string, messageId: string) {
    await this.requireActiveUser(userId);
    const message = await this.messages.findById(messageId);
    if (!message || message.groupId !== GLOBAL_CHAT_GROUP_ID) {
      throw new NotFoundError('Message not found');
    }

    const state = await this.ensureMemberState(userId);
    const current = state.lastReadMessageId
      ? await this.messages.findById(state.lastReadMessageId)
      : null;

    const shouldUpdate =
      !current ||
      message.createdAt.getTime() > current.createdAt.getTime() ||
      (message.createdAt.getTime() === current.createdAt.getTime() && message.id > current.id);

    if (shouldUpdate) {
      await this.memberState.upsert({
        ...state,
        lastDeliveredMessageId: message.id,
        lastReadMessageId: message.id,
        lastReadAt: new Date(),
        updatedAt: new Date(),
      });
      this.hub.publish({
        type: 'receipt.read',
        payload: {
          groupId: GLOBAL_CHAT_GROUP_ID,
          userId,
          messageId: message.id,
          senderId: message.senderId,
        },
      });
      this.hub.publish({
        type: 'group.updated',
        payload: { groupId: GLOBAL_CHAT_GROUP_ID },
      });
    }

    return { ok: true as const };
  }

  async setReaction(userId: string, messageId: string, emoji: string) {
    await this.requireActiveUser(userId);
    if (!ALLOWED_REACTIONS.includes(emoji as (typeof ALLOWED_REACTIONS)[number])) {
      throw new BadRequestError('Unsupported reaction');
    }
    const message = await this.messages.findById(messageId);
    if (!message || message.groupId !== GLOBAL_CHAT_GROUP_ID) {
      throw new NotFoundError('Message not found');
    }

    await this.reactions.upsert({
      id: randomUUID(),
      messageId,
      userId,
      emoji,
      createdAt: new Date(),
    });

    const views = await this.toMessageViews([message], userId);
    this.hub.publish({
      type: 'reaction.updated',
      payload: { message: views[0] },
    });
    return views[0]!;
  }

  async removeReaction(userId: string, messageId: string) {
    await this.requireActiveUser(userId);
    const message = await this.messages.findById(messageId);
    if (!message || message.groupId !== GLOBAL_CHAT_GROUP_ID) {
      throw new NotFoundError('Message not found');
    }
    await this.reactions.remove(messageId, userId);
    const views = await this.toMessageViews([message], userId);
    this.hub.publish({
      type: 'reaction.updated',
      payload: { message: views[0] },
    });
    return views[0]!;
  }

  async sync(userId: string, sinceIso: string): Promise<SyncResult> {
    await this.requireActiveUser(userId);
    await this.ensureMemberState(userId);
    const since = new Date(sinceIso);
    if (Number.isNaN(since.getTime())) {
      throw new BadRequestError('Invalid since timestamp');
    }
    const rows = await this.messages.listSince({
      groupId: GLOBAL_CHAT_GROUP_ID,
      since,
      limit: 200,
    });
    const chronological = [...rows].sort((a, b) => {
      const delta = a.createdAt.getTime() - b.createdAt.getTime();
      if (delta !== 0) return delta;
      return a.id.localeCompare(b.id);
    });
    return {
      messages: await this.toMessageViews(chronological, userId),
      group: await this.getGroupSummary(userId),
    };
  }

  private async toMessageViews(
    messages: ChatMessage[],
    viewerId: string,
  ): Promise<ChatMessageView[]> {
    if (messages.length === 0) return [];

    const senderIds = [...new Set(messages.map((m) => m.senderId))];
    const senders = await Promise.all(senderIds.map((id) => this.users.findById(id)));
    const senderMap = new Map(
      senders.filter((u): u is User => Boolean(u)).map((u) => [u.id, u]),
    );

    const reactionRows = await this.reactions.listForMessages(messages.map((m) => m.id));
    const reactionsByMessage = new Map<string, typeof reactionRows>();
    for (const row of reactionRows) {
      const list = reactionsByMessage.get(row.messageId) ?? [];
      list.push(row);
      reactionsByMessage.set(row.messageId, list);
    }

    const views: ChatMessageView[] = [];
    for (const message of messages) {
      const sender = senderMap.get(message.senderId);
      const reactionList = reactionsByMessage.get(message.id) ?? [];
      const summaryMap = new Map<string, ChatReactionSummary>();
      for (const reaction of reactionList) {
        const current = summaryMap.get(reaction.emoji) ?? {
          emoji: reaction.emoji,
          count: 0,
          reactedByMe: false,
        };
        current.count += 1;
        if (reaction.userId === viewerId) current.reactedByMe = true;
        summaryMap.set(reaction.emoji, current);
      }

      let deliveryStatus: ChatMessageView['deliveryStatus'] = 'sent';
      if (message.senderId === viewerId) {
        const readCount = await this.memberState.countReadBeyond({
          groupId: GLOBAL_CHAT_GROUP_ID,
          messageId: message.id,
          excludeUserId: viewerId,
        });
        if (readCount > 0) {
          deliveryStatus = 'read';
        } else {
          const deliveredCount = await this.memberState.countDeliveredBeyond({
            groupId: GLOBAL_CHAT_GROUP_ID,
            messageId: message.id,
            excludeUserId: viewerId,
          });
          deliveryStatus = deliveredCount > 0 ? 'delivered' : 'sent';
        }
      }

      views.push({
        id: message.id,
        groupId: message.groupId,
        senderId: message.senderId,
        senderName: sender?.name ?? 'Member',
        senderRole: sender?.role ?? 'member',
        senderPhotoUrl: sender?.photoUrl ?? '',
        clientId: message.clientId,
        type: message.type,
        body: message.body,
        gifUrl: message.gifUrl,
        createdAt: message.createdAt.toISOString(),
        reactions: [...summaryMap.values()],
        deliveryStatus,
      });
    }
    return views;
  }
}
