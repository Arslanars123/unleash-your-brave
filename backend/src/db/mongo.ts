import { type Db, MongoClient } from 'mongodb';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(env.mongodbUri);
  await client.connect();
  db = client.db();
  await ensureIndexes(db);
  logger.info({ db: db.databaseName }, 'Connected to MongoDB');
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB has not been connected yet. Call connectMongo() first.');
  }
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

/**
 * Escape regex special characters for case-insensitive substring search.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsCi(field: string, search: string): Record<string, unknown> {
  return { [field]: { $regex: escapeRegex(search), $options: 'i' } };
}

async function ensureIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection('users').createIndexes([
      { key: { email: 1 }, unique: true, name: 'users_email_unique' },
      { key: { status: 1 }, name: 'users_status' },
      { key: { role: 1 }, name: 'users_role' },
      { key: { createdAt: -1 }, name: 'users_createdAt' },
    ]),
    database.collection('events').createIndexes([
      { key: { startDate: -1 }, name: 'events_startDate' },
    ]),
    database.collection('speakers').createIndexes([
      { key: { eventId: 1 }, name: 'speakers_eventId' },
      { key: { name: 1 }, name: 'speakers_name' },
    ]),
    database.collection('sponsors').createIndexes([
      { key: { eventId: 1 }, name: 'sponsors_eventId' },
      { key: { name: 1 }, name: 'sponsors_name' },
    ]),
    database.collection('sessions').createIndexes([
      { key: { eventId: 1, eventDayNumber: 1, startTime: 1 }, name: 'sessions_event_day_time' },
      { key: { speakerId: 1 }, name: 'sessions_speakerId' },
    ]),
    database.collection('session_feedback').createIndexes([
      {
        key: { sessionId: 1, userId: 1 },
        unique: true,
        name: 'session_feedback_session_user_unique',
      },
      { key: { sessionId: 1, updatedAt: -1 }, name: 'session_feedback_session_updated' },
    ]),
    database.collection('announcements').createIndexes([
      { key: { createdAt: -1 }, name: 'announcements_createdAt' },
    ]),
    database.collection('posts').createIndexes([
      { key: { createdAt: -1 }, name: 'posts_createdAt' },
      { key: { authorId: 1 }, name: 'posts_authorId' },
    ]),
    database.collection('post_likes').createIndexes([
      { key: { postId: 1, userId: 1 }, unique: true, name: 'post_likes_post_user_unique' },
      { key: { postId: 1 }, name: 'post_likes_postId' },
    ]),
    database.collection('post_comments').createIndexes([
      { key: { postId: 1, createdAt: 1 }, name: 'post_comments_post_created' },
    ]),
  ]);
}
