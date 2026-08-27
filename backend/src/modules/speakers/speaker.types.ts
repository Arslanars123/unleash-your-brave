export interface Speaker {
  id: string;
  /**
   * Legacy home edition. Prefer event_associations for multi-event links.
   * Empty string when the speaker is shared-only.
   */
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
  /** Edition context when listed for an event; otherwise legacy/home eventId. */
  eventId: string;
  name: string;
  email: string;
  title: string;
  description: string;
  photo: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpeakerInput {
  /** When set, the speaker is linked to this edition (and stored as legacy home). */
  eventId?: string;
  name: string;
  email?: string;
  title?: string;
  description?: string;
  photo?: string;
}

export interface UpdateSpeakerInput {
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
