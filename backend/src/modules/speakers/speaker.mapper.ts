import type { PublicSpeaker, Speaker } from './speaker.types.js';

export function toPublicSpeaker(speaker: Speaker): PublicSpeaker {
  return {
    id: speaker.id,
    eventId: speaker.eventId,
    name: speaker.name,
    email: speaker.email ?? '',
    title: speaker.title,
    description: speaker.description,
    photo: speaker.photo,
    createdAt: speaker.createdAt.toISOString(),
    updatedAt: speaker.updatedAt.toISOString(),
  };
}
