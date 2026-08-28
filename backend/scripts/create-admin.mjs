import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@unleashyourbrave.com';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!';
const NAME = process.env.ADMIN_NAME ?? 'Platform Admin';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const client = new MongoClient(uri);
  await client.connect();
  const users = client.db().collection('users');

  const existing = await users.findOne({ email: EMAIL.toLowerCase() });
  if (existing) {
    console.log(`Admin already exists: ${EMAIL}`);
    await client.close();
    return;
  }

  const now = new Date();
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await users.insertOne({
    _id: id,
    email: EMAIL.toLowerCase(),
    name: NAME,
    passwordHash,
    role: 'admin',
    status: 'active',
    speakerId: null,
    sponsorId: null,
    membershipId: null,
    membershipStatus: null,
    membershipExpiresAt: null,
    renewalReminderSentAt: null,
    qrRenewalBlockedNoticeSentAt: null,
    photoUrl: '',
    title: '',
    business: '',
    industry: '',
    location: '',
    bio: '',
    goals: [],
    interests: [],
    networkingPrefs: 'open_to_all',
    linkedinUrl: '',
    instagramUrl: '',
    websiteUrl: '',
    isVip: false,
    points: 0,
    profileCompleted: false,
    inviteCodeHash: null,
    inviteCodeExpiresAt: null,
    passwordResetOtpHash: null,
    passwordResetOtpExpiresAt: null,
    mustChangePassword: false,
    ghlContactId: null,
    firstName: NAME.split(/\s+/)[0] ?? '',
    lastName: NAME.split(/\s+/).slice(1).join(' '),
    createdAt: now,
    updatedAt: now,
  });

  await client.close();
  console.log('Admin user created:');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
