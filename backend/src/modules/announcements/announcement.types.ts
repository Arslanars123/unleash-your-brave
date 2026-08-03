export interface Announcement {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicAnnouncement {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  description?: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  description?: string;
}

export interface ListAnnouncementsQuery {
  page: number;
  perPage: number;
  search?: string;
}
