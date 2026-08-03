import type { Collection } from 'mongodb';
import { fromDoc, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { ChatGroupRepository } from '../../modules/chat/chat.repository.js';
import type { ChatGroup } from '../../modules/chat/chat.types.js';

export class MongoChatGroupRepository implements ChatGroupRepository {
  private get collection(): Collection<MongoDoc<ChatGroup>> {
    return getDb().collection<MongoDoc<ChatGroup>>('chat_groups');
  }

  async getById(id: string): Promise<ChatGroup | null> {
    return fromDoc<ChatGroup>(await this.collection.findOne({ _id: id }));
  }

  async ensure(group: ChatGroup): Promise<ChatGroup> {
    const existing = await this.getById(group.id);
    if (existing) return existing;
    await this.collection.insertOne(toDoc(group));
    return group;
  }
}
