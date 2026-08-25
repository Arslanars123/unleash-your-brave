import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type {
  PaginatedResult,
  MembershipRepository,
} from '../../modules/memberships/membership.repository.js';
import type { ListMembershipsQuery, Membership } from '../../modules/memberships/membership.types.js';

export class MongoMembershipRepository implements MembershipRepository {
  private get collection(): Collection<MongoDoc<Membership>> {
    return getDb().collection<MongoDoc<Membership>>('memberships');
  }

  async findById(id: string): Promise<Membership | null> {
    return fromDoc<Membership>(await this.collection.findOne({ _id: id }));
  }

  async list(query: ListMembershipsQuery): Promise<PaginatedResult<Membership>> {
    const filter: Filter<MongoDoc<Membership>> = {};
    if (query.eventId) filter.eventId = query.eventId;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [containsCi('name', search), containsCi('description', search)];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ sortOrder: 1, price: 1, name: 1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<Membership>(docs), total };
  }

  async listByIds(ids: string[]): Promise<Membership[]> {
    if (ids.length === 0) return [];
    const docs = await this.collection
      .find({ _id: { $in: [...new Set(ids)] } })
      .sort({ sortOrder: 1, price: 1, name: 1 })
      .toArray();
    return fromDocs<Membership>(docs);
  }

  async create(data: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>): Promise<Membership> {
    const now = new Date();
    const membership: Membership = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(membership));
    return membership;
  }

  async update(
    id: string,
    data: Partial<Omit<Membership, 'id' | 'createdAt'>>,
  ): Promise<Membership | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: Membership = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.collection.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}
