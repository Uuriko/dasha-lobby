#!/usr/bin/env node
/**
 * #300 regression: provider-reported usage cannot inflate payouts or signed settlements.
 * - 10M-token report for a tiny answer -> no earning, no paid receipt, job in review (result + stream).
 * - Honest report within tolerance settles exactly once, billed at min(provider, gateway).
 * - Reposting a quarantined completion cannot create earnings.
 * - Repeated divergence trips the per-provider anomaly hold.
 * - Operator acceptance settles once on gateway-capped usage; replays are no-ops.
 */
import assert from 'node:assert/strict';
import { ComputeNetwork, PROVIDER_ANOMALY_THRESHOLD, USAGE_REVIEW_PREFIX } from './dasha-compute-network.mjs';
import { accrueProviderEarn } from './dasha-compute-provider-earn.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const origin = 'https://www.getdasha.com';
const env = {
  ALLOWED_ORIGINS: origin,
  LOBBY_SESSION_SECRET: 'usage-divergence-secret',
  DASHA_HEADS_ED25519_SK: Buffer.from(new Uint8Array(32).fill(13)).toString('base64'),
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, structuredClone(item));
    else rows.set(key, structuredClone(value));
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const count = (prefix) => [...rows.keys()].filter(k => k.startsWith(prefix)).length;
const network = new ComputeNetwork({ storage }, env);
const session = await createSessionToken(env, { xId: '300', handle: 'div_mac' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

async function provider(name) {
  const res = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ name, models: ['qwen3-8b'] }),
  }), origin);
  assert.equal(res.status, 201);
  const c = await res.json();
  return { id: c.provider_id, headers: { Authorization: `Bearer ${c.provider_token}`, 'Content-Type': 'application/json' } };
}
const now = Date.now();
async function leased(p, id, { stream = false } = {}) {
  await storage.put(`compute:job:${id}`, {
    id, owner: 'x:buyer', model: 'qwen3-8b', route: 'community', stream, status: 'leased', providerId: p.id, chunks: [],
    messages: [{ role: 'user', content: 'Say hi.' }], leaseExpiresAt: now + 60_000, expiresAt: now + 120_000, createdAt: now,
  });
}
const post = (p, id, kind, payload) => network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${id}/${kind}`, {
  method: 'POST', headers: p.headers, body: JSON.stringify({ provider_id: p.id, ...payload }),
}), origin);
const huge = { prompt_tokens: 5, completion_tokens: 10_000_000, total_tokens: 10_000_005 };
const noSettle = (id) => {
  assert.equal(rows.get(`compute:provider-earn-job:${id}`), undefined, `${id}: no earn replay marker`);
  assert.equal(rows.get(`compute:settled-replay:job:${id}`), undefined, `${id}: no settled receipt`);
  const job = rows.get(`compute:job:${id}`);
  assert.equal(job.settle_state, 'review', `${id}: job in review`);
  assert.equal('settle_cents' in job, false);
  assert.equal(rows.get(`${USAGE_REVIEW_PREFIX}${id}`)?.state, 'open');
};

// 1) Non-stream: 10M tokens for "hi" -> review, nothing paid or signed.
const mac = await provider('Div Mac');
await leased(mac, 'job_div_result');
assert.equal((await post(mac, 'job_div_result', 'result', { content: 'hi', usage: huge })).status, 202);
noSettle('job_div_result');
assert.equal(rows.get(`compute:provider-earn:${mac.id}`), undefined, 'no earnings row');
assert.equal(count('compute:chain:seq:'), 0, 'nothing signed');

// 2) Stream: same report, same outcome.
await leased(mac, 'job_div_stream', { stream: true });
assert.equal((await post(mac, 'job_div_stream', 'chunk', { delta: 'hi', done: false })).status, 202);
assert.equal((await post(mac, 'job_div_stream', 'chunk', { delta: '', done: true, usage: huge })).status, 202);
noSettle('job_div_stream');
assert.equal(count('compute:chain:seq:'), 0);

// 3) Reposting a quarantined completion cannot earn.
assert.equal((await post(mac, 'job_div_result', 'result', { content: 'hi', usage: { completion_tokens: 1 } })).status, 409, 'completed job rejects repost');
await storage.put('compute:job:job_div_result', { ...rows.get('compute:job:job_div_result'), status: 'leased', leaseExpiresAt: now + 60_000 });
assert.equal((await post(mac, 'job_div_result', 'result', { content: 'hi', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })).status, 202);
noSettle('job_div_result');
assert.equal((await accrueProviderEarn(storage, { providerId: mac.id, jobId: 'job_div_result', usage: huge })).ok, false, 'direct accrue refused while in review');
assert.equal(rows.get(`compute:provider-earn:${mac.id}`), undefined);

// 4) Honest report within tolerance settles once, billed at min(provider, gateway).
const honest = await provider('Honest Mac');
const answer = 'word '.repeat(800); // 4000 chars -> 1000 gateway completion tokens
await leased(honest, 'job_honest');
assert.equal((await post(honest, 'job_honest', 'result', { content: answer, usage: { prompt_tokens: 3, completion_tokens: 1100, total_tokens: 1103 } })).status, 202);
const hj = rows.get('compute:job:job_honest');
assert.equal(hj.settle_state, 'pending_operator');
assert.equal(hj.usage_billed.completion_tokens, 1000, 'billed at gateway count');
assert.equal(hj.settle_cents, 6);
assert.equal(rows.get(`compute:provider-earn:${honest.id}`).usdc_cents, 6);
assert.equal(rows.get(`compute:provider-earn:${honest.id}`).jobs, 1);
assert.equal(count('compute:chain:seq:'), 1, 'one signed receipt');
assert.equal(rows.get('compute:settled-replay:job:job_honest').tokens, rows.get('compute:job:job_honest').usage_billed.total_tokens);
await storage.put('compute:job:job_honest', { ...hj, status: 'leased', leaseExpiresAt: now + 60_000 });
await post(honest, 'job_honest', 'result', { content: answer, usage: { prompt_tokens: 3, completion_tokens: 1000, total_tokens: 1003 } });
assert.equal(rows.get(`compute:provider-earn:${honest.id}`).jobs, 1, 'settles exactly once');
assert.equal(count('compute:chain:seq:'), 1);

// 5) Repeated divergence trips the per-provider anomaly hold; honest jobs from that provider then go to review.
for (let i = count(`compute:provider-anomaly:${mac.id}`) ? 2 : 0; i < PROVIDER_ANOMALY_THRESHOLD; i++) {
  await leased(mac, `job_div_more_${i}`);
  await post(mac, `job_div_more_${i}`, 'result', { content: 'hi', usage: huge });
}
assert.equal(rows.get(`compute:provider-anomaly:${mac.id}`).held, true, 'provider held');
await leased(mac, 'job_after_hold');
await post(mac, 'job_after_hold', 'result', { content: answer, usage: { prompt_tokens: 3, completion_tokens: 1000, total_tokens: 1003 } });
noSettle('job_after_hold');
assert.equal(rows.get(`${USAGE_REVIEW_PREFIX}job_after_hold`).reason, 'provider_anomaly_hold');

// 6) Operator acceptance settles once on gateway-capped usage; replay is a no-op.
const accepted = await network.acceptUsageReview('job_div_stream', { reviewer: 'test' });
assert.equal(accepted.ok, true);
assert.equal(rows.get(`${USAGE_REVIEW_PREFIX}job_div_stream`).state, 'accepted');
const earned = rows.get(`compute:provider-earn-job:job_div_stream`);
assert.ok(earned, 'earn marker only written on acceptance');
assert.equal(earned.completion_tokens, 1, 'accepted at gateway count, not 10M');
assert.equal(earned.usdc_cents, 5);
const seq = count('compute:chain:seq:');
assert.equal((await network.acceptUsageReview('job_div_stream')).replay, true);
assert.equal(count('compute:chain:seq:'), seq, 'accept replay signs nothing');

console.log('dasha-compute-usage-divergence.test.mjs: PASS');
