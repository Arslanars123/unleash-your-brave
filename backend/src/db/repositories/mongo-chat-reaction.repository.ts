import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { ChatReactionRepository } from '../../modules/chat/chat.repository.js';
import type { ChatReaction } from '../../modules/chat/chat.types.js';

export class MongoChatReactionRepository implements ChatReactionRepository {
  private get collection(): Collection<MongoDoc<ChatReaction>> {
    return getDb().collection<MongoDoc<ChatReaction>>('chat_reactions');
  }

  async upsert(reaction: ChatReaction): Promise<ChatReaction> {
    const existing = fromDoc<ChatReaction>(
      await this.collection.findOne({
        messageId: reaction.messageId,
        userId: reaction.userId,
      } as Filter<MongoDoc<ChatReaction>>),
    );

    if (existing) {
      await this.collection.updateOne(
        { _id: existing.id },
        { $set: { emoji: reaction.emoji, createdAt: reaction.createdAt } },
      );
      return { ...existing, emoji: reaction.emoji, createdAt: reaction.createdAt };
    }

    const created: ChatReaction = { ...reaction, id: reaction.id || randomUUID() };
    await this.collection.insertOne(toDoc(created));
    return created;
  }

  async remove(messageId: string, userId: string): Promise<void> {
    await this.collection.deleteOne({
      messageId,
      userId,
    } as Filter<MongoDoc<ChatReaction>>);
  }

  async listForMessages(messageIds: string[]): Promise<ChatReaction[]> {
    if (messageIds.length === 0) return [];
    const docs = await this.collection
      .find({ messageId: { $in: messageIds } } as Filter<MongoDoc<ChatReaction>>)
      .toArray();
    return fromDocs<ChatReaction>(docs);
  }
}
