#!/usr/bin/env node
/** Fleet scorecard endpoint (steal 3): per-provider rows with measured tok/s,
 *  jobs served (7d, durable day-bucketed counters), trailing-7d uptime %.
 *  Honest empty fleet. */
import assert from 'node:assert/strict';
import { ComputeNetwork, providerJobsServed7d, providerUptimePct7d } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'fleet-endpoint-test-secret',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) {
    return new Map([...rows].filter(([key]) => key.startsWith(prefix)));
  },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: '7', handle: 'fleet_mac' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const fleetUrl = 'https://lobby.getdasha.com/compute/api/v1/fleet';
const get = () => network.fetch(new Request(fleetUrl), origin);

// 1. Honest empty fleet: no spinner, empty array.
{
  const res = await get();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.object, 'fleet.compute.v0');
  assert.deepEqual(body.providers, []);
  assert.ok(body.checked_at);
}

// 2. Register + poll a provider with benchmarks; fleet shows one honest row.
const register = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders,
  body: JSON.stringify({ name: 'Fleet Mac', models: ['qwen3-4b', 'qwen3-8b'] }),
}), origin);
assert.equal(register.status, 201);
const credentials = await register.json();
const providerHeaders = {
  Authorization: `Bearer ${credentials.provider_token}`,
  'Content-Type': 'application/json',
};
const now = Date.now();
const poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders,
  body: JSON.stringify({
    provider_id: credentials.provider_id,
    name: 'Fleet Mac',
    models: ['qwen3-4b'],
    hardware: { benchmarks: [{ model: 'qwen3-4b', tokens_per_second: 46.53 }] },
  }),
}), origin);
assert.ok([200, 204].includes(poll.status), `poll status ${poll.status}`);

{
  const res = await get();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.providers.length, 1);
  const row = body.providers[0];
  assert.equal(row.name, 'Fleet Mac');
  assert.equal(row.online, true);
  assert.deepEqual(row.models, [{ model: 'qwen3-4b', tokens_per_second: 46.53 }]);
  assert.equal(row.jobs_served_7d, 0);
  // Fresh provider: uptime must be null, never a fake 100%.
  assert.equal(row.uptime_pct_7d, null);
  // No sensitive fields leak.
  assert.ok(!('owner' in row) && !('id' in row) && !('tokenHash' in row));
}

// 3. Poll wrote the heartbeat hour bucket (uptime ledger).
{
  const hours = [...rows.keys()].filter(k => k.startsWith(`compute:provider-hour:${credentials.provider_id}:`));
  assert.equal(hours.length, 1);
}

// 4. uptime helper: null until a full day of history; % afterwards.
{
  const fresh = await providerUptimePct7d(storage, { id: 'x', createdAt: now - 3600_000 }, now);
  assert.equal(fresh, null);
  const created = now - 3 * 24 * 3600_000;
  for (let h = 0; h < 72; h++) {
    await storage.put(`compute:provider-hour:mac_old:${new Date(now - h * 3600_000).toISOString().slice(0, 13)}`, 1);
  }
  const pct = await providerUptimePct7d(storage, { id: 'mac_old', createdAt: created }, now);
  assert.ok(pct >= 99 && pct <= 100, `uptime pct ${pct}`);
  // Half the buckets missing → ~50%.
  for (let h = 0; h < 72; h += 2) {
    await storage.delete(`compute:provider-hour:mac_old:${new Date(now - h * 3600_000).toISOString().slice(0, 13)}`);
  }
  const half = await providerUptimePct7d(storage, { id: 'mac_old', createdAt: created }, now);
  assert.ok(half >= 49 && half <= 51, `half uptime ${half}`);
}

// 5. jobs_served_7d comes from durable day-bucketed counters, not live job rows.
// Complete a real job end to end; the counter increments once. Failed jobs do not count.
{
  const keyRes = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Fleet', limit_cents: 500, limit_reset: 'monthly' }),
  }), origin);
  assert.equal(keyRes.status, 201, await keyRes.clone().text());
  const keyBody = await keyRes.json();
  const apiHeaders = { Authorization: `Bearer ${keyBody.api_key}`, 'Content-Type': 'application/json' };
  await storage.put('compute:credit-balance:x:7', { owner: 'x:7', cents: 20, updatedAt: Date.now() });

  const heartbeat = { provider_id: credentials.provider_id, name: 'Fleet Mac', models: ['qwen3-4b'] };
  async function leaseNext() {
    for (let attempt = 0; attempt < 40; attempt++) {
      const poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
        method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
      }), origin);
      if (poll.status === 200) return poll.json();
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.fail('provider poll never leased');
  }

  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-4b', messages: [{ role: 'user', content: 'hello' }] }),
  }), origin);
  const leased = await leaseNext();
  const done = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${leased.job.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({ provider_id: credentials.provider_id, content: 'hi there', usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }),
  }), origin);
  assert.equal(done.status, 202);
  const res = await pending;
  assert.equal(res.status, 200, await res.clone().text());

  const dayBucket = new Date().toISOString().slice(0, 10);
  assert.equal(await storage.get(`compute:provider-jobs:${credentials.provider_id}:${dayBucket}`), 1);
  assert.equal(await providerJobsServed7d(storage, credentials.provider_id), 1);
  const fleetRes = await get();
  const fleetBody = await fleetRes.json();
  assert.equal(fleetBody.providers[0].jobs_served_7d, 1);

  // A failed job is not "served": the counter stays at 1.
  const pending2 = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-4b', messages: [{ role: 'user', content: 'boom' }] }),
  }), origin);
  const leased2 = await leaseNext();
  const failed = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${leased2.job.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({ provider_id: credentials.provider_id, error: 'provider inference failed' }),
  }), origin);
  assert.equal(failed.status, 202);
  await pending2;
  assert.equal(await providerJobsServed7d(storage, credentials.provider_id), 1);
}

// 6. Offline provider drops out of the fleet (stale lastSeenAt).
{
  const provider = await storage.get(`compute:provider:${credentials.provider_id}`);
  await storage.put(`compute:provider:${credentials.provider_id}`, { ...provider, lastSeenAt: now - 3600_000 });
  const res = await get();
  const body = await res.json();
  assert.deepEqual(body.providers, []);
}

// 7. Splash tier: the heartbeat's engines advertisement is retained and exposed
// per model; unknown engines and unlisted models are sanitized away.
{
  const pollSplash = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: credentials.provider_id,
      name: 'Fleet Mac',
      models: ['qwen3-4b', 'qwen3-8b'],
      engines: {
        'qwen3-8b': { engine: 'splash', package: 'incoai/Qwen3.8-27B-Splash', port: 8000 },
        'qwen3-4b': { engine: 'mystery-engine', package: 'x/y' },
        'not-listed': { engine: 'splash', package: 'x/y' },
      },
    }),
  }), origin);
  assert.ok([200, 204].includes(pollSplash.status), `splash poll status ${pollSplash.status}`);
  const res = await get();
  const body = await res.json();
  const row = body.providers[0];
  const m8b = row.models.find(m => m.model === 'qwen3-8b');
  const m4b = row.models.find(m => m.model === 'qwen3-4b');
  assert.equal(m8b.engine, 'splash');
  assert.ok(!('engine' in m4b), 'unknown engine must not leak');
  // Private details (package/port) stay server-side.
  assert.ok(!('package' in m8b) && !('port' in m8b));
  const stored = await storage.get(`compute:provider:${credentials.provider_id}`);
  assert.deepEqual(Object.keys(stored.engines || {}), ['qwen3-8b']);
}

console.log('fleet endpoint: ok');
