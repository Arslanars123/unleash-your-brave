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
      { key: { membershipId: 1 }, name: 'users_membershipId' },
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
    database.collection('store_categories').createIndexes([
      { key: { eventId: 1, sortOrder: 1 }, name: 'store_categories_event_sort' },
      { key: { eventId: 1, isActive: 1 }, name: 'store_categories_event_active' },
    ]),
    database.collection('store_products').createIndexes([
      { key: { eventId: 1, sortOrder: 1 }, name: 'store_products_event_sort' },
      { key: { eventId: 1, categoryId: 1 }, name: 'store_products_event_category' },
      { key: { eventId: 1, isActive: 1 }, name: 'store_products_event_active' },
      { key: { eventId: 1, featured: 1 }, name: 'store_products_event_featured' },
    ]),
    database.collection('memberships').createIndexes([
      { key: { eventId: 1 }, name: 'memberships_eventId' },
      { key: { name: 1 }, name: 'memberships_name' },
    ]),
    database.collection('sessions').createIndexes([
      { key: { eventId: 1, eventDayNumber: 1, startTime: 1 }, name: 'sessions_event_day_time' },
      { key: { speakerId: 1 }, name: 'sessions_speakerId' },
      { key: { membershipIds: 1 }, name: 'sessions_membershipIds' },
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
    database.collection('chat_groups').createIndexes([
      { key: { createdAt: -1 }, name: 'chat_groups_createdAt' },
    ]),
    database.collection('chat_messages').createIndexes([
      { key: { groupId: 1, createdAt: -1, _id: -1 }, name: 'chat_messages_group_created' },
      {
        key: { groupId: 1, clientId: 1 },
        unique: true,
        name: 'chat_messages_group_client_unique',
      },
      { key: { senderId: 1 }, name: 'chat_messages_senderId' },
    ]),
    database.collection('chat_member_state').createIndexes([
      {
        key: { groupId: 1, userId: 1 },
        unique: true,
        name: 'chat_member_state_group_user_unique',
      },
    ]),
    database.collection('chat_reactions').createIndexes([
      {
        key: { messageId: 1, userId: 1 },
        unique: true,
        name: 'chat_reactions_message_user_unique',
      },
      { key: { messageId: 1 }, name: 'chat_reactions_messageId' },
    ]),
    database.collection('device_tokens').createIndexes([
      { key: { token: 1 }, unique: true, name: 'device_tokens_token_unique' },
      { key: { userId: 1 }, name: 'device_tokens_userId' },
    ]),
  ]);
}
