#!/usr/bin/env node
/** Debit math + POST /credits/spend + Hosted chat past free floor. */
import assert from 'node:assert/strict';
import {
  HOSTED_ASK_PRICE_CENTS,
  applyCreditDebit,
} from './dasha-compute-credits.mjs';
import {
  ComputeNetwork,
  computeApi,
  resetHostedRatesForTests,
} from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

assert.equal(HOSTED_ASK_PRICE_CENTS, 5);

const ok = applyCreditDebit(500, 5);
assert.equal(ok.ok, true);
assert.equal(ok.previous_cents, 500);
assert.equal(ok.charged_cents, 5);
assert.equal(ok.balance_cents, 495);

const short = applyCreditDebit(4, 5);
assert.equal(short.ok, false);
assert.equal(short.error, 'insufficient credits');
assert.equal(short.balance_cents, 4);

assert.equal(applyCreditDebit(0, 5).ok, false);
assert.equal(applyCreditDebit(5, 0).ok, false);
assert.equal(applyCreditDebit(5, -1).ok, false);
assert.equal(applyCreditDebit(null, 5).ok, false);

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-credits-spend-secret',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: '42', handle: 'spend_user' });
const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const unauth = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/spend', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'hosted-ask' }),
}), origin);
assert.equal(unauth.status, 401);

const noBal = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/spend', {
  method: 'POST',
  headers,
  body: JSON.stringify({ reason: 'hosted-ask', request_id: 'r1' }),
}), origin);
assert.equal(noBal.status, 402);
const noBalBody = await noBal.json();
assert.equal(noBalBody.error, 'top up credits');
assert.equal(noBalBody.price_cents, 5);
assert.equal(noBalBody.balance_cents, 0);

await storage.put('compute:credit-balance:x:42', { owner: 'x:42', cents: 12, updatedAt: Date.now() });

const spent = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/spend', {
  method: 'POST',
  headers,
  body: JSON.stringify({ reason: 'hosted-ask', request_id: 'r2' }),
}), origin);
assert.equal(spent.status, 200, await spent.clone().text());
const spentBody = await spent.json();
assert.equal(spentBody.ok, true);
assert.equal(spentBody.charged_cents, 5);
assert.equal(spentBody.balance_cents, 7);
assert.equal(spentBody.replay, false);

const replay = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/spend', {
  method: 'POST',
  headers,
  body: JSON.stringify({ reason: 'hosted-ask', request_id: 'r2' }),
}), origin);
assert.equal(replay.status, 200);
const replayBody = await replay.json();
assert.equal(replayBody.ok, true);
assert.equal(replayBody.replay, true);
assert.equal(replayBody.balance_cents, 7, 'replay does not double-debit');
assert.equal(replayBody.charged_cents, 5);

const badReason = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/spend', {
  method: 'POST',
  headers,
  body: JSON.stringify({ reason: 'community-ask' }),
}), origin);
assert.equal(badReason.status, 400);

// Hosted chat: free floor then credit debit
resetHostedRatesForTests();
env.LOBBY = {
  idFromName: () => 'public',
  get() {
    return {
      fetch: (req) => network.fetch(req, origin),
    };
  },
};

const chatHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
const msg = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] });

for (let i = 0; i < 3; i++) {
  const free = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST', headers: chatHeaders, body: msg,
  }), env, origin);
  assert.equal(free.status, 200, `free ${i}`);
  const bal = await storage.get('compute:credit-balance:x:42');
  assert.equal(Math.floor(Number(bal?.cents) || 0), 7, `free tier must not debit (${i})`);
}

const paid = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST', headers: chatHeaders, body: msg,
}), env, origin);
assert.equal(paid.status, 200, await paid.clone().text());
assert.equal(paid.headers.get('X-Dasha-Balance-Cents'), '2');
const paidJson = await paid.json();
assert.equal(paidJson.answer, 'ok');
assert.equal(paidJson.balance_cents, 2);
assert.equal(Math.floor(Number((await storage.get('compute:credit-balance:x:42'))?.cents) || 0), 2);

// Drain remaining (2 < 5) → fail closed
const fail = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST', headers: chatHeaders, body: msg,
}), env, origin);
assert.equal(fail.status, 402);
const failBody = await fail.json();
assert.equal(failBody.error, 'top up credits');
assert.equal(failBody.balance_cents, 2);
assert.equal(Math.floor(Number((await storage.get('compute:credit-balance:x:42'))?.cents) || 0), 2, 'no debit on fail');

// Page quiet path markers
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML);
assert.match(disk, /top up\|credits/i);
assert.match(disk, /X-Dasha-Balance-Cents/);
assert.match(disk, /showTf\('credits'\)/);

console.log('dasha-compute-credits-spend: PASS');
