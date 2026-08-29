/**
 * Non-destructive production smoke checks for recently shipped scenarios.
 * Usage: npx tsx scripts/smoke-scenarios.ts
 */
const API = process.env.API_BASE ?? 'https://pcbha9tkkh.ap-southeast-2.awsapprunner.com/api/v1';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@unleashyourbrave.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!';

type Json = Record<string, unknown>;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function pass(name: string, detail = 'ok'): void {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, ok: false, detail });
  console.log(`✗ ${name} — ${detail}`);
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

async function api(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function main(): Promise<void> {
  console.log(`Smoke scenarios → ${API}\n`);

  const token = await adminToken();
  pass('Admin login');

  // Membership mandatory on schedule
  {
    const { status, json } = await api('POST', '/events/schedule', token, {
      days: [{ dayNumber: 1, date: '2030-01-01T00:00:00.000Z', label: 'Day 1' }],
      membershipIds: [],
    });
    const err = json.error as Json | undefined;
    const field = ((err?.details as Json)?.fieldErrors as Json)?.membershipIds;
    if (status === 422 && Array.isArray(field) && field.length > 0) {
      pass('Schedule rejects empty membershipIds');
    } else {
      fail('Schedule rejects empty membershipIds', `status=${status}`);
    }
  }

  // Membership mandatory on association update
  {
    const ws = await api('GET', '/events/workspace', token);
    const current = (ws.json.data as Json)?.current as Json | null;
    const eventId = current?.id as string | undefined;
    if (!eventId) {
      fail('Associations reject empty membershipIds', 'no current event');
    } else {
      const { status } = await api('PUT', `/events/${eventId}/associations`, token, {
        membershipIds: [],
      });
      if (status === 422) pass('Associations reject empty membershipIds');
      else fail('Associations reject empty membershipIds', `status=${status}`);
    }
  }

  // Store checkout delivery address (min 1 char) — need a product
  {
    const products = await api('GET', '/store/products?perPage=1&activeOnly=true', token);
    const items = products.json.data as Json[] | undefined;
    const productId = items?.[0]?.id as string | undefined;
    if (!productId) {
      fail('Store checkout requires delivery address', 'no active product');
    } else {
      const missing = await api('POST', '/store/checkout/sessions', token, {
        productId,
        quantity: 1,
        deliveryAddress: '',
        contactPhone: '+1234567890',
      });
      if (missing.status === 422) pass('Store checkout rejects empty delivery address');
      else fail('Store checkout rejects empty delivery address', `status=${missing.status}`);

      const shortOk = await api('POST', '/store/checkout/sessions', token, {
        productId,
        quantity: 1,
        deliveryAddress: 'Home',
        contactPhone: '+1234567890',
        expectedPrice: items![0]!.price as number,
      });
      if (shortOk.status === 201 || shortOk.status === 409) {
        pass('Store checkout accepts single-word delivery address', `status=${shortOk.status}`);
      } else {
        fail(
          'Store checkout accepts single-word delivery address',
          `status=${shortOk.status} ${JSON.stringify(shortOk.json.error ?? shortOk.json).slice(0, 120)}`,
        );
      }
    }
  }

  // Admin orders API
  {
    const { status, json } = await api('GET', '/store/orders?perPage=5', token);
    if (status === 200 && Array.isArray(json.data)) {
      pass('Admin orders list', `${(json.data as Json[]).length} row(s) on page`);
    } else {
      fail('Admin orders list', `status=${status}`);
    }
  }

  // App branding support fields
  {
    const { status, json } = await api('GET', '/app-branding', token);
    const data = json.data as Json | undefined;
    if (
      status === 200 &&
      data &&
      typeof data.supportEmail === 'string' &&
      typeof data.supportPhone === 'string'
    ) {
      pass('App branding exposes supportEmail/supportPhone', data.supportEmail as string);
    } else {
      fail('App branding exposes supportEmail/supportPhone', `status=${status}`);
    }
  }

  // Public checkout session — store purchaseType branch (use fake session id returns stripe error or 404, skip)
  // Edition date validation unit — run locally via import if needed

  console.log('\n--- Summary ---');
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`${ok} passed, ${bad} failed, ${results.length} total`);

  if (bad > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
