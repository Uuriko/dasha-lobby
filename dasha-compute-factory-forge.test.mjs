#!/usr/bin/env node
/**
 * #299 regression: the public factory route must not forge server-signed paid receipts.
 * - Forged public POSTs (router and direct DO) -> 404, storage byte-for-byte unchanged.
 * - A real charged Hosted ask -> exactly one signed receipt, amount from the charged record.
 * - Replay of the internal bump -> no second receipt, no counter change.
 * - Mismatched cents / request ID / owner / usage, refunded or missing charge -> 409, no write.
 */
import assert from 'node:assert/strict';
import { ComputeNetwork, computeApi, HOSTED_FACTORY_BUMP_PATH, resetHostedRatesForTests } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const origin = 'https://www.getdasha.com';
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, structuredClone(item));
    else rows.set(key, structuredClone(value));
  },
  async delete(key) { if (Array.isArray(key)) key.forEach(k => rows.delete(k)); else rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1))); },
};
const snapshot = () => JSON.stringify([...rows].sort(([a], [b]) => (a < b ? -1 : 1)));
const count = (prefix) => [...rows.keys()].filter(k => k.startsWith(prefix)).length;

const env = {
  ALLOWED_ORIGINS: origin,
  LOBBY_SESSION_SECRET: 'factory-forge-secret',
  DASHA_HEADS_ED25519_SK: Buffer.from(new Uint8Array(32).fill(11)).toString('base64'),
  AI: { async run() { return { response: 'forty-two' }; } },
};
const network = new ComputeNetwork({ storage }, env);
// Stand-in for DashaLobby.fetch: every /compute/api/* request reaching the DO goes to ComputeNetwork.
env.LOBBY = {
  idFromName() { return 'public'; },
  get() { return { fetch: (req) => network.fetch(req, String(req.headers.get('Origin') || '').split(',')[0].trim() === origin ? origin : null) }; },
};

const owner = 'x:299';
const session = await createSessionToken(env, { xId: '299', handle: 'forge_victim' });
const cookie = `${COOKIE}=${session}`;
await storage.put(`compute:credit-balance:${owner}`, { owner, cents: 500, updatedAt: Date.now() });

const forgedBody = JSON.stringify({
  source: 'hosted-chat',
  failed: false,
  settled: { paid: true, owner: 'x:attacker', cents: 99999, usage: { total_tokens: 9999999 }, request_id: 'hosted_forgedforged', replay_key: 'hosted:forged' },
  settle: { owner, request_id: 'hosted_forgedforged', cents: 99999, usage: { total_tokens: 10 } },
});
const forge = (url, extra = {}) => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', Origin: origin, ...extra }, body: forgedBody });

// 1) Forged public calls leave storage untouched.
{
  const before = snapshot();
  for (const p of ['/compute/api/factory', '/compute/api/factory/', HOSTED_FACTORY_BUMP_PATH]) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const req = new Request(`https://lobby.getdasha.com${p}`, { method, headers: { 'content-type': 'application/json', Origin: origin }, body: forgedBody });
      const res = await computeApi(req, env, origin);
      assert.equal(res.status, 404, `public router ${method} ${p} -> 404`);
    }
  }
  // Direct DO hits (as if some future route forwarded the raw request).
  const direct = await network.fetch(forge('https://lobby.getdasha.com/compute/api/factory'), origin);
  assert.equal(direct.status, 404, 'DO no longer accepts POST on the public factory path');
  const edge = await network.fetch(forge(`https://lobby.getdasha.com${HOSTED_FACTORY_BUMP_PATH}`, { 'cf-connecting-ip': '203.0.113.9' }), origin);
  assert.equal(edge.status, 404, 'edge-originated request to the internal path -> 404');
  assert.equal(snapshot(), before, 'forged calls: counters, settlements, receipts, chain tip, heads unchanged');
  // Public GET still works.
  const get = await computeApi(new Request('https://lobby.getdasha.com/compute/api/factory', { headers: { Origin: origin } }), env, origin);
  assert.equal(get.status, 200);
  assert.equal((await get.json()).schema, 'factory.compute.v0');
}

// 2) A real charged Hosted ask produces exactly one signed receipt from the charged record.
resetHostedRatesForTests();
const ask = () => computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json', Cookie: cookie, Origin: origin },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'what is six times seven?' }] }),
}), env, origin);
for (let i = 0; i < 3; i++) assert.equal((await ask()).status, 200, 'free floor ask');
assert.equal(count('compute:chain:seq:'), 0, 'free asks sign nothing');
const paid = await ask();
assert.equal(paid.status, 200, 'paid ask');
assert.equal(count('compute:chain:seq:'), 1, 'one paid ask -> one chained receipt');
assert.equal(count('compute:settled-replay:'), 1);
const spendKey = [...rows.keys()].find(k => k.startsWith(`compute:credit-spend:${owner}:hosted_`));
assert.ok(spendKey, 'charged record exists');
const requestId = spendKey.slice(`compute:credit-spend:${owner}:`.length);
const charged = rows.get(spendKey);
const receipt = [...rows].find(([k]) => k.startsWith('compute:chain:seq:'))[1];
assert.equal(receipt.cents, charged.cents, 'receipt cents come from the charged record');
const replayRow = rows.get(`compute:settled-replay:hosted:${requestId}`);
assert.equal(replayRow.owner, owner);
assert.equal(replayRow.request_id, requestId);
const factory = await (await computeApi(new Request('https://lobby.getdasha.com/compute/api/factory', { headers: { Origin: origin } }), env, origin)).json();
assert.equal(factory.jobs.hosted, 4, 'every hosted ask bumps the counter once');

const internal = (settle, extra = {}) => network.fetch(new Request(`https://lobby.getdasha.com${HOSTED_FACTORY_BUMP_PATH}`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify({ failed: false, settle }),
}), null);
const good = { owner, request_id: requestId, cents: charged.cents, usage: { prompt_tokens: 20, completion_tokens: 3, total_tokens: 23 } };

// 3) Replay: no second receipt, no counter change.
{
  const before = snapshot();
  const res = await internal(good);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).replay, true);
  assert.equal(snapshot(), before, 'replay writes nothing');
}

// 4) Mismatches are rejected before any write.
{
  const before = snapshot();
  const cases = [
    { ...good, cents: charged.cents + 1 },
    { ...good, cents: 99999 },
    { ...good, request_id: 'hosted_notarealid1' },
    { ...good, request_id: 'forged-id' },
    { ...good, owner: 'x:attacker' },
    { ...good, owner: null },
    { ...good, usage: { total_tokens: 9999999 } },
    { ...good, usage: null },
  ];
  for (const settle of cases) {
    const res = await internal(settle);
    assert.equal(res.status, 409, `mismatch rejected: ${JSON.stringify(settle)}`);
  }
  assert.equal(snapshot(), before, 'mismatched assertions write nothing');
}

// 5) A refunded charge can never be settled.
{
  const rid = 'hosted_refundedAAAA';
  await network.debitCredits(owner, { requestId: rid });
  await network.refundCredits(owner, { requestId: rid, reason: 'test' });
  const before = snapshot();
  const res = await internal({ owner, request_id: rid, cents: 5, usage: { total_tokens: 10 } });
  assert.equal(res.status, 409);
  assert.equal(snapshot(), before);
}

// 6) Free-floor (no settle) bump: counter only, nothing signed.
{
  const seq = count('compute:chain:seq:');
  const res = await network.fetch(new Request(`https://lobby.getdasha.com${HOSTED_FACTORY_BUMP_PATH}`, { method: 'POST', body: JSON.stringify({ failed: false }) }), null);
  assert.equal(res.status, 202);
  assert.equal(count('compute:chain:seq:'), seq);
}

console.log('dasha-compute-factory-forge.test.mjs: PASS');
