import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { ChatMessageRepository } from '../../modules/chat/chat.repository.js';
import type { ChatMessage } from '../../modules/chat/chat.types.js';

export class MongoChatMessageRepository implements ChatMessageRepository {
  private get collection(): Collection<MongoDoc<ChatMessage>> {
    return getDb().collection<MongoDoc<ChatMessage>>('chat_messages');
  }

  async create(message: ChatMessage): Promise<ChatMessage> {
    await this.collection.insertOne(toDoc(message));
    return message;
  }

  async findByClientId(groupId: string, clientId: string): Promise<ChatMessage | null> {
    return fromDoc<ChatMessage>(
      await this.collection.findOne({ groupId, clientId } as Filter<MongoDoc<ChatMessage>>),
    );
  }

  async findById(id: string): Promise<ChatMessage | null> {
    return fromDoc<ChatMessage>(await this.collection.findOne({ _id: id }));
  }

  async listBefore(params: {
    groupId: string;
    beforeCreatedAt?: Date;
    beforeId?: string;
    limit: number;
  }): Promise<ChatMessage[]> {
    const filter: Filter<MongoDoc<ChatMessage>> = { groupId: params.groupId };
    if (params.beforeCreatedAt) {
      filter.$or = [
        { createdAt: { $lt: params.beforeCreatedAt } },
        {
          createdAt: params.beforeCreatedAt,
          _id: { $lt: params.beforeId ?? '' },
        },
      ];
    }

    const docs = await this.collection
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(params.limit)
      .toArray();

    return fromDocs<ChatMessage>(docs);
  }

  async listSince(params: {
    groupId: string;
    since: Date;
    limit: number;
  }): Promise<ChatMessage[]> {
    const docs = await this.collection
      .find({
        groupId: params.groupId,
        createdAt: { $gt: params.since },
      } as Filter<MongoDoc<ChatMessage>>)
      .sort({ createdAt: 1, _id: 1 })
      .limit(params.limit)
      .toArray();

    return fromDocs<ChatMessage>(docs);
  }

  async countUnread(params: {
    groupId: string;
    userId: string;
    afterCreatedAt: Date | null;
    afterId: string | null;
  }): Promise<number> {
    const filter: Filter<MongoDoc<ChatMessage>> = {
      groupId: params.groupId,
      senderId: { $ne: params.userId },
    };

    if (params.afterCreatedAt) {
      filter.$or = [
        { createdAt: { $gt: params.afterCreatedAt } },
        {
          createdAt: params.afterCreatedAt,
          _id: { $gt: params.afterId ?? '' },
        },
      ];
    }

    return this.collection.countDocuments(filter);
  }

  async getLatest(groupId: string): Promise<ChatMessage | null> {
    const docs = await this.collection
      .find({ groupId } as Filter<MongoDoc<ChatMessage>>)
      .sort({ createdAt: -1, _id: -1 })
      .limit(1)
      .toArray();
    return fromDocs<ChatMessage>(docs)[0] ?? null;
  }
}
