import { logger } from '../core/logger.js';
import { getDb } from './mongo.js';

/**
 * Deletes edition-owned content for an event while preserving attendee accounts
 * and purchase/order history (membership_purchases, store_orders, users).
 */
export async function cascadeDeleteEventData(eventId: string): Promise<void> {
  const db = getDb();
  const now = new Date();

  const [membershipIds, speakerIds, sponsorIds, sessionIds] = await Promise.all([
    db
      .collection('memberships')
      .find({ eventId })
      .project({ _id: 1 })
      .toArray()
      .then((rows) => rows.map((row) => String(row._id))),
    db
      .collection('speakers')
      .find({ eventId })
      .project({ _id: 1 })
      .toArray()
      .then((rows) => rows.map((row) => String(row._id))),
    db
      .collection('sponsors')
      .find({ eventId })
      .project({ _id: 1 })
      .toArray()
      .then((rows) => rows.map((row) => String(row._id))),
    db
      .collection('sessions')
      .find({ eventId })
      .project({ _id: 1 })
      .toArray()
      .then((rows) => rows.map((row) => String(row._id))),
  ]);

  // Keep attendee (and portal) user documents — only clear links to deleted edition data.
  if (membershipIds.length > 0) {
    await db.collection('users').updateMany(
      { membershipId: { $in: membershipIds } },
      {
        $set: {
          membershipId: null,
          membershipStatus: null,
          membershipExpiresAt: null,
          updatedAt: now,
        },
      },
    );
  }

  if (speakerIds.length > 0) {
    await db.collection('users').updateMany(
      { speakerId: { $in: speakerIds } },
      [
        {
          $set: {
            speakerId: null,
            updatedAt: now,
            role: {
              $cond: [{ $eq: ['$role', 'speaker'] }, 'member', '$role'],
            },
          },
        },
      ],
    );
  }

  if (sponsorIds.length > 0) {
    await db.collection('users').updateMany(
      { sponsorId: { $in: sponsorIds } },
      [
        {
          $set: {
            sponsorId: null,
            updatedAt: now,
            role: {
              $cond: [{ $eq: ['$role', 'sponsor'] }, 'member', '$role'],
            },
          },
        },
      ],
    );
  }

  if (sessionIds.length > 0) {
    await db.collection('session_feedback').deleteMany({ sessionId: { $in: sessionIds } });
  }

  await Promise.all([
    db.collection('sessions').deleteMany({ eventId }),
    db.collection('event_associations').deleteMany({ eventId }),
    // Shared speakers / sponsors / memberships are kept for reuse on other editions.
    // Store catalog and orders are global — not tied to event editions.
    db.collection('checkins').deleteMany({ eventId }),
    db.collection('checkin_form_submissions').deleteMany({ eventId }),
    db.collection('checkin_forms').deleteMany({ eventId }),
    db.collection('announcements').deleteMany({
      systemKey: { $regex: `:${eventId}(?::|$)` },
    }),
  ]);

  // Intentionally NOT deleting: users, membership_purchases, store_orders.
  logger.info(
    {
      eventId,
      memberships: membershipIds.length,
      speakers: speakerIds.length,
      sponsors: sponsorIds.length,
      sessions: sessionIds.length,
    },
    'Cascaded edition data delete (attendees preserved)',
  );
}
