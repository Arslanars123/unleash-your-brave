import type { PublicSpeaker, Speaker } from './speaker.types.js';

export function toPublicSpeaker(
  speaker: Speaker,
  eventIds: string[] = speaker.eventId ? [speaker.eventId] : [],
): PublicSpeaker {
  const unique = [...new Set(eventIds.filter(Boolean))];
  const primary = unique[0] ?? speaker.eventId ?? '';
  return {
    id: speaker.id,
    eventId: primary,
    eventIds: unique,
    name: speaker.name,
    email: speaker.email ?? '',
    title: speaker.title,
    description: speaker.description,
    photo: speaker.photo,
    createdAt: speaker.createdAt.toISOString(),
    updatedAt: speaker.updatedAt.toISOString(),
  };
}
