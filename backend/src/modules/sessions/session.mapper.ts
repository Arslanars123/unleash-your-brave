import type {
  PublicSession,
  PublicSessionMaterial,
  Session,
  SessionFeedbackSummary,
  SessionMaterial,
  SessionSpeakerSummary,
} from './session.types.js';

export function toPublicMaterial(material: SessionMaterial): PublicSessionMaterial {
  return {
    id: material.id,
    type: material.type,
    title: material.title,
    url: material.url,
  };
}

export function toPublicSession(
  session: Session,
  speaker: SessionSpeakerSummary | null,
  feedbackSummary: SessionFeedbackSummary = { averageRating: 0, ratingsCount: 0 },
): PublicSession {
  return {
    id: session.id,
    eventId: session.eventId,
    kind: session.kind ?? 'session',
    name: session.name,
    description: session.description,
    speakerId: session.speakerId ?? null,
    address: session.address ?? '',
    speaker,
    eventDayNumber: session.eventDayNumber,
    startTime: session.startTime,
    endTime: session.endTime,
    location: session.location,
    membershipIds: [...(session.membershipIds ?? [])],
    materials: session.materials.map(toPublicMaterial),
    feedbackEnabled: session.feedbackEnabled !== false,
    feedbackSummary,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
