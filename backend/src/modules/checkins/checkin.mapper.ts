import type { CheckIn, PublicCheckIn } from './checkin.types.js';
import type { PublicUser } from '../users/user.types.js';

export function toPublicCheckIn(
  checkIn: CheckIn,
  user?: PublicUser | null,
): PublicCheckIn {
  return {
    id: checkIn.id,
    eventId: checkIn.eventId,
    userId: checkIn.userId,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    checkedInBy: checkIn.checkedInBy,
    createdAt: checkIn.createdAt.toISOString(),
    updatedAt: checkIn.updatedAt.toISOString(),
    ...(user !== undefined ? { user } : {}),
  };
}
