/**
 * Multi-role / multi-event API test runner (production).
 * Usage: npx tsx scripts/multi-role-test.ts [step]
 */
const API = 'https://pcbha9tkkh.ap-southeast-2.awsapprunner.com/api/v1';
const EMAIL = 'zaheertech52@gmail.com';
const NAME = 'Zaheer Tech Test';
const ADMIN_EMAIL = 'admin@unleashyourbrave.com';
const ADMIN_PASSWORD = 'Admin123!';

const EVENT_A = '72b7c4fb-f9b6-4d4c-8aeb-ac53e70ff11b';
const EVENT_B = 'b0c93954-de2c-422f-a25f-f77f4b1c92ea';
const MEMBERSHIP = '37708944-5854-49d6-b416-c4e36877e780';

type Json = Record<string, unknown>;

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

async function login(email: string, password: string): Promise<{ ok: boolean; user?: Json; error?: string }> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as Json;
  if (!res.ok) {
    return { ok: false, error: String((json.error as Json)?.message ?? res.status) };
  }
  const data = json.data as Json;
  return { ok: true, user: data?.user as Json };
}

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

async function findUser(token: string): Promise<Json | null> {
  const { json } = await api('GET', `/users?search=${encodeURIComponent(EMAIL)}`, token);
  const items = (json.data as Json[]) ?? [];
  return items[0] ?? null;
}

async function snapshot(token: string, label: string): Promise<void> {
  const user = await findUser(token);
  if (!user) {
    console.log(`\n=== ${label} ===\n(no user)`);
    return;
  }
  const id = user.id as string;
  const [{ json: events }, { json: speakers }, { json: sponsors }] = await Promise.all([
    api('GET', `/users/${id}/event-records`, token),
    api('GET', `/speakers?search=${encodeURIComponent(EMAIL)}`, token),
    api('GET', `/sponsors?search=${encodeURIComponent(EMAIL)}`, token),
  ]);
  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify(
      {
        user: {
          id: user.id,
          role: user.role,
          speakerId: user.speakerId,
          sponsorId: user.sponsorId,
          mustChangePassword: user.mustChangePassword,
        },
        eventRecords: events.data,
        speakers: speakers.data,
        sponsors: sponsors.data,
      },
      null,
      2,
    ),
  );
}

async function dashboardLoginCheck(label: string, password: string): Promise<void> {
  const result = await login(EMAIL, password);
  console.log(`\n--- Dashboard login: ${label} ---`);
  console.log(result.ok ? `OK role=${result.user?.role} speakerId=${result.user?.speakerId} sponsorId=${result.user?.sponsorId}` : `FAIL: ${result.error}`);
}

async function step1(token: string): Promise<string | null> {
  console.log('\n# Step 1: Create attendee on Event A');
  const { status, json } = await api('POST', '/users', token, {
    email: EMAIL,
    name: NAME,
    role: 'member',
    eventId: EVENT_A,
    membershipId: MEMBERSHIP,
  });
  console.log('HTTP', status, JSON.stringify(json, null, 2));
  const user = ((json.data as Json)?.user as Json) ?? (await findUser(token));
  return (user?.id as string) ?? null;
}

async function step2(token: string): Promise<void> {
  console.log('\n# Step 2: Add same email to Event B');
  const { status, json } = await api('POST', '/users', token, {
    email: EMAIL,
    name: NAME,
    role: 'member',
    eventId: EVENT_B,
    membershipId: MEMBERSHIP,
  });
  console.log('HTTP', status, JSON.stringify(json, null, 2));
}

async function step3(token: string): Promise<string | null> {
  console.log('\n# Step 3: Create Speaker with same email');
  const { status, json } = await api('POST', '/speakers', token, {
    name: NAME,
    email: EMAIL,
    eventId: EVENT_A,
    title: 'Test Speaker',
  });
  console.log('HTTP', status, JSON.stringify(json, null, 2));
  return ((json.data as Json)?.id as string) ?? null;
}

async function step4(token: string): Promise<string | null> {
  console.log('\n# Step 4: Create Sponsor with same email');
  const { status, json } = await api('POST', '/sponsors', token, {
    name: NAME,
    email: EMAIL,
    eventId: EVENT_A,
    description: 'Test sponsor',
  });
  console.log('HTTP', status, JSON.stringify(json, null, 2));
  return ((json.data as Json)?.id as string) ?? null;
}

async function step5(token: string, userId: string): Promise<void> {
  console.log('\n# Step 5: Delete attendee from Event A only');
  const { status } = await api(
    'DELETE',
    `/users/${userId}?scope=event&eventId=${EVENT_A}`,
    token,
  );
  console.log('HTTP', status);
}

async function step6(token: string, userId: string): Promise<void> {
  console.log('\n# Step 6: Remove attendee from all events');
  const { status } = await api('DELETE', `/users/${userId}?scope=all`, token);
  console.log('HTTP', status);
}

async function stepDeleteSpeaker(token: string, speakerId: string): Promise<void> {
  console.log('\n# Delete Speaker profile');
  const { status } = await api('DELETE', `/speakers/${speakerId}`, token);
  console.log('HTTP', status);
}

async function stepDeleteSponsor(token: string, sponsorId: string): Promise<void> {
  console.log('\n# Delete Sponsor profile');
  const { status } = await api('DELETE', `/sponsors/${sponsorId}`, token);
  console.log('HTTP', status);
}

async function main(): Promise<void> {
  const step = process.argv[2] ?? '1';
  const token = await adminToken();

  if (step === '1') {
    await step1(token);
    await snapshot(token, 'After step 1');
    console.log('\n>> Check email for invite code. Share it here to continue login tests.');
    return;
  }

  const user = await findUser(token);
  if (!user && step !== 'cleanup') {
    throw new Error('User not found — run step 1 first');
  }
  const userId = user?.id as string;

  if (step === '2') {
    await step2(token);
    await snapshot(token, 'After step 2');
    return;
  }
  if (step === '3') {
    await step3(token);
    await snapshot(token, 'After step 3');
    return;
  }
  if (step === '4') {
    await step4(token);
    await snapshot(token, 'After step 4');
    return;
  }
  if (step === '5') {
    await step5(token, userId);
    await snapshot(token, 'After step 5');
    return;
  }
  if (step === '6') {
    await step6(token, userId);
    await snapshot(token, 'After step 6');
    return;
  }
  if (step === 'login-invite' && process.argv[3]) {
    await dashboardLoginCheck('invite code', process.argv[3]);
    return;
  }
  if (step === 'login-password' && process.argv[3]) {
    await dashboardLoginCheck('password', process.argv[3]);
    return;
  }
  if (step === 'delete-speaker' && process.argv[3]) {
    await stepDeleteSpeaker(token, process.argv[3]);
    await snapshot(token, 'After speaker delete');
    return;
  }
  if (step === 'delete-sponsor' && process.argv[3]) {
    await stepDeleteSponsor(token, process.argv[3]);
    await snapshot(token, 'After sponsor delete');
    return;
  }
  if (step === 'snapshot') {
    await snapshot(token, 'Current state');
    return;
  }

  console.log('Unknown step. Use: 1|2|3|4|5|6|snapshot|login-invite|login-password|delete-speaker|delete-sponsor');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
