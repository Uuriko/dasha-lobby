#!/usr/bin/env node
/**
 * API chat prepaid debit must reverse when the Mac fails.
 * Session Community Ask stays free. Complete jobs keep the $0.05.
 * Replay refund is a no-op. No wrangler. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { HOSTED_ASK_PRICE_CENTS } from './dasha-compute-credits.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

assert.equal(HOSTED_ASK_PRICE_CENTS, 5);

const env = { LOBBY_SESSION_SECRET: 'api-chat-fail-refund-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const session = await createSessionToken(env, { xId: 'refund-user', handle: 'refund_user' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
const now = Date.now();

const created = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'Refund', limit_cents: 500, limit_reset: 'monthly' }),
}), origin);
assert.equal(created.status, 201, await created.clone().text());
const keyBody = await created.json();
const apiHeaders = { Authorization: `Bearer ${keyBody.api_key}`, 'Content-Type': 'application/json' };

const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'Refund Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201);
const creds = await reg.json();
const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: creds.provider_id, name: 'Refund Mac', models: ['qwen3-8b'] };
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin)).status, 204);

await storage.put('compute:credit-balance:x:refund-user', { owner: 'x:refund-user', cents: 20, updatedAt: now });

function balance() {
  return Math.max(0, Math.floor(Number(rows.get('compute:credit-balance:x:refund-user')?.cents) || 0));
}
async function keySpend() {
  return Math.max(0, Math.floor(Number((await storage.get(`compute:api-key:${keyBody.id}`))?.spendCents) || 0));
}

async function leaseNext() {
  let poll;
  for (let attempt = 0; attempt < 40; attempt++) {
    poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
      method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
    }), origin);
    if (poll.status === 200) return poll.json();
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail(`provider poll never leased (last ${poll?.status})`);
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'cut' }] }),
  }));
  const leased = await leaseNext();
  for (let i = 0; i < 40 && balance() !== 15; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(balance(), 15, 'debit locks $0.05 on queue');
  assert.equal(await keySpend(), 5);
  const fail = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${leased.job.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({ provider_id: creds.provider_id, error: 'provider inference failed: URLError' }),
  }), origin);
  assert.equal(fail.status, 202);
  const res = await pending;
  assert.equal(res.status, 502, await res.clone().text());
  const body = await res.json();
  assert.match(body.error?.message || '', /provider inference failed/i);
  assert.equal(body.next?.[0]?.path, '/compute/api/v1/chat/completions');
  assert.equal(balance(), 20, 'fail refunds prepaid credits');
  assert.equal(await keySpend(), 0, 'fail refunds key spend cap');
  const spend = rows.get(`compute:credit-spend:x:refund-user:api:${leased.job.id}`);
  assert.ok(spend?.refundedAt, 'spend row marked refunded');
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'empty' }], stream: true }),
  }));
  const leased = await leaseNext();
  for (let i = 0; i < 40 && balance() !== 15; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(balance(), 15);
  const empty = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${leased.job.id}/chunk`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({ provider_id: creds.provider_id, done: true, usage: { prompt_tokens: 2, completion_tokens: 0, total_tokens: 2 } }),
  }), origin);
  assert.equal(empty.status, 202);
  const stream = await pending;
  assert.equal(stream.status, 200);
  const text = await stream.text();
  assert.match(text, /empty completion/);
  assert.equal(balance(), 20, 'empty completion refunds');
  assert.equal(await keySpend(), 0);
  await stream.body?.cancel?.().catch(() => {});
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'ok' }] }),
  }));
  const leased = await leaseNext();
  const ok = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${leased.job.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: creds.provider_id,
      content: 'hello',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  }), origin);
  assert.equal(ok.status, 202);
  const res = await pending;
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(balance(), 15, 'complete keeps the $0.05');
  assert.equal(await keySpend(), 5);
  const again = await network.refundJobDebit({
    owner: 'x:refund-user',
    debitRequestId: `api:${leased.job.id}`,
    debitKeyId: keyBody.id,
    debitCents: 5,
    status: 'complete',
  }, Date.now(), 'replay');
  assert.equal(again.ok, false);
  assert.equal(balance(), 15, 'complete job cannot refund');
}

{
  const first = await network.refundCredits('x:refund-user', { requestId: 'missing', now: Date.now(), reason: 'none' });
  assert.equal(first.ok, false);
  await network.debitCredits('x:refund-user', { cents: 5, reason: 'api-chat', requestId: 'rid-replay', now: Date.now() });
  assert.equal(balance(), 10);
  const refund = await network.refundCredits('x:refund-user', { requestId: 'rid-replay', now: Date.now(), reason: 'test' });
  assert.equal(refund.ok, true);
  assert.equal(refund.replay, false);
  assert.equal(balance(), 15);
  const replay = await network.refundCredits('x:refund-user', { requestId: 'rid-replay', now: Date.now(), reason: 'test' });
  assert.equal(replay.ok, true);
  assert.equal(replay.replay, true);
  assert.equal(replay.refunded_cents, 0);
  assert.equal(balance(), 15, 'replay refund does not double-credit');
}

assert.equal([...rows.keys()].some((k) => /email|phone|ssn/i.test(k)), false, 'no people-data keys');
console.log('dasha-compute-api-chat-fail-refund: PASS');
