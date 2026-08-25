import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { getDb } from '../mongo.js';

export type AssociationKind = 'speaker' | 'sponsor' | 'membership';

export interface EventAssociation {
  id: string;
  eventId: string;
  kind: AssociationKind;
  entityId: string;
  /** Event-specific sponsor offers JSON (sponsors only). */
  offersJson?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function collection(): Collection<EventAssociation & { _id: string }> {
  return getDb().collection('event_associations');
}

function toRow(doc: (EventAssociation & { _id: string }) | null): EventAssociation | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

export class MongoEventAssociationRepository {
  async ensureIndexes(): Promise<void> {
    await collection().createIndexes([
      {
        key: { eventId: 1, kind: 1, entityId: 1 },
        unique: true,
        name: 'event_associations_unique',
      },
      { key: { entityId: 1, kind: 1 }, name: 'event_associations_entity' },
      { key: { eventId: 1, kind: 1 }, name: 'event_associations_event_kind' },
    ]);
  }

  async listEntityIds(eventId: string, kind: AssociationKind): Promise<string[]> {
    const docs = await collection()
      .find({ eventId, kind })
      .project({ entityId: 1 })
      .toArray();
    return docs.map((doc) => doc.entityId);
  }

  async listByEvent(eventId: string): Promise<EventAssociation[]> {
    const docs = await collection().find({ eventId }).toArray();
    return docs.map((doc) => toRow(doc)!);
  }

  async isLinked(eventId: string, kind: AssociationKind, entityId: string): Promise<boolean> {
    const count = await collection().countDocuments({ eventId, kind, entityId }, { limit: 1 });
    return count > 0;
  }

  async link(
    eventId: string,
    kind: AssociationKind,
    entityId: string,
    offersJson?: unknown,
  ): Promise<EventAssociation> {
    const existing = await collection().findOne({ eventId, kind, entityId });
    if (existing) {
      if (offersJson !== undefined) {
        await collection().updateOne(
          { _id: existing._id },
          { $set: { offersJson, updatedAt: new Date() } },
        );
        return toRow({ ...existing, offersJson, updatedAt: new Date() })!;
      }
      return toRow(existing)!;
    }

    const now = new Date();
    const row: EventAssociation & { _id: string } = {
      _id: randomUUID(),
      id: '',
      eventId,
      kind,
      entityId,
      ...(offersJson !== undefined ? { offersJson } : {}),
      createdAt: now,
      updatedAt: now,
    };
    row.id = row._id;
    await collection().insertOne(row);
    return toRow(row)!;
  }

  async unlink(eventId: string, kind: AssociationKind, entityId: string): Promise<boolean> {
    const result = await collection().deleteOne({ eventId, kind, entityId });
    return result.deletedCount === 1;
  }

  async setLinks(
    eventId: string,
    kind: AssociationKind,
    entityIds: string[],
  ): Promise<void> {
    const unique = [...new Set(entityIds.filter(Boolean))];
    const existing = await this.listEntityIds(eventId, kind);
    const toAdd = unique.filter((id) => !existing.includes(id));
    const toRemove = existing.filter((id) => !unique.includes(id));

    await Promise.all(toAdd.map((entityId) => this.link(eventId, kind, entityId)));
    await Promise.all(toRemove.map((entityId) => this.unlink(eventId, kind, entityId)));
  }

  async deleteByEvent(eventId: string): Promise<number> {
    const result = await collection().deleteMany({ eventId });
    return result.deletedCount;
  }

  async findLink(
    eventId: string,
    kind: AssociationKind,
    entityId: string,
  ): Promise<EventAssociation | null> {
    return toRow(await collection().findOne({ eventId, kind, entityId }));
  }

  /**
   * One-time style backfill: create joins from legacy entity.eventId fields.
   */
  async backfillFromLegacy(): Promise<{ speakers: number; sponsors: number; memberships: number }> {
    const db = getDb();
    let speakers = 0;
    let sponsors = 0;
    let memberships = 0;

    const speakerDocs = await db
      .collection('speakers')
      .find({ eventId: { $type: 'string' } })
      .project({ _id: 1, eventId: 1 })
      .toArray();
    for (const doc of speakerDocs) {
      await this.link(String(doc.eventId), 'speaker', String(doc._id));
      speakers += 1;
    }

    const sponsorDocs = await db
      .collection('sponsors')
      .find({ eventId: { $type: 'string' } })
      .project({ _id: 1, eventId: 1, offers: 1 })
      .toArray();
    for (const doc of sponsorDocs) {
      await this.link(String(doc.eventId), 'sponsor', String(doc._id), doc.offers ?? []);
      sponsors += 1;
    }

    const membershipDocs = await db
      .collection('memberships')
      .find({ eventId: { $type: 'string' } })
      .project({ _id: 1, eventId: 1 })
      .toArray();
    for (const doc of membershipDocs) {
      await this.link(String(doc.eventId), 'membership', String(doc._id));
      memberships += 1;
    }

    return { speakers, sponsors, memberships };
  }
}
