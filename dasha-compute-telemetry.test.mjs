#!/usr/bin/env node
/**
 * Funnel telemetry (task 22): POST /compute/api/event intake + public /compute/api/metrics rollup.
 * Aggregate counters only - anon_id rate-limits but is never stored; no emails/prompts.
 */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-telemetry-test-secret',
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
const ANON = '123e4567-e89b-42d3-a456-426614174000';
const post = (body, anon) => network.fetch(new Request('https://lobby.getdasha.com/compute/api/event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify(body),
}), origin);

// valid beacon -> 202
let res = await post({ name: 'page', step: 'view', anon_id: ANON });
assert.equal(res.status, 202, 'beacon accepted');
await post({ name: 'page', step: 'view', anon_id: ANON });
await post({ name: 'signin', step: 'start:email', anon_id: ANON });

// validation
assert.equal((await post({ name: 'hack', step: 'view', anon_id: ANON })).status, 400, 'unknown name rejected');
assert.equal((await post({ name: 'page', step: 'bad step!', anon_id: ANON })).status, 400, 'bad step rejected');
assert.equal((await post({ name: 'page', step: 'view', anon_id: 'not-a-uuid' })).status, 400, 'bad anon rejected');
assert.equal((await post({ name: 'page', step: 'view' })).status, 400, 'missing anon rejected');
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/event'), origin)).status, 405, 'GET rejected');

// rollup
res = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/metrics'), origin);
assert.equal(res.status, 200);
assert.equal(res.headers.get('Cache-Control'), 'public, max-age=60');
const metrics = await res.json();
const today = new Date().toISOString().slice(0, 10);
assert.equal(metrics.days[today]['page:view'], 2, 'two page views counted');
assert.equal(metrics.days[today]['signin:start:email'], 1, 'signin start by method counted');

// anon_id never persisted
assert.ok(!JSON.stringify([...rows.keys()]).includes(ANON), 'anon id not in keys');
assert.ok(!JSON.stringify([...rows.values()]).includes(ANON), 'anon id not in values');

// server-side bumps: register + key create
const session = await createSessionToken(env, { xId: '99', handle: 'telemetry_mac' });
const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers, body: JSON.stringify({ name: 'Telemetry Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201);
const key = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers, body: JSON.stringify({ name: 'telemetry key' }),
}), origin);
assert.equal(key.status, 201);

// hourly north-star sample via /network
await network.fetch(new Request('https://lobby.getdasha.com/compute/api/network'), origin);
res = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/metrics'), origin);
const m2 = await res.json();
assert.equal(m2.days[today]['provider:register'], 1, 'register counted');
assert.equal(m2.days[today]['key:create'], 1, 'key create counted');
const hour = new Date().toISOString().slice(0, 13);
assert.equal(typeof m2.providers_online_hourly[hour], 'number', 'hourly providers sample present');

console.log('dasha-compute-telemetry: PASS');
