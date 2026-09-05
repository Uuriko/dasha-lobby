#!/usr/bin/env node
/** Credit order create / confirm / replay against in-memory ComputeNetwork. */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { CREDIT_DEST, USDC_MINT, verifyCreditTx } from './dasha-compute-credits.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-credits-routes-secret',
  DASHA_PRICE_USD: '0.0001',
  SOLANA_RPC_URL: 'https://rpc.test.local',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: '99', handle: 'credit_user' });
const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const unauth = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits'), origin);
assert.equal(unauth.status, 401);
const unauthBody = await unauth.json();
assert.equal(unauthBody.error, 'login required');
assert.ok(Array.isArray(unauthBody.packs));
assert.deepEqual(unauthBody.methods, ['usdc', 'dasha']);
assert.equal(unauthBody.discounts.usdc, 0.03);
assert.equal(unauthBody.discounts.dasha, 0.05);

const bal = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits', { headers: { Cookie: headers.Cookie, Origin: origin } }), origin);
assert.equal(bal.status, 200);
const balBody = await bal.json();
assert.equal(balBody.balance_cents, 0);
assert.equal(balBody.packs.length, 3);

const unauthOrder = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/orders', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ pack: '5', method: 'usdc' }),
}), origin);
assert.equal(unauthOrder.status, 401);

const created = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/orders', {
  method: 'POST',
  headers,
  body: JSON.stringify({ pack: '5', method: 'usdc' }),
}), origin);
assert.equal(created.status, 201);
const order = await created.json();
assert.match(order.id, /^crd_/);
assert.equal(order.status, 'pending');
assert.equal(order.pack, '5');
assert.equal(order.method, 'usdc');
assert.equal(order.credits_cents, 500);
assert.equal(order.charge_cents, 485);
assert.equal(order.dest, CREDIT_DEST);
assert.equal(order.mint, USDC_MINT);
assert.equal(order.amount, '4.85');
assert.equal(order.amountRaw, '4850000');
assert.match(order.pay_url, /^solana:/);
assert.ok(order.reference);

// Fake settle by injecting a verified tx path via settleCreditOrder with mocked rpc — use direct storage credit path:
const sig = '5'.repeat(64);
const fakeTx = {
  meta: {
    err: null,
    preTokenBalances: [],
    postTokenBalances: [{ owner: CREDIT_DEST, mint: USDC_MINT, uiTokenAmount: { amount: '4850000' } }],
  },
  transaction: { message: { accountKeys: ['payer111111111111111111111111111111111111111', CREDIT_DEST, order.reference] }, signatures: [sig] },
};
assert.equal(verifyCreditTx(fakeTx, { dest: CREDIT_DEST, mint: USDC_MINT, amountRaw: order.amountRaw, reference: order.reference }).ok, true);

// Monkeypatch load via env rpc is hard; call settle with signature after stubbing global fetch? Instead put paid via settleCreditOrder internals:
// Patch network.env and override find by directly putting after manual verify in settle — simplest: replace loadTxBySignature by storing and calling settle with a custom approach.

// Direct unit of settle: temporarily attach a fake loader
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('rpc.test.local') || (init?.body && /getTransaction|getSignaturesForAddress/.test(String(init.body)))) {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (body.method === 'getTransaction') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: fakeTx }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (body.method === 'getSignaturesForAddress') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: [{ signature: sig, err: null }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return origFetch(url, init);
};

try {
  const confirm = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/credits/orders/${order.id}/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ signature: sig }),
  }), origin);
  assert.equal(confirm.status, 200, await confirm.clone().text());
  const paid = await confirm.json();
  assert.equal(paid.status, 'paid');
  assert.equal(paid.credits_cents, 500);
  assert.equal(paid.balance_cents, 500);

  const confirm2 = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/credits/orders/${order.id}/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ signature: sig }),
  }), origin);
  assert.equal(confirm2.status, 200);
  const again = await confirm2.json();
  assert.equal(again.status, 'paid');
  assert.equal(again.balance_cents, 500, 'idempotent confirm does not double-credit');

  // New order, same sig → replay guard
  const created2 = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pack: '5', method: 'usdc' }),
  }), origin);
  const order2 = await created2.json();
  const replay = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/credits/orders/${order2.id}/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ signature: sig }),
  }), origin);
  // verify may fail reference miss first (different ref) before sig guard — either 400 or 409
  assert.ok([400, 409].includes(replay.status), `replay status ${replay.status}`);

  const bal2 = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits', { headers: { Cookie: headers.Cookie, Origin: origin } }), origin)).json();
  assert.equal(bal2.balance_cents, 500);
} finally {
  globalThis.fetch = origFetch;
}

// dasha order locks amount with env price
const dashaOrder = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/orders', {
  method: 'POST',
  headers,
  body: JSON.stringify({ pack: '5', method: 'dasha' }),
}), origin);
assert.equal(dashaOrder.status, 201);
const d = await dashaOrder.json();
assert.equal(d.method, 'dasha');
assert.equal(d.charge_cents, 475);
assert.ok(BigInt(d.amountRaw) > 0n);

console.log('dasha-compute-credits-routes: PASS');
