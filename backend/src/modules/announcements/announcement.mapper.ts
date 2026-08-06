import type {
  Announcement,
  PublicAnnouncement,
} from './announcement.types.js';

export function toPublicAnnouncement(
  announcement: Announcement,
  extras: { isRead?: boolean } = {},
): PublicAnnouncement {
  return {
    id: announcement.id,
    title: announcement.title,
    description: announcement.description,
    kind: announcement.kind ?? 'manual',
    status: announcement.status ?? 'published',
    audienceType: announcement.audienceType ?? 'all',
    audienceRoles: announcement.audienceRoles ?? ['member'],
    audienceUserIds: announcement.audienceUserIds ?? [],
    scheduledAt: announcement.scheduledAt
      ? announcement.scheduledAt.toISOString()
      : null,
    publishedAt: announcement.publishedAt
      ? announcement.publishedAt.toISOString()
      : null,
    sendPush: announcement.sendPush ?? true,
    systemKey: announcement.systemKey ?? null,
    createdAt: announcement.createdAt.toISOString(),
    updatedAt: announcement.updatedAt.toISOString(),
    ...(extras.isRead !== undefined ? { isRead: extras.isRead } : {}),
  };
}

/** Normalize legacy Mongo docs that only had title/description. */
export function normalizeAnnouncement(raw: Announcement): Announcement {
  return {
    ...raw,
    kind: raw.kind ?? 'manual',
    status: raw.status ?? 'published',
    audienceType: raw.audienceType ?? 'all',
    audienceRoles: raw.audienceRoles?.length ? raw.audienceRoles : ['member'],
    audienceUserIds: raw.audienceUserIds ?? [],
    scheduledAt: raw.scheduledAt ?? null,
    publishedAt: raw.publishedAt ?? raw.createdAt ?? null,
    sendPush: raw.sendPush ?? true,
    systemKey: raw.systemKey ?? null,
  };
}
