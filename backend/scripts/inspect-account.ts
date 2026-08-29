/**
 * Usage: npx tsx scripts/inspect-account.ts user@example.com
 */
import { closeMongo, connectMongo, getDb } from '../src/db/mongo.js';
import { MongoUserRepository } from '../src/db/repositories/mongo-user.repository.js';
import { MongoSpeakerRepository } from '../src/db/repositories/mongo-speaker.repository.js';
import { MongoSponsorRepository } from '../src/db/repositories/mongo-sponsor.repository.js';
import { MongoMembershipPurchaseRepository } from '../src/db/repositories/mongo-membership-purchase.repository.js';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npx tsx scripts/inspect-account.ts <email>');
    process.exit(1);
  }

  await connectMongo();
  const users = new MongoUserRepository();
  const speakers = new MongoSpeakerRepository();
  const sponsors = new MongoSponsorRepository();
  const purchases = new MongoMembershipPurchaseRepository();

  const user = await users.findByEmail(email);
  const speakerMatches = (await speakers.list({ page: 1, perPage: 100, search: email })).items;
  const sponsorMatches = (await sponsors.list({ page: 1, perPage: 100, search: email })).items;
  const events = await getDb()
    .collection('events')
    .find({})
    .project({ _id: 1, name: 1, startDate: 1, status: 1 })
    .sort({ startDate: -1 })
    .limit(15)
    .toArray();
  const memberships = await getDb()
    .collection('memberships')
    .find({})
    .project({ _id: 1, name: 1, eventId: 1, price: 1 })
    .limit(30)
    .toArray();

  const userPurchases = user ? await purchases.listByUserId(user.id) : [];

  console.log(
    JSON.stringify(
      {
        email,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              speakerId: user.speakerId,
              sponsorId: user.sponsorId,
              mustChangePassword: user.mustChangePassword,
              membershipId: user.membershipId,
              status: user.status,
            }
          : null,
        speakers: speakerMatches.map((s) => ({ id: s.id, name: s.name, email: s.email })),
        sponsors: sponsorMatches.map((s) => ({ id: s.id, name: s.name, email: s.email })),
        purchases: userPurchases.map((p) => ({
          id: p.id,
          eventId: p.eventId,
          membershipName: p.membershipName,
          paymentStatus: p.paymentStatus,
        })),
        events: events.map((e) => ({ id: e._id, name: e.name, status: e.status })),
        memberships: memberships.map((m) => ({
          id: m._id,
          name: m.name,
          eventId: m.eventId,
        })),
      },
      null,
      2,
    ),
  );

  await closeMongo();
}

main().catch(async (error) => {
  console.error(error);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
