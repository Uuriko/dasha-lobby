import assert from 'node:assert/strict';
import { DashaLobby } from './dasha-lobby-worker.mjs';
import { createEmailSessionToken } from './dasha-lobby-x.mjs';
import { verifyStripeSignature } from './dasha-compute-card.mjs';

globalThis.WebSocketRequestResponsePair ||= class {};

function makeLobby(env) {
  const rows = new Map();
  const storage = {
    async get(key) { return rows.get(key); },
    async put(key, value) { rows.set(key, value); },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
    async getAlarm() { return Date.now(); }, async setAlarm() {},
  };
  let ready;
  const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
  return { lobby, ready, rows };
}

const SECRET = 'sk_test_fake';
const WH_SECRET = 'whsec_fake';
const env = {
  LOBBY_SESSION_SECRET: 'card-test-secret',
  ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
  STRIPE_SECRET_KEY: SECRET,
  STRIPE_WEBHOOK_SECRET: WH_SECRET,
};

// stub stripe
const realFetch = globalThis.fetch;
let stripeCalls = [];
let paidSessions = new Set();
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.stripe.com/')) {
    stripeCalls.push({ url: u, init });
    if (u === 'https://api.stripe.com/v1/checkout/sessions' && init.method === 'POST') {
      const id = `cs_test_${stripeCalls.length}`;
      return new Response(JSON.stringify({ id, url: `https://checkout.stripe.com/pay/${id}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const m = u.match(/\/v1\/checkout\/sessions\/(cs_[A-Za-z0-9_]+)/);
    if (m) {
      const paid = paidSessions.has(m[1]);
      return new Response(JSON.stringify({
        id: m[1],
        payment_status: paid ? 'paid' : 'unpaid',
        amount_total: 500,
        currency: 'usd',
        metadata: { order_id: currentOrderId },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }
  return realFetch(url, init);
};

let currentOrderId = '';
const { lobby, ready, rows } = makeLobby(env);
await ready;
const originHeaders = { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
const cookie = `__Host-dasha_x=${await createEmailSessionToken(env, 'buyer@example.com')}`;

// 1. card checkout creates order + session at face price
const co = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/card/checkout', {
  method: 'POST', headers: { ...originHeaders, Cookie: cookie }, body: JSON.stringify({ pack: '5' }),
}));
assert.equal(co.status, 201, 'checkout 201');
const order = await co.json();
assert.equal(order.method, 'card');
assert.equal(order.charge_cents, 500, 'card pays face, no crypto discount');
assert.match(order.checkout_url, /^https:\/\/checkout\.stripe\.com\//);
currentOrderId = order.id;
const params = new URLSearchParams(stripeCalls[0].init.body);
assert.equal(params.get('line_items[0][price_data][unit_amount]'), '500');
assert.equal(params.get('metadata[order_id]'), order.id);
assert.equal(stripeCalls[0].init.headers.Authorization, `Bearer ${SECRET}`);
assert.equal(stripeCalls[0].init.headers['Idempotency-Key'], `dasha-credit-${order.id}`);

// 2. network honesty: card_available true when configured
const net = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/network', { headers: originHeaders }));
assert.equal((await net.json()).card_available, true);

// 3. unpaid session -> GET stays pending
const g1 = await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/credits/orders/${order.id}`, { headers: { ...originHeaders, Cookie: cookie } }));
assert.equal((await g1.json()).status, 'pending');

// 4. webhook with bad signature -> 400, nothing credited
const bad = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/card/webhook', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=bad' }, body: '{}',
}));
assert.equal(bad.status, 400);

// 5. webhook with valid signature settles (replay-safe)
const sessionId = order.id && rows.get(`compute:credit-order:${order.id}`).stripe_session_id;
paidSessions.add(sessionId);
async function signPayload(raw) {
  const ts = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${raw}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${ts},v1=${sig}`;
}
const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: sessionId, payment_status: 'paid', amount_total: 500, currency: 'usd', metadata: { order_id: order.id } } } });
const wh1 = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/card/webhook', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': await signPayload(event) }, body: event,
}));
assert.equal(wh1.status, 200, 'webhook 200');
assert.equal(rows.get(`compute:credit-order:${order.id}`).status, 'paid');
const bal1 = rows.get('compute:credit-balance:email:buyer@example.com');
assert.equal(bal1?.cents, 500, 'balance credited once');

// 6. webhook replay -> no double credit
const wh2 = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/card/webhook', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': await signPayload(event) }, body: event,
}));
assert.equal(wh2.status, 200);
assert.equal(rows.get('compute:credit-balance:email:buyer@example.com').cents, 500, 'still 500 after replay');

// 7. return-from-Stripe path: second order, settled via GET polling (no webhook)
const co2 = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/card/checkout', {
  method: 'POST', headers: { ...originHeaders, Cookie: cookie }, body: JSON.stringify({ pack: '5' }),
}));
const order2 = await co2.json();
currentOrderId = order2.id;
const sessionId2 = rows.get(`compute:credit-order:${order2.id}`).stripe_session_id;
paidSessions.add(sessionId2);
const g2 = await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/credits/orders/${order2.id}`, { headers: { ...originHeaders, Cookie: cookie } }));
const body2 = await g2.json();
assert.equal(body2.status, 'paid', 'GET auto-settles a paid card session');
assert.equal(rows.get('compute:credit-balance:email:buyer@example.com').cents, 1000);

// 8. login required
const anon = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/card/checkout', {
  method: 'POST', headers: originHeaders, body: JSON.stringify({ pack: '5' }),
}));
assert.equal(anon.status, 401);

// 9. unconfigured -> honest 503, no stripe call
{
  const { lobby: plain, ready: r2 } = makeLobby({ ...env, STRIPE_SECRET_KEY: '' });
  await r2;
  const before = stripeCalls.length;
  const res = await plain.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/card/checkout', {
    method: 'POST', headers: { ...originHeaders, Cookie: cookie }, body: JSON.stringify({ pack: '5' }),
  }));
  assert.equal(res.status, 503);
  assert.equal(stripeCalls.length, before, 'no stripe call without key');
}

// 10. signature helper: stale timestamp rejected
const stale = await verifyStripeSignature(WH_SECRET, '{}', 't=1000,v1=whatever');
assert.equal(stale.ok, false);

globalThis.fetch = realFetch;
console.log('dasha-compute-card.test.mjs: all assertions passed');
