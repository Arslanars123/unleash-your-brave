/**
 * Test A: delete-all then re-add same email must not hit orphan "already have membership".
 * Usage: npx tsx scripts/test-orphan-regression.ts
 */
const API = 'https://pcbha9tkkh.ap-southeast-2.awsapprunner.com/api/v1';
const ADMIN_EMAIL = 'admin@unleashyourbrave.com';
const ADMIN_PASSWORD = 'Admin123!';
const EMAIL = 'devarsulan@gmail.com';
const NAME = 'Arslan Zaheer';
const EVENT_SEP3 = 'b0c93954-de2c-422f-a25f-f77f4b1c92ea';
const VIP = '10ef7ca5-ab70-4b8c-bb7c-f2bcac99dba1';

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

async function findUser(token: string): Promise<Json | null> {
  const { json } = await api('GET', `/users?search=${encodeURIComponent(EMAIL)}&perPage=20`, token);
  const data = json.data;
  const items = Array.isArray(data)
    ? data
    : (((data as Json)?.items as Json[]) ?? []);
  return (
    items.find((u) => String(u.email).toLowerCase() === EMAIL) ?? items[0] ?? null
  );
}

async function eligibility(eventId: string, membershipId: string): Promise<Json> {
  const qs = new URLSearchParams({
    email: EMAIL,
    membershipId,
    eventId,
  });
  const res = await fetch(`${API}/checkout/eligibility?${qs}`);
  return (await res.json()) as Json;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

async function main(): Promise<void> {
  console.log('=== Test A: orphan membership regression ===\n');
  const token = await adminToken();
  console.log('1) Admin logged in');

  // Ensure clean-ish start: delete if exists
  let user = await findUser(token);
  if (user?.id) {
    console.log(`2) Existing user ${user.id} — deleting completely`);
    const del = await api('DELETE', `/users/${user.id}?scope=all`, token);
    assert(del.status === 204 || del.status === 200, `delete existing → ${del.status}`);
  } else {
    console.log('2) No existing user — starting fresh');
  }

  // Eligibility after delete must allow
  let elig = await eligibility(EVENT_SEP3, VIP);
  const eligData = elig.data as Json;
  assert(
    elig.success === true && eligData?.allowed === true,
    `eligibility after delete: allowed=${String(eligData?.allowed)} reason=${String(eligData?.reason)}`,
  );

  // Create attendee on Sep 3 Vip (same as dashboard Create Attendee)
  console.log('3) Creating attendee on Sep 3 Vip Pas');
  const create = await api('POST', '/users', token, {
    email: EMAIL,
    name: NAME,
    role: 'member',
    eventId: EVENT_SEP3,
    membershipId: VIP,
  });
  assert(
    create.status === 201 || create.status === 200,
    `create attendee → ${create.status} ${JSON.stringify(create.json.error ?? '')}`,
  );
  user = await findUser(token);
  assert(Boolean(user?.id), 'user exists after create');
  const userId = String(user!.id);

  // Confirm purchase blocks re-buy of same plan
  elig = await eligibility(EVENT_SEP3, VIP);
  assert(
    (elig.data as Json)?.allowed === false,
    `while booked, same plan blocked (expected): ${(elig.data as Json)?.reason}`,
  );

  // Delete from all events
  console.log('4) Delete from all events');
  const del2 = await api('DELETE', `/users/${userId}?scope=all`, token);
  assert(del2.status === 204 || del2.status === 200, `delete all → ${del2.status}`);

  const gone = await findUser(token);
  assert(!gone, 'user gone from attendee list after delete-all');

  // Critical: eligibility must allow again (no orphan)
  elig = await eligibility(EVENT_SEP3, VIP);
  const after = elig.data as Json;
  assert(
    after?.allowed === true && after?.kind === 'purchase',
    `eligibility after delete-all: allowed=${String(after?.allowed)} kind=${String(after?.kind)} reason=${String(after?.reason)}`,
  );

  // Re-add same email
  console.log('5) Re-adding same email to Sep 3 Vip');
  const recreate = await api('POST', '/users', token, {
    email: EMAIL,
    name: NAME,
    role: 'member',
    eventId: EVENT_SEP3,
    membershipId: VIP,
  });
  assert(
    recreate.status === 201 || recreate.status === 200,
    `re-create attendee → ${recreate.status} ${JSON.stringify(recreate.json.error ?? '')}`,
  );

  const again = await findUser(token);
  assert(Boolean(again?.id), 'user exists after re-create');
  assert(String(again!.email).toLowerCase() === EMAIL, 'email matches');

  console.log('\n=== Test A PASSED: no orphan block after delete-all + re-add ===');
}

main().catch((error) => {
  console.error('\n=== Test A FAILED ===');
  console.error(error);
  process.exit(1);
});
