export interface Speaker {
  id: string;
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
  name: string;
  email: string;
  title: string;
  description: string;
  photo: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpeakerInput {
  eventId: string;
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
}
