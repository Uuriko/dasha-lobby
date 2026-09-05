#!/usr/bin/env node
/** Real Sponsor tip orders + honest raised_usd (no catalog invent). */
import assert from 'node:assert/strict';
import { ComputeNetwork, sponsorBoard, COMPUTE_SPONSOR_TREASURY, COMPUTE_SPONSOR_MACHINES } from './dasha-compute-network.mjs';
import { lockTipAmount, tipCentsFromInput, USDC_MINT, verifyCreditTx } from './dasha-compute-credits.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const empty = sponsorBoard([]);
assert.equal(empty.raised_usd, 0);
assert.equal(empty.raised_cents, 0);
assert.equal(empty.dest, COMPUTE_SPONSOR_TREASURY);
assert.equal(empty.machines.length, 8);
assert.equal(empty.goal_usd, COMPUTE_SPONSOR_MACHINES.reduce((s, m) => s + m.usd, 0));

// Named without cents must NOT invent raised from catalog usd
const namedOnly = sponsorBoard([{ machine: 'mbp-16', name: 'alice', status: 'named', createdAt: 1 }]);
assert.equal(namedOnly.raised_usd, 0, 'named does not invent raised');
assert.equal(namedOnly.machines.find(m => m.id === 'mbp-16').status, 'named');

// Funded tip rows drive raised
const tipped = sponsorBoard([], [{
  id: 'spr_1', machine: 'network', name: 'bob', handle: 'bob', cents: 500, status: 'funded', createdAt: 2, method: 'usdc',
}]);
assert.equal(tipped.raised_cents, 500);
assert.equal(tipped.raised_usd, 5);
assert.equal(tipped.credit[0].name, 'bob');
assert.ok(Array.isArray(tipped.tips));

assert.equal(tipCentsFromInput({ pack: '5' }), 500);
assert.equal(tipCentsFromInput({ pack: '20' }), 2000);
assert.equal(tipCentsFromInput({ cents: 750 }), 750);
assert.equal(tipCentsFromInput({ cents: 50 }), null);
assert.equal(tipCentsFromInput({ pack: 'nope' }), null);

const locked = await lockTipAmount('usdc', 500, {});
assert.equal(locked.ok, true);
assert.equal(locked.charge_cents, 500);
assert.equal(locked.face_cents, 500);
assert.equal(String(locked.amountRaw), '5000000');
assert.equal(locked.amountUi, '5');

const dashaLocked = await lockTipAmount('dasha', 500, { DASHA_PRICE_USD: '0.0001' });
assert.equal(dashaLocked.ok, true);
assert.equal(dashaLocked.charge_cents, 500);

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'sponsor-real-secret',
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
const session = await createSessionToken(env, { xId: 'sponsor-real', handle: 'tipper' });
const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const unauth = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ pack: '5', method: 'usdc' }),
}), origin);
assert.equal(unauth.status, 401);

const created = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders', {
  method: 'POST', headers, body: JSON.stringify({ pack: '5', method: 'usdc', machine: 'network' }),
}), origin);
assert.equal(created.status, 201);
const order = await created.json();
assert.equal(order.status, 'pending');
assert.equal(order.kind, 'sponsor');
assert.equal(order.dest, COMPUTE_SPONSOR_TREASURY);
assert.equal(order.face_cents, 500);
assert.equal(order.charge_cents, 500);
assert.match(order.pay_url, new RegExp(`^solana:${COMPUTE_SPONSOR_TREASURY}`));
assert.match(order.pay_url, /amount=5/);
assert.equal(order.mint, USDC_MINT);

const pendingConfirm = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/sponsors/orders/${order.id}/confirm`, {
  method: 'POST', headers, body: '{}',
}), origin);
assert.equal(pendingConfirm.status, 200);
assert.equal((await pendingConfirm.json()).status, 'pending');

const sig = '5'.repeat(64);
const fakeTx = {
  meta: {
    err: null,
    preTokenBalances: [],
    postTokenBalances: [{ owner: COMPUTE_SPONSOR_TREASURY, mint: USDC_MINT, uiTokenAmount: { amount: '5000000' } }],
  },
  transaction: { message: { accountKeys: ['payer111111111111111111111111111111111111111', COMPUTE_SPONSOR_TREASURY, order.reference] }, signatures: [sig] },
};
assert.equal(verifyCreditTx(fakeTx, { dest: COMPUTE_SPONSOR_TREASURY, mint: USDC_MINT, amountRaw: order.amountRaw, reference: order.reference }).ok, true);

const origFetch = globalThis.fetch;
const txBySig = new Map([[sig, fakeTx]]);
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('rpc.test.local') || (init?.body && /getTransaction|getSignaturesForAddress/.test(String(init.body)))) {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (body.method === 'getTransaction') {
      const hit = txBySig.get(body.params?.[0]) || null;
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: hit }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (body.method === 'getSignaturesForAddress') {
      const ref = body.params?.[0];
      const hits = [...txBySig.entries()].filter(([, tx]) => (tx?.transaction?.message?.accountKeys || []).includes(ref));
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: hits.map(([signature]) => ({ signature, err: null })) }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return origFetch(url, init);
};

try {
  const funded = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/sponsors/orders/${order.id}/confirm`, {
    method: 'POST', headers, body: JSON.stringify({ signature: sig }),
  }), origin);
  assert.equal(funded.status, 200, await funded.clone().text());
  const fundedBody = await funded.json();
  assert.equal(fundedBody.status, 'funded');
  assert.equal(fundedBody.face_cents, 500);
  assert.ok(fundedBody.board);
  assert.equal(fundedBody.board.raised_cents, 500);
  assert.equal(fundedBody.board.raised_usd, 5);

  const board = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors', { headers: { Origin: origin } }), origin);
  assert.equal(board.status, 200);
  const boardBody = await board.json();
  assert.equal(boardBody.raised_cents, 500);
  assert.equal(boardBody.raised_usd, 5);
  assert.ok(boardBody.tips.some(t => t.cents === 500));

  const createdMac = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders', {
    method: 'POST', headers, body: JSON.stringify({ pack: '20', method: 'usdc', machine: 'mini-m4' }),
  }), origin);
  assert.equal(createdMac.status, 201);
  const macOrder = await createdMac.json();
  const macSig = '6'.repeat(64);
  const macTx = {
    meta: {
      err: null,
      preTokenBalances: [],
      postTokenBalances: [{ owner: COMPUTE_SPONSOR_TREASURY, mint: USDC_MINT, uiTokenAmount: { amount: String(macOrder.amountRaw) } }],
    },
    transaction: { message: { accountKeys: ['payer', COMPUTE_SPONSOR_TREASURY, macOrder.reference] }, signatures: [macSig] },
  };
  txBySig.set(macSig, macTx);
  const macFunded = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/sponsors/orders/${macOrder.id}/confirm`, {
    method: 'POST', headers, body: JSON.stringify({ signature: macSig }),
  }), origin);
  assert.equal(macFunded.status, 200, await macFunded.clone().text());
  const macBoard = (await macFunded.json()).board;
  assert.equal(macBoard.raised_cents, 500 + 2000);
  assert.equal(macBoard.raised_usd, 25);
  assert.notEqual(macBoard.raised_usd, 599, 'never invent Mac catalog usd');
  assert.equal(macBoard.machines.find(m => m.id === 'mini-m4').status, 'funded');
} finally {
  globalThis.fetch = origFetch;
}

// Slash parity on orders
const slash = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders/', {
  method: 'POST', headers, body: JSON.stringify({ pack: '5', method: 'usdc' }),
}), origin);
assert.equal(slash.status, 201);

console.log('dasha-compute-sponsor-real: PASS');
