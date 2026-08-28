/**
 * Link speaker/sponsor profiles by email and optionally resend portal invite.
 *
 * Usage: npx tsx scripts/link-portal-profiles.ts user@example.com [--invite]
 */
import { createContainer } from '../src/app/container.js';
import { env } from '../src/config/env.js';
import { closeMongo } from '../src/db/mongo.js';
import { MongoUserRepository } from '../src/db/repositories/mongo-user.repository.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase();
  const resendInvite = args.includes('--invite');

  if (!email) {
    console.error('Usage: npx tsx scripts/link-portal-profiles.ts <email> [--invite]');
    process.exit(1);
  }

  const container = await createContainer();
  const users = new MongoUserRepository();
  const found = await users.findByEmail(email);
  if (!found) {
    console.error(`No user found for ${email}`);
    await closeMongo();
    process.exit(1);
  }

  const linked = await container.services.userService.linkPortalProfilesByEmail(
    found.id,
    email,
  );

  let inviteCode: string | undefined;
  if (resendInvite && found.mustChangePassword) {
    const upsert = await container.services.userService.upsertPortalAccount({
      email,
      name: linked.name,
      role: linked.speakerId ? 'speaker' : linked.sponsorId ? 'sponsor' : 'speaker',
      speakerId: linked.speakerId,
      sponsorId: linked.sponsorId,
      issueInvite: true,
    });
    inviteCode = upsert.inviteCode;
    if (inviteCode) {
      const expiresAt = new Date(Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000);
      await container.services.mailService.sendInviteCode({
        to: email,
        name: linked.name,
        inviteCode,
        expiresAt,
        dualAccess: true,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        email,
        userId: linked.id,
        role: linked.role,
        speakerId: linked.speakerId,
        sponsorId: linked.sponsorId,
        inviteSent: Boolean(inviteCode),
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
