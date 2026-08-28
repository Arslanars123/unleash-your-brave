import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type {
  PaginatedResult,
  SponsorRepository,
} from '../../modules/sponsors/sponsor.repository.js';
import type { ListSponsorsQuery, Sponsor } from '../../modules/sponsors/sponsor.types.js';

export class MongoSponsorRepository implements SponsorRepository {
  private get collection(): Collection<MongoDoc<Sponsor>> {
    return getDb().collection<MongoDoc<Sponsor>>('sponsors');
  }

  async findById(id: string): Promise<Sponsor | null> {
    return fromDoc<Sponsor>(await this.collection.findOne({ _id: id }));
  }

  async findByEmail(email: string): Promise<Sponsor | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    return fromDoc<Sponsor>(await this.collection.findOne({ email: normalized }));
  }

  async list(query: ListSponsorsQuery): Promise<PaginatedResult<Sponsor>> {
    const filter: Filter<MongoDoc<Sponsor>> = {};
    if (query.eventId) filter.eventId = query.eventId;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [containsCi('name', search), containsCi('email', search), containsCi('description', search)];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ name: 1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<Sponsor>(docs), total };
  }

  async listByIds(ids: string[]): Promise<Sponsor[]> {
    if (ids.length === 0) return [];
    const docs = await this.collection
      .find({ _id: { $in: [...new Set(ids)] } })
      .sort({ name: 1 })
      .toArray();
    return fromDocs<Sponsor>(docs);
  }

  async create(data: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sponsor> {
    const now = new Date();
    const sponsor: Sponsor = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(sponsor));
    return sponsor;
  }

  async update(
    id: string,
    data: Partial<Omit<Sponsor, 'id' | 'createdAt'>>,
  ): Promise<Sponsor | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: Sponsor = {
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
