export const SESSION_KINDS = ['session', 'event'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export type SessionMaterialType = 'pdf' | 'video' | 'doc' | 'link';

export interface SessionMaterial {
  id: string;
  type: SessionMaterialType;
  title: string;
  url: string;
}

export interface PublicSessionMaterial {
  id: string;
  type: SessionMaterialType;
  title: string;
  url: string;
}

export interface SessionMaterialInput {
  id?: string;
  type: SessionMaterialType;
  title: string;
  url: string;
}

export interface SessionSpeakerSummary {
  id: string;
  name: string;
  title: string;
  photo: string;
}

export interface Session {
  id: string;
  eventId: string;
  /** `session` = speaker talk; `event` = extra activity (VIP dinner, etc.). */
  kind: SessionKind;
  name: string;
  description: string;
  speakerId: string | null;
  /** Optional street / venue address for extra activities. */
  address: string;
  /** 1-based day number on this edition's schedule. */
  eventDayNumber: number;
  /** Wall-clock start on the event day, `HH:mm` (24h). Empty if unset. */
  startTime: string;
  /** Wall-clock end on the event day, `HH:mm` (24h). Empty if unset. */
  endTime: string;
  /** Room / area label, e.g. "Main Ballroom". */
  location: string;
  /** Empty = visible to all memberships; non-empty = restricted to these tiers. */
  membershipIds: string[];
  materials: SessionMaterial[];
  /** When true, members can leave a rating/review for this session. */
  feedbackEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionFeedbackSummary {
  averageRating: number;
  ratingsCount: number;
}

export interface PublicSession {
  id: string;
  eventId: string;
  kind: SessionKind;
  name: string;
  description: string;
  speakerId: string | null;
  address: string;
  speaker: SessionSpeakerSummary | null;
  eventDayNumber: number;
  startTime: string;
  endTime: string;
  location: string;
  membershipIds: string[];
  materials: PublicSessionMaterial[];
  feedbackEnabled: boolean;
  feedbackSummary: SessionFeedbackSummary;
  /** True when the viewer’s membership does not include this item (agenda still lists it). */
  accessRestricted: boolean;
  /** True when materials are hidden by membership or feature policy. */
  materialsLocked?: boolean;
  /** True when reviews are blocked by membership, feature policy, or event not started. */
  reviewsLocked?: boolean;
  /** True when agenda/session details are locked by feature policy. */
  agendaLocked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionInput {
  eventId: string;
  kind?: SessionKind;
  name: string;
  description?: string;
  speakerId?: string | null;
  address?: string;
  eventDayNumber: number;
  startTime?: string;
  endTime?: string;
  location?: string;
  membershipIds?: string[];
  materials?: SessionMaterialInput[];
  feedbackEnabled?: boolean;
}

export interface UpdateSessionInput {
  kind?: SessionKind;
  name?: string;
  description?: string;
  speakerId?: string | null;
  address?: string;
  eventDayNumber?: number;
  startTime?: string;
  endTime?: string;
  location?: string;
  membershipIds?: string[];
  materials?: SessionMaterialInput[];
  feedbackEnabled?: boolean;
}

export interface ListSessionsQuery {
  page: number;
  perPage: number;
  search?: string;
  eventId?: string;
  speakerId?: string;
  eventDayNumber?: number;
  /** When set, only sessions open to any of these memberships (or unrestricted). */
  accessibleToMembershipId?: string | null;
  /** Prefer this when the viewer may map to multiple equivalent memberships. */
  accessibleToMembershipIds?: string[];
}
