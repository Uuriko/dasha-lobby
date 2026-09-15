#!/usr/bin/env node
/** Gateway-side metering v1 + failover evidence v1: observe-only fields on jobs. */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'gateway-metering-secret',
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
const session = await createSessionToken(env, { xId: '42', handle: 'meter_mac' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const register = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Meter Mac', models: ['gemma3-27b'] }),
}), origin);
assert.equal(register.status, 201);
const credentials = await register.json();
const providerHeaders = { Authorization: `Bearer ${credentials.provider_token}`, 'Content-Type': 'application/json' };
const beatBody = { provider_id: credentials.provider_id, name: 'Meter Mac', models: ['gemma3-27b'] };

await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(beatBody),
}), origin);

const submit = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ model: 'gemma3-27b', prompt: 'Say hello from the Mac.' }),
}), origin);
assert.equal(submit.status, 202);
const submitted = await submit.json();

const poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(beatBody),
}), origin);
assert.equal(poll.status, 200);

// Provider reports wildly inflated completion tokens vs the short answer.
const result = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${submitted.id}/result`, {
  method: 'POST', headers: providerHeaders,
  body: JSON.stringify({
    provider_id: credentials.provider_id,
    content: 'Hello from the Mac.',
    usage: { prompt_tokens: 8, completion_tokens: 500, total_tokens: 508 },
  }),
}), origin);
assert.equal(result.status, 202);

const stored = rows.get(`compute:job:${submitted.id}`);
assert.ok(stored.usage_gateway, 'gateway measurement stored');
assert.equal(stored.usage_gateway.completion_tokens, Math.ceil('Hello from the Mac.'.length / 4));
assert.ok(stored.usage_gateway.prompt_tokens > 0, 'prompt measured from stored messages');
assert.equal(stored.usage_diverged, true, 'inflated provider report flagged');
assert.equal(stored.usage.completion_tokens, 500, 'provider-reported usage untouched (observe-only)');
assert.equal(stored.attempts.length, 1, 'one lease attempt recorded');
assert.equal(stored.attempts[0].outcome, 'complete');
assert.equal(stored.attempts[0].provider_id, credentials.provider_id);

const completed = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${submitted.id}`, { headers: userHeaders }), origin);
const done = await completed.json();
assert.ok(done.usage_gateway, 'jobs/:id exposes gateway measurement');
assert.equal(done.usage_diverged, true);
assert.equal(done.attempts_count, 1);
assert.equal(done.failed_over, undefined, 'single-attempt job is not a failover');

// Failover evidence: a cut job re-leased to a second provider shows attempts 2 + failed_over.
// The requeue shape after a cut/lease-expiry: queued, no provider, attempt log kept.
await storage.put(`compute:job:${submitted.id}`, {
  ...stored, status: 'queued', answer: null, usage: null, usage_gateway: null, usage_diverged: undefined,
  providerId: null, leasedAt: null, leaseExpiresAt: null,
  attempts: [{ provider_id: 'mac_first', leased_at: 1, outcome: 'cut' }],
});
const register2 = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Second Mac', models: ['gemma3-27b'] }),
}), origin);
const cred2 = await register2.json();
await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: { Authorization: `Bearer ${cred2.provider_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider_id: cred2.provider_id, name: 'Second Mac', models: ['gemma3-27b'] }),
}), origin);
const after = rows.get(`compute:job:${submitted.id}`);
assert.equal(after.attempts.length, 2, 're-lease appended a second attempt');
assert.equal(after.attempts[0].outcome, 'cut');
assert.equal(after.attempts[1].provider_id, cred2.provider_id);

console.log('dasha-compute-gateway-metering: PASS');
