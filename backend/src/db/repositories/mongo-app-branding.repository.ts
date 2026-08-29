import type { Collection } from 'mongodb';
import { fromDoc, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { AppBranding } from '../../modules/app-branding/app-branding.types.js';

export interface AppBrandingRepository {
  get(): Promise<AppBranding>;
  save(branding: AppBranding): Promise<AppBranding>;
}

export class MongoAppBrandingRepository implements AppBrandingRepository {
  private get collection(): Collection<MongoDoc<AppBranding>> {
    return getDb().collection<MongoDoc<AppBranding>>('app_branding');
  }

  async get(): Promise<AppBranding> {
    const doc = fromDoc<AppBranding>(
      await this.collection.findOne({ _id: 'default' } as never),
    );
    if (doc) {
      return {
        ...doc,
        id: 'default',
        homeCoverImage: doc.homeCoverImage ?? '',
        supportEmail: doc.supportEmail?.trim() || 'dedee@fittoprofit.com',
        supportPhone: doc.supportPhone ?? '',
      };
    }

    const created: AppBranding = {
      id: 'default',
      homeCoverImage: '',
      supportEmail: 'dedee@fittoprofit.com',
      supportPhone: '',
      updatedAt: new Date(),
    };
    await this.collection.insertOne(toDoc(created));
    return created;
  }

  async save(branding: AppBranding): Promise<AppBranding> {
    const next: AppBranding = {
      ...branding,
      id: 'default',
      updatedAt: new Date(),
    };
    await this.collection.replaceOne({ _id: 'default' }, toDoc(next), {
      upsert: true,
    });
    return next;
  }
}
