/**
 * Re-issue + email the mobile app invite for an existing account
 * (e.g. speaker/sponsor who purchased but never got the first-time code).
 *
 * Usage: npx tsx scripts/resend-app-invite.ts user@example.com
 */
import { createContainer } from '../src/app/container.js';
import { env } from '../src/config/env.js';
import { closeMongo } from '../src/db/mongo.js';
import { MongoUserRepository } from '../src/db/repositories/mongo-user.repository.js';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npx tsx scripts/resend-app-invite.ts <email>');
    process.exit(1);
  }

  const container = await createContainer();
  const found = await new MongoUserRepository().findByEmail(email);
  if (!found) {
    console.error(`No user found for ${email}`);
    await closeMongo();
    process.exit(1);
  }

  const upsert = await container.services.userService.upsertFromPurchase({
    email,
    firstName: found.firstName,
    lastName: found.lastName,
    name: found.name,
  });

  if (!upsert.inviteCode) {
    console.log(
      `No invite issued for ${email} (password already set — they can log in normally).`,
    );
    await closeMongo();
    return;
  }

  const expiresAt = new Date(Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000);
  const result = await container.services.mailService.sendInviteCode({
    to: email,
    name: upsert.user.name,
    inviteCode: upsert.inviteCode,
    expiresAt,
  });

  console.log(
    JSON.stringify(
      {
        email,
        role: found.role,
        membershipId: found.membershipId,
        inviteSent: result.sent,
        inviteSkipped: result.skipped ?? false,
        inviteCode: upsert.inviteCode,
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
