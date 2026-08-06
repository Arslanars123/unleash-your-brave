import type { UserRole } from '../users/user.types.js';

export type AnnouncementKind = 'manual' | 'system';
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'cancelled';
/** all = every active member; roles = selected roles as “groups”; users = specific attendees */
export type AudienceType = 'all' | 'roles' | 'users';

export interface Announcement {
  id: string;
  title: string;
  description: string;
  kind: AnnouncementKind;
  status: AnnouncementStatus;
  audienceType: AudienceType;
  audienceRoles: UserRole[];
  audienceUserIds: string[];
  /** When status is scheduled — UTC instant to publish + push. */
  scheduledAt: Date | null;
  publishedAt: Date | null;
  sendPush: boolean;
  /** Dedup key for system/countdown notices, e.g. `countdown:daily:2026-09-03`. */
  systemKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicAnnouncement {
  id: string;
  title: string;
  description: string;
  kind: AnnouncementKind;
  status: AnnouncementStatus;
  audienceType: AudienceType;
  audienceRoles: UserRole[];
  audienceUserIds: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  sendPush: boolean;
  systemKey: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on attendee feed items. */
  isRead?: boolean;
}

export interface CreateAnnouncementInput {
  title: string;
  description?: string;
  /** immediate = publish now; scheduled = wait for scheduledAt; draft = save only */
  delivery: 'immediate' | 'scheduled' | 'draft';
  audienceType?: AudienceType;
  audienceRoles?: UserRole[];
  audienceUserIds?: string[];
  scheduledAt?: string | null;
  sendPush?: boolean;
}

export interface UpdateAnnouncementInput {
  title?: string;
  description?: string;
  delivery?: 'immediate' | 'scheduled' | 'draft';
  audienceType?: AudienceType;
  audienceRoles?: UserRole[];
  audienceUserIds?: string[];
  scheduledAt?: string | null;
  sendPush?: boolean;
  status?: AnnouncementStatus;
}

export interface ListAnnouncementsQuery {
  page: number;
  perPage: number;
  search?: string;
  status?: AnnouncementStatus;
  kind?: AnnouncementKind;
}

export interface ListFeedQuery {
  page: number;
  perPage: number;
  /** unread | read | all */
  filter?: 'all' | 'unread' | 'read';
}

export interface AnnouncementRead {
  id: string;
  announcementId: string;
  userId: string;
  readAt: Date;
}

export type CountdownCadence = 'once' | 'daily' | 'weekly';

export interface CountdownRule {
  id: string;
  /** Human label for admin UI */
  label: string;
  enabled: boolean;
  /**
   * Days before event start (UTC calendar day).
   * Example: 7 = one week before; 1 = day before.
   */
  offsetDays: number;
  cadence: CountdownCadence;
  titleTemplate: string;
  bodyTemplate: string;
}

export interface CountdownSettings {
  id: string;
  /** Master switch — when false, no automatic countdown notices are created. */
  enabled: boolean;
  rules: CountdownRule[];
  updatedAt: Date;
}

export interface UpdateCountdownSettingsInput {
  enabled?: boolean;
  rules?: CountdownRule[];
}
