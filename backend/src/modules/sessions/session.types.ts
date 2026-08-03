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
  name: string;
  description: string;
  speakerId: string;
  /** 1-based day number on this edition's schedule. */
  eventDayNumber: number;
  /** Wall-clock start on the event day, `HH:mm` (24h). Empty if unset. */
  startTime: string;
  /** Wall-clock end on the event day, `HH:mm` (24h). Empty if unset. */
  endTime: string;
  /** Room / area label, e.g. "Main Ballroom". */
  location: string;
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
  name: string;
  description: string;
  speakerId: string;
  speaker: SessionSpeakerSummary | null;
  eventDayNumber: number;
  startTime: string;
  endTime: string;
  location: string;
  materials: PublicSessionMaterial[];
  feedbackEnabled: boolean;
  feedbackSummary: SessionFeedbackSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionInput {
  eventId: string;
  name: string;
  description?: string;
  speakerId: string;
  eventDayNumber: number;
  startTime?: string;
  endTime?: string;
  location?: string;
  materials?: SessionMaterialInput[];
  feedbackEnabled?: boolean;
}

export interface UpdateSessionInput {
  name?: string;
  description?: string;
  speakerId?: string;
  eventDayNumber?: number;
  startTime?: string;
  endTime?: string;
  location?: string;
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
}
