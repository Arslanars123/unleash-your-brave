/**
 * Clean orphan / stale purchase rows for an email so checkout eligibility
 * matches the current login account.
 *
 * Usage: npx tsx scripts/clean-email-orphans.ts devarsulan@gmail.com
 */
import { closeMongo, connectMongo, getDb } from '../src/db/mongo.js';
import { MongoUserRepository } from '../src/db/repositories/mongo-user.repository.js';
import { MongoMembershipPurchaseRepository } from '../src/db/repositories/mongo-membership-purchase.repository.js';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npx tsx scripts/clean-email-orphans.ts <email>');
    process.exit(1);
  }

  await connectMongo();
  const db = getDb();
  const users = new MongoUserRepository();
  const purchases = new MongoMembershipPurchaseRepository();

  const user = await users.findByEmail(email);
  console.log(
    'Current user:',
    user
      ? { id: user.id, name: user.name, membershipId: user.membershipId, status: user.status }
      : null,
  );

  const allByEmail = await db
    .collection('membership_purchases')
    .find({ email })
    .toArray();

  console.log(
    'Purchases by email (before):',
    allByEmail.map((p) => ({
      id: p.id,
      eventId: p.eventId,
      membershipName: p.membershipName,
      paymentStatus: p.paymentStatus,
      userId: p.userId,
      matchesCurrent: user ? p.userId === user.id : false,
    })),
  );

  // Delete purchases whose userId is missing or not the current account.
  let removed = 0;
  for (const row of allByEmail) {
    const ownerId = String(row.userId ?? '');
    const owner = ownerId ? await users.findById(ownerId) : null;
    const isOrphan = !owner;
    const belongsToSomeoneElse = Boolean(user && ownerId && ownerId !== user.id);

    if (isOrphan || belongsToSomeoneElse) {
      const filter =
        row.id != null
          ? { id: row.id }
          : row._id != null
            ? { _id: row._id }
            : { email, userId: ownerId, eventId: row.eventId };
      const result = await db.collection('membership_purchases').deleteOne(filter);
      if (result.deletedCount) {
        removed += 1;
        console.log('Deleted purchase', {
          id: row.id ?? row._id,
          eventId: row.eventId,
          membershipName: row.membershipName,
          userId: row.userId,
          reason: isOrphan ? 'orphan-user' : 'other-user-id',
        });
      }
    }
  }

  // Also drop check-ins / form submissions for missing users on this email's leftover ids.
  const staleUserIds = [
    ...new Set(
      allByEmail
        .map((p) => String(p.userId ?? ''))
        .filter((id) => id && (!user || id !== user.id)),
    ),
  ];
  for (const staleId of staleUserIds) {
    const owner = await users.findById(staleId);
    if (owner) continue;
    const ci = await db.collection('check_ins').deleteMany({ userId: staleId });
    const subs = await db.collection('checkin_form_submissions').deleteMany({ userId: staleId });
    const pending = await db.collection('checkin_pending_scans').deleteMany({ userId: staleId });
    console.log('Cleaned stale user side-data', {
      userId: staleId,
      checkIns: ci.deletedCount,
      submissions: subs.deletedCount,
      pendingScans: pending.deletedCount,
    });
  }

  const after = await db.collection('membership_purchases').find({ email }).toArray();
  console.log(
    'Purchases by email (after):',
    after.map((p) => ({
      id: p.id,
      eventId: p.eventId,
      membershipName: p.membershipName,
      userId: p.userId,
    })),
  );
  console.log(`Removed ${removed} purchase row(s).`);

  // Keep repository import used for consistency / future.
  void purchases;

  await closeMongo();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
