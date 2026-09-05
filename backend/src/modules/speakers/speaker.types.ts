export interface Speaker {
  id: string;
  /** Primary / home event edition (first linked event). */
  eventId: string;
  name: string;
  /** Portal login email (optional; linked user account when set). */
  email: string;
  title: string;
  description: string;
  photo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicSpeaker {
  id: string;
  eventId: string;
  /** All event editions this speaker is associated with. */
  eventIds: string[];
  name: string;
  email: string;
  title: string;
  description: string;
  photo: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpeakerInput {
  /** Preferred: one or more event editions. */
  eventIds?: string[];
  /** Legacy single-event field (normalized into eventIds). */
  eventId?: string;
  name: string;
  email?: string;
  title?: string;
  description?: string;
  photo?: string;
}

export interface UpdateSpeakerInput {
  eventIds?: string[];
  eventId?: string;
  name?: string;
  email?: string;
  title?: string;
  description?: string;
  photo?: string;
}

export interface ListSpeakersQuery {
  page: number;
  perPage: number;
  search?: string;
  eventId?: string;
  /** When true with no eventId, return the shared library (all speakers). */
  library?: boolean;
}

export interface LinkedSpeakerEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  sessionCount: number;
}
