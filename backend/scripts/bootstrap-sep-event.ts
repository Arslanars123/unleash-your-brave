/**
 * Bootstrap Sep 10–12 edition + speaker/sponsor (devarsulan@gmail.com) + session.
 * Uses the same admin APIs as the dashboard.
 *
 * Usage: npx tsx scripts/bootstrap-sep-event.ts
 */
const API = 'https://pcbha9tkkh.ap-southeast-2.awsapprunner.com/api/v1';
const ADMIN_EMAIL = 'admin@unleashyourbrave.com';
const ADMIN_PASSWORD = 'Admin123!';
const EMAIL = 'devarsulan@gmail.com';
const PERSON_NAME = 'Arslan Zaheer';

type Json = Record<string, unknown>;

async function adminToken(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = (await res.json()) as Json;
  const token = ((json.data as Json)?.tokens as Json)?.accessToken as string;
  if (!token) throw new Error('Admin login failed');
  return token;
}

async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function dataOf(json: Json): Json {
  return (json.data as Json) ?? {};
}

async function main(): Promise<void> {
  const token = await adminToken();
  console.log('Admin OK');

  // 1) Membership
  console.log('Creating Gold Pass membership...');
  const membershipRes = await api('POST', '/memberships', token, {
    name: 'Gold Pass',
    price: 777,
    description: 'Full event access',
    features: ['Full 3-Day Experience', 'Lunch each day', 'App access'],
    paymentPlanNote: '',
    featured: true,
    tierRank: 1,
    sortOrder: 1,
    billingKind: 'one_time',
    valueLink: '',
  });
  if (membershipRes.status !== 201 && membershipRes.status !== 200) {
    throw new Error(`Membership create failed: ${JSON.stringify(membershipRes.json)}`);
  }
  const membershipId = String(dataOf(membershipRes.json).id);
  console.log('  membershipId', membershipId);

  // 2) Speaker
  console.log('Creating speaker...');
  const speakerRes = await api('POST', '/speakers', token, {
    name: PERSON_NAME,
    email: EMAIL,
    title: 'Keynote Speaker',
    description: 'Leadership and personal development.',
    photo: '',
  });
  if (speakerRes.status !== 201 && speakerRes.status !== 200) {
    throw new Error(`Speaker create failed: ${JSON.stringify(speakerRes.json)}`);
  }
  const speakerId = String(dataOf(speakerRes.json).id);
  console.log('  speakerId', speakerId);

  // 3) Sponsor
  console.log('Creating sponsor...');
  const sponsorRes = await api('POST', '/sponsors', token, {
    name: PERSON_NAME,
    email: EMAIL,
    description: 'Event sponsor',
    image: '',
    offers: [],
  });
  if (sponsorRes.status !== 201 && sponsorRes.status !== 200) {
    throw new Error(`Sponsor create failed: ${JSON.stringify(sponsorRes.json)}`);
  }
  const sponsorId = String(dataOf(sponsorRes.json).id);
  console.log('  sponsorId', sponsorId);

  // 4) Schedule event Sep 10–12
  console.log('Scheduling Sep 10–12 event...');
  const scheduleRes = await api('POST', '/events/schedule', token, {
    days: [
      { date: '2026-09-10', label: 'Day 1' },
      { date: '2026-09-11', label: 'Day 2' },
      { date: '2026-09-12', label: 'Day 3' },
    ],
    copyDetailsFromPrevious: false,
    tagline: 'Three days. One transformation.',
    description:
      'A luxury personal development and leadership conference for ambitious women ready to scale and step into their power.',
    venueName: 'The Vinoy Resort & Golf Club, Autograph Collection',
    venueAddress: '501 5th Ave NE',
    venueCity: 'St. Petersburg, FL',
    latitude: 27.773056,
    longitude: -82.631111,
    coverImage: '',
    published: true,
    notifyAttendees: false,
    sponsorIds: [sponsorId],
    membershipIds: [membershipId],
    speakerIds: [],
  });
  if (scheduleRes.status !== 201 && scheduleRes.status !== 200) {
    throw new Error(`Schedule failed: ${JSON.stringify(scheduleRes.json)}`);
  }
  const event = dataOf(scheduleRes.json);
  const eventId = String(event.id);
  console.log('  eventId', eventId);
  console.log('  dates', event.startDate, '→', event.endDate);

  // 5) Check-in waiver
  console.log('Creating check-in waiver...');
  const waiverRes = await api('PUT', `/checkin-forms/by-event/${eventId}`, token, {
    title: 'Check-in waiver',
    description: '',
    requireSignature: true,
    isActive: true,
    fields: [
      {
        label: 'I agree to the event terms and waiver',
        type: 'yes_no',
        required: true,
      },
    ],
  });
  if (waiverRes.status !== 200 && waiverRes.status !== 201) {
    throw new Error(`Waiver failed: ${JSON.stringify(waiverRes.json)}`);
  }
  console.log('  waiver OK');

  // 6) Session with speaker (Day 1 opening keynote)
  console.log('Creating session...');
  const sessionRes = await api('POST', '/sessions', token, {
    eventId,
    kind: 'session',
    name: 'Opening Keynote: Unleash Your Brave',
    description: 'Kickoff keynote with Arslan Zaheer.',
    speakerId,
    eventDayNumber: 1,
    startTime: '09:00',
    endTime: '10:00',
    location: 'Main Ballroom',
    membershipIds: [membershipId],
    materials: [],
  });
  if (sessionRes.status !== 201 && sessionRes.status !== 200) {
    throw new Error(`Session create failed: ${JSON.stringify(sessionRes.json)}`);
  }
  console.log('  sessionId', dataOf(sessionRes.json).id);

  // Ensure associations include sponsor + membership (+ speaker if supported)
  await api('PUT', `/events/${eventId}/associations`, token, {
    sponsorIds: [sponsorId],
    membershipIds: [membershipId],
    speakerIds: [speakerId],
  });

  console.log('\n=== DONE ===');
  console.log({
    eventId,
    membershipId,
    speakerId,
    sponsorId,
    email: EMAIL,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
