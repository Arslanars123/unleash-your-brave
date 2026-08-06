import type { Collection } from 'mongodb';
import { fromDoc, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type {
  CountdownRule,
  CountdownSettings,
} from '../../modules/announcements/announcement.types.js';

export const DEFAULT_COUNTDOWN_RULES: CountdownRule[] = [
  {
    id: 'weekly_far',
    label: 'Weekly while more than a week away',
    enabled: true,
    offsetDays: 8,
    cadence: 'weekly',
    titleTemplate: 'Your event is coming up',
    bodyTemplate:
      'Only {{daysLeft}} days left until {{eventName}}. We can’t wait to see you!',
  },
  {
    id: 'exactly_7',
    label: 'Exactly 7 days before',
    enabled: true,
    offsetDays: 7,
    cadence: 'once',
    titleTemplate: 'One week to go',
    bodyTemplate:
      'Only 7 days left until {{eventName}}. We are excited to see you!',
  },
  {
    id: 'daily_under_7',
    label: 'Daily when under 7 days',
    enabled: true,
    offsetDays: 6,
    cadence: 'daily',
    titleTemplate: '{{daysLeft}} days to go',
    bodyTemplate:
      'Only {{daysLeft}} days left until {{eventName}}. Get ready!',
  },
  {
    id: 'two_days',
    label: '2 days before',
    enabled: true,
    offsetDays: 2,
    cadence: 'once',
    titleTemplate: 'Almost there',
    bodyTemplate: 'Only 2 days left until {{eventName}}. See you soon!',
  },
  {
    id: 'one_day',
    label: '1 day before',
    enabled: true,
    offsetDays: 1,
    cadence: 'once',
    titleTemplate: 'Tomorrow is the day',
    bodyTemplate: 'Only 1 day left until {{eventName}}. We are excited to see you!',
  },
];

export interface CountdownSettingsRepository {
  get(): Promise<CountdownSettings>;
  save(settings: CountdownSettings): Promise<CountdownSettings>;
}

export class MongoCountdownSettingsRepository implements CountdownSettingsRepository {
  private get collection(): Collection<MongoDoc<CountdownSettings>> {
    return getDb().collection<MongoDoc<CountdownSettings>>('countdown_settings');
  }

  async get(): Promise<CountdownSettings> {
    const doc = fromDoc<CountdownSettings>(
      await this.collection.findOne({ _id: 'default' } as never),
    );
    if (doc) {
      return {
        ...doc,
        id: 'default',
        rules: doc.rules?.length ? doc.rules : DEFAULT_COUNTDOWN_RULES,
      };
    }

    const created: CountdownSettings = {
      id: 'default',
      enabled: true,
      rules: DEFAULT_COUNTDOWN_RULES,
      updatedAt: new Date(),
    };
    await this.collection.insertOne(toDoc(created));
    return created;
  }

  async save(settings: CountdownSettings): Promise<CountdownSettings> {
    const next: CountdownSettings = {
      ...settings,
      id: 'default',
      updatedAt: new Date(),
    };
    await this.collection.replaceOne({ _id: 'default' }, toDoc(next), {
      upsert: true,
    });
    return next;
  }
}
