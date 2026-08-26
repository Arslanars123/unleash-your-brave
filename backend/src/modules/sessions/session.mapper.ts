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

export interface SessionAccessLocks {
  /** Membership-tier restriction (PASS REQUIRED). */
  accessRestricted?: boolean;
  /** Admin feature policy: hide materials. */
  materialsLocked?: boolean;
  /** Admin feature policy: disable reviews. */
  reviewsLocked?: boolean;
  /** Admin feature policy: agenda/details locked. */
  agendaLocked?: boolean;
}

export function toPublicSession(
  session: Session,
  speaker: SessionSpeakerSummary | null,
  feedbackSummary: SessionFeedbackSummary = { averageRating: 0, ratingsCount: 0 },
  access: boolean | SessionAccessLocks = false,
): PublicSession {
  const locks: SessionAccessLocks =
    typeof access === 'boolean' ? { accessRestricted: access } : access;
  const accessRestricted = Boolean(locks.accessRestricted);
  const materialsLocked = Boolean(locks.materialsLocked) || accessRestricted;
  const reviewsLocked = Boolean(locks.reviewsLocked) || accessRestricted;
  const agendaLocked = Boolean(locks.agendaLocked);

  return {
    id: session.id,
    eventId: session.eventId,
    kind: session.kind ?? 'session',
    name: session.name,
    description: agendaLocked ? '' : session.description,
    speakerId: session.speakerId ?? null,
    address: session.address ?? '',
    speaker: agendaLocked ? null : speaker,
    eventDayNumber: session.eventDayNumber,
    startTime: session.startTime,
    endTime: session.endTime,
    location: session.location,
    membershipIds: [...(session.membershipIds ?? [])],
    materials: materialsLocked ? [] : session.materials.map(toPublicMaterial),
    feedbackEnabled:
      reviewsLocked || agendaLocked ? false : session.feedbackEnabled !== false,
    feedbackSummary: agendaLocked
      ? { averageRating: 0, ratingsCount: 0 }
      : feedbackSummary,
    accessRestricted: accessRestricted || agendaLocked,
    materialsLocked,
    reviewsLocked: reviewsLocked || agendaLocked,
    agendaLocked,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
