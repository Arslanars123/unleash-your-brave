import { NotFoundError } from '../../core/errors/app-error.js';
import { logger } from '../../core/logger.js';
import type { PushNotificationService } from '../chat/push.service.js';
import type { EventService } from '../events/event.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { RealtimeHub } from '../realtime/realtime.hub.js';
import type { UserRepository } from '../users/user.repository.js';
import type { User, UserRole } from '../users/user.types.js';
import type { AnnouncementReadRepository } from '../../db/repositories/mongo-announcement-read.repository.js';
import type { CountdownSettingsRepository } from '../../db/repositories/mongo-countdown-settings.repository.js';
import { normalizeAnnouncement, toPublicAnnouncement } from './announcement.mapper.js';
import type { AnnouncementRepository, PaginatedResult } from './announcement.repository.js';
import type {
  Announcement,
  CountdownSettings,
  CreateAnnouncementInput,
  ListAnnouncementsQuery,
  ListFeedQuery,
  PublicAnnouncement,
  UpdateAnnouncementInput,
  UpdateCountdownSettingsInput,
} from './announcement.types.js';

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenUtc(from: Date, to: Date): number {
  const a = startOfUtcDay(from).getTime();
  const b = startOfUtcDay(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function applyTemplate(
  template: string,
  vars: { daysLeft: number; eventName: string; eventDate: string },
): string {
  return template
    .replaceAll('{{daysLeft}}', String(vars.daysLeft))
    .replaceAll('{{eventName}}', vars.eventName)
    .replaceAll('{{eventDate}}', vars.eventDate);
}

function effectiveFeedRoles(
  user: Pick<User, 'role'> & { speakerId?: string | null; sponsorId?: string | null },
): UserRole[] {
  const roles = new Set<UserRole>([user.role]);
  if (user.speakerId) roles.add('speaker');
  if (user.sponsorId) roles.add('sponsor');
  return [...roles];
}

function isSpeakerOrSponsorPortalUser(
  user: Pick<User, 'role' | 'speakerId' | 'sponsorId'>,
): boolean {
  return (
    user.role === 'speaker' ||
    user.role === 'sponsor' ||
    Boolean(user.speakerId) ||
    Boolean(user.sponsorId)
  );
}

export class AnnouncementService {
  constructor(
    private readonly announcements: AnnouncementRepository,
    private readonly reads: AnnouncementReadRepository,
    private readonly countdownSettings: CountdownSettingsRepository,
    private readonly users: UserRepository,
    private readonly events: EventService,
    private readonly push: PushNotificationService,
    private readonly mail?: MailService,
    private readonly realtime?: RealtimeHub,
  ) {}

  async list(query: ListAnnouncementsQuery): Promise<PaginatedResult<PublicAnnouncement>> {
    const { items, total } = await this.announcements.list(query);
    return { items: items.map((item) => toPublicAnnouncement(normalizeAnnouncement(item))), total };
  }

  async getById(id: string): Promise<PublicAnnouncement> {
    return toPublicAnnouncement(await this.requireAnnouncement(id));
  }

  async getFeed(
    user: Pick<User, 'id' | 'role'> & { speakerId?: string | null; sponsorId?: string | null },
    query: ListFeedQuery,
  ): Promise<PaginatedResult<PublicAnnouncement> & { unreadCount: number }> {
    const roles = effectiveFeedRoles(user);
    const { items, total } = await this.announcements.listPublishedForUser({
      userId: user.id,
      roles,
      page: 1,
      perPage: 500,
    });
    const ids = items.map((item) => item.id);
    const readIds = await this.reads.listReadIds(user.id, ids);
    const unreadCount = ids.filter((id) => !readIds.has(id)).length;

    let filtered = items.map((item) =>
      toPublicAnnouncement(item, { isRead: readIds.has(item.id) }),
    );
    if (query.filter === 'unread') filtered = filtered.filter((item) => !item.isRead);
    if (query.filter === 'read') filtered = filtered.filter((item) => item.isRead);

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
      unreadCount,
    };
  }

  async getUnreadCount(
    user: Pick<User, 'id' | 'role'> & { speakerId?: string | null; sponsorId?: string | null },
  ): Promise<number> {
    const roles = effectiveFeedRoles(user);
    const { items } = await this.announcements.listPublishedForUser({
      userId: user.id,
      roles,
      page: 1,
      perPage: 500,
    });
    const readIds = await this.reads.listReadIds(
      user.id,
      items.map((item) => item.id),
    );
    return items.filter((item) => !readIds.has(item.id)).length;
  }

  async markRead(
    announcementId: string,
    user: Pick<User, 'id' | 'role'> & { speakerId?: string | null; sponsorId?: string | null },
  ): Promise<PublicAnnouncement> {
    const announcement = await this.requireAnnouncement(announcementId);
    if (announcement.status !== 'published') {
      throw new NotFoundError('Announcement');
    }
    await this.reads.markRead(announcementId, user.id);
    return toPublicAnnouncement(announcement, { isRead: true });
  }

  async create(input: CreateAnnouncementInput): Promise<PublicAnnouncement> {
    const now = new Date();
    const delivery = input.delivery ?? 'immediate';
    const status =
      delivery === 'immediate' ? 'published' : delivery === 'scheduled' ? 'scheduled' : 'draft';

    const created = await this.announcements.create({
      title: input.title,
      description: input.description ?? '',
      kind: 'manual',
      status,
      audienceType: input.audienceType ?? 'all',
      audienceRoles: input.audienceRoles?.length ? input.audienceRoles : ['member'],
      audienceUserIds: input.audienceUserIds ?? [],
      scheduledAt:
        delivery === 'scheduled' && input.scheduledAt
          ? new Date(input.scheduledAt)
          : null,
      publishedAt: delivery === 'immediate' ? now : null,
      sendPush: input.sendPush ?? true,
      systemKey: null,
    });

    if (delivery === 'immediate') {
      await this.dispatchPush(created);
    }

    return toPublicAnnouncement(created);
  }

  /**
   * Creates a deduped system announcement (feed + optional push).
   * Used for event pause / resume / date changes and countdown automation.
   */
  async publishSystemNotice(input: {
    systemKey: string;
    title: string;
    description: string;
    sendPush?: boolean;
  }): Promise<PublicAnnouncement | null> {
    const existing = await this.announcements.findBySystemKey(input.systemKey);
    if (existing) return null;

    const announcement = await this.announcements.create({
      title: input.title,
      description: input.description,
      kind: 'system',
      status: 'published',
      audienceType: 'all',
      audienceRoles: ['member'],
      audienceUserIds: [],
      scheduledAt: null,
      publishedAt: new Date(),
      sendPush: input.sendPush ?? true,
      systemKey: input.systemKey,
    });

    if (announcement.sendPush) {
      await this.dispatchPush(announcement);
    }

    logger.info({ systemKey: input.systemKey }, 'Published system announcement');
    return toPublicAnnouncement(announcement);
  }

  async update(id: string, input: UpdateAnnouncementInput): Promise<PublicAnnouncement> {
    const existing = await this.requireAnnouncement(id);
    if (existing.kind === 'system' && input.title === undefined && input.description === undefined) {
      // allow status cancel etc.
    }

    const patch: Partial<Omit<Announcement, 'id' | 'createdAt'>> = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.audienceType !== undefined ? { audienceType: input.audienceType } : {}),
      ...(input.audienceRoles !== undefined ? { audienceRoles: input.audienceRoles } : {}),
      ...(input.audienceUserIds !== undefined ? { audienceUserIds: input.audienceUserIds } : {}),
      ...(input.sendPush !== undefined ? { sendPush: input.sendPush } : {}),
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
        : {}),
    };

    if (input.delivery === 'immediate' && existing.status !== 'published') {
      patch.status = 'published';
      patch.publishedAt = new Date();
      patch.scheduledAt = null;
    } else if (input.delivery === 'scheduled') {
      patch.status = 'scheduled';
      patch.publishedAt = null;
    } else if (input.delivery === 'draft') {
      patch.status = 'draft';
      patch.publishedAt = null;
    } else if (input.status) {
      patch.status = input.status;
      if (input.status === 'published' && !existing.publishedAt) {
        patch.publishedAt = new Date();
      }
    }

    const updated = await this.announcements.update(id, patch);
    if (!updated) throw new NotFoundError('Announcement');

    if (
      updated.status === 'published' &&
      existing.status !== 'published' &&
      updated.sendPush
    ) {
      await this.dispatchPush(updated);
    }

    return toPublicAnnouncement(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.announcements.delete(id))) {
      throw new NotFoundError('Announcement');
    }
  }

  async getCountdownSettings(): Promise<CountdownSettings> {
    return this.countdownSettings.get();
  }

  async updateCountdownSettings(
    input: UpdateCountdownSettingsInput,
  ): Promise<CountdownSettings> {
    const current = await this.countdownSettings.get();
    return this.countdownSettings.save({
      ...current,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.rules !== undefined ? { rules: input.rules } : {}),
    });
  }

  /** Called by the background scheduler. */
  async processDueScheduled(): Promise<number> {
    const due = await this.announcements.listDueScheduled(new Date());
    let published = 0;
    for (const item of due) {
      const updated = await this.announcements.update(item.id, {
        status: 'published',
        publishedAt: new Date(),
      });
      if (!updated) continue;
      published += 1;
      if (updated.sendPush) {
        await this.dispatchPush(updated);
      }
    }
    return published;
  }

  /** Called by the background scheduler. */
  async processCountdownAutomation(): Promise<number> {
    const settings = await this.countdownSettings.get();
    if (!settings.enabled) return 0;

    let latest;
    try {
      latest = await this.events.getCurrent();
    } catch {
      return 0;
    }
    if (!latest || latest.status === 'ended' || latest.status === 'paused' || latest.paused) {
      return 0;
    }

    const eventStart = new Date(latest.startDate);
    const today = new Date();
    const daysLeft = daysBetweenUtc(today, eventStart);
    if (daysLeft < 0) return 0;

    const eventName = latest.name || 'Unleash Your Brave';
    const eventDate = eventStart.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const eventDayKey = startOfUtcDay(eventStart).toISOString().slice(0, 10);
    const todayKey = startOfUtcDay(today).toISOString().slice(0, 10);
    let created = 0;

    for (const rule of settings.rules) {
      if (!rule.enabled) continue;

      let shouldSend = false;
      let systemKey = '';

      if (rule.cadence === 'once' && daysLeft === rule.offsetDays) {
        shouldSend = true;
        systemKey = `countdown:once:${rule.id}:${eventDayKey}`;
      } else if (rule.cadence === 'daily' && daysLeft <= rule.offsetDays && daysLeft >= 3) {
        // Days 3–offset: dedicated once rules cover day 1–2 (and day 7).
        shouldSend = true;
        systemKey = `countdown:daily:${rule.id}:${todayKey}:${eventDayKey}`;
      } else if (rule.cadence === 'weekly' && daysLeft > 7) {
        // Fire on the weekday of the event start, once per calendar week.
        const weekKey = isoWeekKey(today);
        shouldSend = true;
        systemKey = `countdown:weekly:${rule.id}:${weekKey}:${eventDayKey}`;
      }

      if (!shouldSend || !systemKey) continue;
      const existing = await this.announcements.findBySystemKey(systemKey);
      if (existing) continue;

      const title = applyTemplate(rule.titleTemplate, { daysLeft, eventName, eventDate });
      const description = applyTemplate(rule.bodyTemplate, { daysLeft, eventName, eventDate });
      const announcement = await this.announcements.create({
        title,
        description,
        kind: 'system',
        status: 'published',
        audienceType: 'all',
        audienceRoles: ['member'],
        audienceUserIds: [],
        scheduledAt: null,
        publishedAt: new Date(),
        sendPush: true,
        systemKey,
      });
      await this.dispatchPush(announcement);
      created += 1;
      logger.info({ systemKey, daysLeft }, 'Created countdown announcement');
    }

    return created;
  }

  private async resolveAudienceUserIds(announcement: Announcement): Promise<string[]> {
    if (announcement.audienceType === 'users') {
      return announcement.audienceUserIds;
    }
    if (announcement.audienceType === 'roles') {
      return this.users.listActiveIdsByRoles(announcement.audienceRoles as UserRole[]);
    }
    // all → active members (attendees)
    return this.users.listActiveIdsByRoles(['member']);
  }

  private async dispatchPush(announcement: Announcement): Promise<void> {
    try {
      const userIds = await this.resolveAudienceUserIds(announcement);
      await Promise.all([
        this.sendPush(announcement, userIds),
        this.sendSpeakerSponsorEmails(announcement, userIds),
        this.publishRealtime(announcement, userIds),
      ]);
    } catch (error) {
      logger.error({ err: error, announcementId: announcement.id }, 'Announcement dispatch failed');
    }
  }

  private async sendPush(announcement: Announcement, userIds: string[]): Promise<void> {
    try {
      const result = await this.push.notifyUsers({
        userIds,
        title: announcement.title,
        body: announcement.description || announcement.title,
        data: {
          type: 'announcement',
          announcementId: announcement.id,
          kind: announcement.kind,
        },
      });
      logger.info(
        {
          announcementId: announcement.id,
          attempted: result.attempted,
          success: result.success,
        },
        'Announcement push dispatched',
      );
    } catch (error) {
      logger.error({ err: error, announcementId: announcement.id }, 'Announcement push failed');
    }
  }

  /** Speakers/sponsors in the audience get the full announcement text by email. */
  private async sendSpeakerSponsorEmails(
    announcement: Announcement,
    userIds: string[],
  ): Promise<void> {
    if (!this.mail || userIds.length === 0) return;
    let sent = 0;
    for (const userId of userIds) {
      try {
        const user = await this.users.findById(userId);
        if (!user || user.status !== 'active' || !user.email) continue;
        if (!isSpeakerOrSponsorPortalUser(user)) continue;

        const body = (announcement.description || '').trim() || announcement.title;
        const text = [
          `Hi ${user.name || 'there'},`,
          '',
          announcement.title,
          '',
          body,
          '',
          '— Unleash Your Brave',
        ].join('\n');
        const html = `
          <p>Hi ${escapeHtml(user.name || 'there')},</p>
          <h2 style="margin:16px 0 8px">${escapeHtml(announcement.title)}</h2>
          <div style="white-space:pre-wrap;line-height:1.5">${escapeHtml(body)}</div>
          <p style="margin-top:24px;color:#666">— Unleash Your Brave</p>
        `;
        await this.mail.send({
          to: user.email,
          subject: announcement.title,
          text,
          html,
        });
        sent += 1;
      } catch (error) {
        logger.error(
          { err: error, announcementId: announcement.id, userId },
          'Announcement email failed',
        );
      }
    }
    if (sent > 0) {
      logger.info({ announcementId: announcement.id, sent }, 'Announcement emails sent');
    }
  }

  private publishRealtime(announcement: Announcement, userIds: string[]): void {
    if (!this.realtime || userIds.length === 0) return;
    this.realtime.publish({
      type: 'announcement.published',
      payload: {
        announcementId: announcement.id,
        title: announcement.title,
        description: announcement.description ?? '',
        kind: announcement.kind,
        userIds,
      },
    });
  }

  private async requireAnnouncement(id: string): Promise<Announcement> {
    const announcement = await this.announcements.findById(id);
    if (!announcement) throw new NotFoundError('Announcement');
    return normalizeAnnouncement(announcement);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function isoWeekKey(date: Date): string {
  const target = startOfUtcDay(date);
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
