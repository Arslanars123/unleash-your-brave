/**
 * CLIENT_TESTING_MODE — see types file header for full removal checklist.
 */
import type { Collection } from 'mongodb';
import { fromDoc, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { ClientTestingSettings } from '../../modules/client-testing/client-testing.types.js';

export interface ClientTestingRepository {
  get(): Promise<ClientTestingSettings>;
  save(settings: ClientTestingSettings): Promise<ClientTestingSettings>;
}

export class MongoClientTestingRepository implements ClientTestingRepository {
  private get collection(): Collection<MongoDoc<ClientTestingSettings>> {
    return getDb().collection<MongoDoc<ClientTestingSettings>>('client_testing_settings');
  }

  async get(): Promise<ClientTestingSettings> {
    const doc = fromDoc<ClientTestingSettings>(
      await this.collection.findOne({ _id: 'default' } as never),
    );
    if (doc) {
      return {
        ...doc,
        id: 'default',
        enabled: Boolean(doc.enabled),
        updatedBy: doc.updatedBy ?? null,
      };
    }

    const created: ClientTestingSettings = {
      id: 'default',
      enabled: false,
      updatedAt: new Date(),
      updatedBy: null,
    };
    await this.collection.insertOne(toDoc(created));
    return created;
  }

  async save(settings: ClientTestingSettings): Promise<ClientTestingSettings> {
    const next: ClientTestingSettings = {
      ...settings,
      id: 'default',
      updatedAt: new Date(),
    };
    await this.collection.replaceOne({ _id: 'default' } as never, toDoc(next), {
      upsert: true,
    });
    return next;
  }
}
