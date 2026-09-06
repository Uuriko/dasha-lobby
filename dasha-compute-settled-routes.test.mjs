#!/usr/bin/env node
/** GET /compute/api/receipts + factory settled_24h wire. */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-settled-routes-secret',
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
const session = await createSessionToken(env, { xId: '77', handle: 'settle_user' });
const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin };

const unauth = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/receipts'), origin);
assert.equal(unauth.status, 401);
const unauthBody = await unauth.json();
assert.equal(unauthBody.schema, 'settled.receipts.v0');
assert.deepEqual(unauthBody.receipts, []);
assert.deepEqual(unauthBody.settled_24h, { tokens: 0, jobs: 0, cents: 0 });

const empty = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/receipts/', {
  headers: { Cookie: headers.Cookie, Origin: origin },
}), origin);
assert.equal(empty.status, 200);
const emptyBody = await empty.json();
assert.deepEqual(emptyBody.receipts, []);
assert.deepEqual(emptyBody.settled_24h, { tokens: 0, jobs: 0, cents: 0 });

await network.recordPaidInferenceSettle({
  owner: 'x:77',
  engine: 'hosted',
  usage: { total_tokens: 33 },
  cents: 5,
  requestId: 'hosted_t',
  replayKey: 'hosted:hosted_t',
  now: Date.now(),
  idFactory: () => 'rcp_t',
});

const listed = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/receipts', {
  headers: { Cookie: headers.Cookie, Origin: origin },
}), origin);
assert.equal(listed.status, 200);
const body = await listed.json();
assert.equal(body.receipts.length, 1);
assert.equal(body.receipts[0].tokens, 33);
assert.equal(body.receipts[0].kind, 'paid-inference');
assert.equal(body.settled_24h.tokens, 33);

const fac = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/factory'), origin);
assert.equal(fac.status, 200);
const facBody = await fac.json();
assert.equal(facBody.settled_24h.tokens, 33);
assert.equal(facBody.settled_24h.jobs, 1);

const head = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/receipts', { method: 'HEAD', headers }), origin);
assert.equal(head.status, 200);
assert.equal(await head.text(), '');

console.log('dasha-compute-settled-routes: PASS');
