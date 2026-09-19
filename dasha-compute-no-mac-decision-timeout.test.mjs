#!/usr/bin/env node
/**
 * P0-2 regression: v1 chat/completions must fail loud with no_mac_online when
 * the provider that was fresh at queue time flaps offline before pickup —
 * instead of polling silently until the 5-minute job TTL.
 *
 * Harness: API key + registered provider + heartbeat (fresh), POST chat, then
 * make the provider record stale before the server-side decision window fires
 * (COMPUTE_NO_MAC_DECISION_MS override keeps the test fast).
 * No wrangler. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { HOSTED_ASK_PRICE_CENTS } from './dasha-compute-credits.mjs';
import {
  ComputeNetwork,
  NO_MAC_DECISION_MS,
  providerAdvertisesModel,
} from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

assert.equal(HOSTED_ASK_PRICE_CENTS, 5);
assert.ok(Number.isFinite(NO_MAC_DECISION_MS) && NO_MAC_DECISION_MS >= 1000, 'sane production default');

// --- unit: providerAdvertisesModel ---
{
  const now = Date.now();
  const fresh = { lastSeenAt: now - 1000, models: ['qwen3-8b'] };
  const stale = { lastSeenAt: now - 60_000, models: ['qwen3-8b'] };
  const wrongModel = { lastSeenAt: now - 1000, models: ['gemma3-27b'] };
  assert.equal(providerAdvertisesModel([fresh], 'qwen3-8b', now), true);
  assert.equal(providerAdvertisesModel([stale], 'qwen3-8b', now), false, 'stale provider does not advertise');
  assert.equal(providerAdvertisesModel([wrongModel], 'qwen3-8b', now), false, 'wrong model does not advertise');
  assert.equal(providerAdvertisesModel([], 'qwen3-8b', now), false);
  assert.equal(providerAdvertisesModel(null, 'qwen3-8b', now), false);
}

// --- integration: flap between queue and pickup fails loud ---
const env = { LOBBY_SESSION_SECRET: 'no-mac-decision-secret', COMPUTE_NO_MAC_DECISION_MS: '400' };
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
assert.equal(network.noMacDecisionMs(), 400, 'env override honored');
assert.equal(new ComputeNetwork({ storage }, {}).noMacDecisionMs(), NO_MAC_DECISION_MS, 'default without override');

const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: 'nomac-user', handle: 'nomac_user' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const created = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'NoMac', limit_cents: 500, limit_reset: 'monthly' }),
}), origin);
assert.equal(created.status, 201, await created.clone().text());
const keyBody = await created.json();
const apiHeaders = { Authorization: `Bearer ${keyBody.api_key}`, 'Content-Type': 'application/json' };

const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'Flap Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201);
const creds = await reg.json();
const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: creds.provider_id, name: 'Flap Mac', models: ['qwen3-8b'] };
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin)).status, 204);

await storage.put('compute:credit-balance:x:nomac-user', { owner: 'x:nomac-user', cents: 20, updatedAt: Date.now() });
const balance = () => Math.max(0, Math.floor(Number(rows.get('compute:credit-balance:x:nomac-user')?.cents) || 0));
const keySpend = async () => Math.max(0, Math.floor(Number((await storage.get(`compute:api-key:${keyBody.id}`))?.spendCents) || 0));

const started = Date.now();
const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: apiHeaders,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'flap test' }] }),
}));

// Wait for the job to be queued, then flap the provider offline before the
// server-side decision window fires.
let jobId = null;
for (let i = 0; i < 200 && !jobId; i++) {
  for (const [k, v] of rows) if (k.startsWith('compute:job:') && v?.status === 'queued') { jobId = v.id; break; }
  if (!jobId) await new Promise((r) => setTimeout(r, 5));
}
assert.ok(jobId, 'job queued while provider was fresh');
const pkey = `compute:provider:${creds.provider_id}`;
const prow = await storage.get(pkey);
assert.ok(prow, 'provider record exists');
await storage.put(pkey, { ...prow, lastSeenAt: Date.now() - 120_000 });

const res = await pending;
const elapsed = Date.now() - started;
const text = await res.text();
assert.equal(res.status, 503, `expected 503 no_mac_online, got ${res.status}: ${text}`);
assert.ok(elapsed < 10_000, `fail-loud must beat the 5-minute TTL (took ${elapsed}ms)`);
const body = JSON.parse(text);
assert.equal(body.error?.message, 'No Mac is online.');
assert.equal(body.error?.type, 'server_error');
assert.equal(body.status, 'action_required');
assert.equal(body.reason, 'no_mac_online');
assert.ok(typeof body.hint === 'string' && body.hint.length > 0, 'hint present');
assert.ok(Array.isArray(body.next) && body.next.length >= 1, 'next[] present');
assert.equal(balance(), 20, 'prepaid credits refunded on no_mac_online');
assert.equal(await keySpend(), 0, 'key spend cap refunded on no_mac_online');
assert.equal(rows.get(`compute:job:${jobId}`), undefined, 'dead job removed from storage');

console.log(`PASS: no_mac_online fails loud on provider flap (${elapsed}ms, 503, envelope + refunds)`);
