import type { PublicUser } from '../users/user.types.js';

export interface CheckIn {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: Date;
  /** Admin user id who scanned, or null when self-service (unused for now). */
  checkedInBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicCheckIn {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: string;
  checkedInBy: string | null;
  createdAt: string;
  updatedAt: string;
  user?: PublicUser | null;
}

export interface MyCheckInQr {
  eventId: string;
  eventName: string;
  eventStatus: 'upcoming' | 'live' | 'ended';
  userId: string;
  /** Opaque signed token to encode in the QR. Valid only for this eventId. */
  token: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

export interface CheckInScanResult {
  checkIn: PublicCheckIn;
  alreadyCheckedIn: boolean;
  user: PublicUser;
}

export interface ListCheckInsQuery {
  eventId: string;
  page: number;
  perPage: number;
  search?: string;
  /** checked_in | not_checked_in | all */
  status?: 'checked_in' | 'not_checked_in' | 'all';
}

export interface CheckInStats {
  eventId: string;
  checkedInCount: number;
  attendeeCount: number;
}
