import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { ChatMemberStateRepository } from '../../modules/chat/chat.repository.js';
import type { ChatMemberState, ChatMessage } from '../../modules/chat/chat.types.js';

export class MongoChatMemberStateRepository implements ChatMemberStateRepository {
  private get collection(): Collection<MongoDoc<ChatMemberState>> {
    return getDb().collection<MongoDoc<ChatMemberState>>('chat_member_state');
  }

  private get messages(): Collection<MongoDoc<ChatMessage>> {
    return getDb().collection<MongoDoc<ChatMessage>>('chat_messages');
  }

  async get(groupId: string, userId: string): Promise<ChatMemberState | null> {
    return fromDoc<ChatMemberState>(
      await this.collection.findOne({ groupId, userId } as Filter<MongoDoc<ChatMemberState>>),
    );
  }

  async upsert(state: ChatMemberState): Promise<ChatMemberState> {
    const existing = await this.get(state.groupId, state.userId);
    const toSave: ChatMemberState = existing
      ? { ...state, id: existing.id }
      : state;
    await this.collection.updateOne(
      { groupId: toSave.groupId, userId: toSave.userId } as Filter<MongoDoc<ChatMemberState>>,
      {
        $set: {
          groupId: toSave.groupId,
          userId: toSave.userId,
          lastDeliveredMessageId: toSave.lastDeliveredMessageId,
          lastReadMessageId: toSave.lastReadMessageId,
          lastReadAt: toSave.lastReadAt,
          updatedAt: toSave.updatedAt,
        },
        $setOnInsert: { _id: toSave.id },
      },
      { upsert: true },
    );
    return toSave;
  }

  async listByGroup(groupId: string): Promise<ChatMemberState[]> {
    const docs = await this.collection
      .find({ groupId } as Filter<MongoDoc<ChatMemberState>>)
      .toArray();
    return fromDocs<ChatMemberState>(docs);
  }

  async countDeliveredBeyond(params: {
    groupId: string;
    messageId: string;
    excludeUserId: string;
  }): Promise<number> {
    return this.countCursorAtOrAfter({
      groupId: params.groupId,
      messageId: params.messageId,
      excludeUserId: params.excludeUserId,
      field: 'lastDeliveredMessageId',
    });
  }

  async countReadBeyond(params: {
    groupId: string;
    messageId: string;
    excludeUserId: string;
  }): Promise<number> {
    return this.countCursorAtOrAfter({
      groupId: params.groupId,
      messageId: params.messageId,
      excludeUserId: params.excludeUserId,
      field: 'lastReadMessageId',
    });
  }

  private async countCursorAtOrAfter(params: {
    groupId: string;
    messageId: string;
    excludeUserId: string;
    field: 'lastDeliveredMessageId' | 'lastReadMessageId';
  }): Promise<number> {
    const target = fromDoc<ChatMessage>(await this.messages.findOne({ _id: params.messageId }));
    if (!target) return 0;

    const states = await this.collection
      .find({
        groupId: params.groupId,
        userId: { $ne: params.excludeUserId },
        [params.field]: { $ne: null },
      } as Filter<MongoDoc<ChatMemberState>>)
      .toArray();

    const cursorIds = states
      .map((s) => s[params.field])
      .filter((id): id is string => typeof id === 'string');

    if (cursorIds.length === 0) return 0;

    const cursorMessages = await this.messages
      .find({ _id: { $in: cursorIds } } as Filter<MongoDoc<ChatMessage>>)
      .toArray();

    const byId = new Map(
      cursorMessages.map((doc) => {
        const msg = fromDoc<ChatMessage>(doc)!;
        return [msg.id, msg.createdAt] as const;
      }),
    );

    let count = 0;
    for (const state of states) {
      const cursorId = state[params.field];
      if (!cursorId) continue;
      const cursorAt = byId.get(cursorId);
      if (!cursorAt) continue;
      if (
        cursorAt.getTime() > target.createdAt.getTime() ||
        (cursorAt.getTime() === target.createdAt.getTime() && cursorId >= target.id)
      ) {
        count += 1;
      }
    }
    return count;
  }
}
