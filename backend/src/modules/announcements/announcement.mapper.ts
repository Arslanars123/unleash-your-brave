import type { PublicAnnouncement, Announcement } from './announcement.types.js';

export function toPublicAnnouncement(announcement: Announcement): PublicAnnouncement {
  return {
    id: announcement.id,
    title: announcement.title,
    description: announcement.description,
    createdAt: announcement.createdAt.toISOString(),
    updatedAt: announcement.updatedAt.toISOString(),
  };
}
