import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';
import { env } from '../../config/env.js';
import { logger } from '../../core/logger.js';
import type { DeviceTokenRepository } from './chat.repository.js';
import type { ChatMessageView, DevicePlatform } from './chat.types.js';

let initialized = false;

function initFirebaseAdmin(): boolean {
  if (initialized) return true;
  if (admin.apps.length > 0) {
    initialized = true;
    return true;
  }

  try {
    if (env.firebase.serviceAccountJson) {
      const credentials = JSON.parse(env.firebase.serviceAccountJson) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });
      initialized = true;
      logger.info('Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
      return true;
    }

    if (env.firebase.serviceAccountPath) {
      const raw = readFileSync(env.firebase.serviceAccountPath, 'utf8');
      const credentials = JSON.parse(raw) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });
      initialized = true;
      logger.info(
        { path: env.firebase.serviceAccountPath },
        'Firebase Admin initialized from service account file',
      );
      return true;
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize Firebase Admin');
    return false;
  }

  logger.warn(
    'Firebase Admin is not configured — push notifications will be skipped until FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH is set',
  );
  return false;
}

export class PushNotificationService {
  constructor(private readonly tokens: DeviceTokenRepository) {}

  async registerToken(input: {
    userId: string;
    token: string;
    platform: DevicePlatform;
  }) {
    return this.tokens.upsert({
      id: randomUUID(),
      userId: input.userId,
      token: input.token.trim(),
      platform: input.platform,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async unregisterToken(userId: string, token: string): Promise<void> {
    await this.tokens.removeByUserAndToken(userId, token);
  }

  async notifyNewChatMessage(params: {
    senderUserId: string;
    groupId: string;
    groupName: string;
    message: ChatMessageView;
  }): Promise<{ attempted: number; success: number; pruned: number }> {
    const devices = await this.tokens.listAllExceptUser(params.senderUserId);
    const title = params.groupName;
    const body =
      params.message.type === 'gif'
        ? 'New message'
        : `${params.message.senderName}: ${params.message.body.slice(0, 140)}`;

    return this.sendToDevices({
      devices,
      title,
      body,
      data: {
        type: 'chat.message',
        groupId: params.groupId,
        messageId: params.message.id,
        senderId: params.message.senderId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      androidChannelId: 'chat_messages',
      androidTag: `chat_${params.groupId}`,
      threadId: params.groupId,
    });
  }

  /** Generic multicast to specific users (announcements, system notices, etc.). */
  async notifyUsers(params: {
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ attempted: number; success: number; pruned: number }> {
    if (params.userIds.length === 0) {
      return { attempted: 0, success: 0, pruned: 0 };
    }
    const devices = await this.tokens.listByUserIds(params.userIds);
    return this.sendToDevices({
      devices,
      title: params.title,
      body: params.body.slice(0, 180),
      data: {
        type: 'announcement',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        ...(params.data ?? {}),
      },
      androidChannelId: 'announcements',
      androidTag: params.data?.announcementId
        ? `announcement_${params.data.announcementId}`
        : 'announcement',
      threadId: 'announcements',
    });
  }

  private async sendToDevices(params: {
    devices: Array<{ token: string }>;
    title: string;
    body: string;
    data: Record<string, string>;
    androidChannelId: string;
    androidTag: string;
    threadId: string;
  }): Promise<{ attempted: number; success: number; pruned: number }> {
    if (!initFirebaseAdmin()) {
      return { attempted: 0, success: 0, pruned: 0 };
    }
    if (params.devices.length === 0) {
      return { attempted: 0, success: 0, pruned: 0 };
    }

    let success = 0;
    let pruned = 0;

    for (let i = 0; i < params.devices.length; i += 500) {
      const chunk = params.devices.slice(i, i + 500);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk.map((d) => d.token),
        notification: { title: params.title, body: params.body },
        data: params.data,
        android: {
          priority: 'high',
          notification: {
            channelId: params.androidChannelId,
            tag: params.androidTag,
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            icon: 'ic_stat_uyb',
            color: '#F04E93',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              alert: { title: params.title, body: params.body },
              sound: 'default',
              badge: 1,
              // Prefer thread-id for grouping; avoid content-available on alert
              // pushes (that flag is for silent background updates).
              'thread-id': params.threadId,
            },
          },
        },
      });

      success += response.successCount;
      response.responses.forEach((result, index) => {
        if (result.success) return;
        const code = result.error?.code ?? '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          void this.tokens.removeByToken(chunk[index]!.token);
          pruned += 1;
        } else {
          logger.warn(
            { code, message: result.error?.message },
            'FCM send failed for device token',
          );
        }
      });
    }

    return { attempted: params.devices.length, success, pruned };
  }
}
