import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { DeviceTokenRepository } from '../../modules/chat/chat.repository.js';
import type { DeviceToken } from '../../modules/chat/chat.types.js';

export class MongoDeviceTokenRepository implements DeviceTokenRepository {
  private get collection(): Collection<MongoDoc<DeviceToken>> {
    return getDb().collection<MongoDoc<DeviceToken>>('device_tokens');
  }

  async upsert(token: DeviceToken): Promise<DeviceToken> {
    const byToken = fromDoc<DeviceToken>(
      await this.collection.findOne({ token: token.token } as Filter<MongoDoc<DeviceToken>>),
    );

    const now = new Date();
    if (byToken) {
      const updated: DeviceToken = {
        ...byToken,
        userId: token.userId,
        platform: token.platform,
        updatedAt: now,
      };
      await this.collection.updateOne(
        { _id: byToken.id },
        {
          $set: {
            userId: updated.userId,
            platform: updated.platform,
            updatedAt: updated.updatedAt,
          },
        },
      );
      return updated;
    }

    const created: DeviceToken = {
      ...token,
      id: token.id || randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(toDoc(created));
    return created;
  }

  async listByUserIds(userIds: string[]): Promise<DeviceToken[]> {
    if (userIds.length === 0) return [];
    const docs = await this.collection
      .find({ userId: { $in: userIds } } as Filter<MongoDoc<DeviceToken>>)
      .toArray();
    return fromDocs<DeviceToken>(docs);
  }

  async removeByToken(token: string): Promise<void> {
    await this.collection.deleteOne({ token } as Filter<MongoDoc<DeviceToken>>);
  }

  async removeByUserAndToken(userId: string, token: string): Promise<void> {
    await this.collection.deleteOne({
      userId,
      token,
    } as Filter<MongoDoc<DeviceToken>>);
  }

  async listAllExceptUser(userId: string): Promise<DeviceToken[]> {
    const docs = await this.collection
      .find({ userId: { $ne: userId } } as Filter<MongoDoc<DeviceToken>>)
      .toArray();
    return fromDocs<DeviceToken>(docs);
  }
}
