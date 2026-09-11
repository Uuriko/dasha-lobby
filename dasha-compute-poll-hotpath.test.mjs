#!/usr/bin/env node
/**
 * Provider poll is the hottest DO path (kit loops ~1s).
 * Expire/requeue jobs in one list; skip night + provider GC on poll.
 * Lease expiry without stream progress still requeues. No wrangler.
 */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = { LOBBY_SESSION_SECRET: 'poll-hotpath-secret' };
const rows = new Map();
const lists = [];
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) {
    lists.push(prefix);
    return new Map([...rows].filter(([k]) => k.startsWith(prefix)));
  },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: 'poll-hot', handle: 'poll_hot' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const reg = await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Hot Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201);
const creds = await reg.json();
const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: creds.provider_id, name: 'Hot Mac', models: ['qwen3-8b'] };

assert.equal((await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin)).status, 204);

rows.set('compute:night:night_idle', {
  id: 'night_idle',
  owner: 'x:other',
  title: 'should not run on poll',
  prompt: 'stay parked',
  model: 'qwen3-8b',
  template: 'custom',
  repeat: 'none',
  status: 'scheduled',
  stepIndex: 0,
  nextRunAt: Date.now() - 1000,
  createdAt: Date.now() - 2000,
});

lists.length = 0;
const idle = await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin);
assert.equal(idle.status, 204);
const jobLists = lists.filter((p) => p === 'compute:job:');
const nightLists = lists.filter((p) => p === 'compute:night:');
const providerLists = lists.filter((p) => p === 'compute:provider:');
assert.equal(jobLists.length, 1, `poll should list jobs once, got ${jobLists.length} (${lists.join(',')})`);
assert.equal(nightLists.length, 0, 'poll must not scan night tasks');
assert.equal(providerLists.length, 0, 'poll must not GC-scan providers');
assert.equal(rows.get('compute:night:night_idle').status, 'scheduled', 'due night stays parked on poll');

const staleNow = Date.now();
rows.set('compute:job:job_stalelease', {
  id: 'job_stalelease',
  owner: 'x:buyer',
  model: 'qwen3-8b',
  route: 'community',
  status: 'leased',
  stream: false,
  messages: [{ role: 'user', content: 'requeue me' }],
  maxTokens: 32,
  temperature: 0.6,
  providerId: 'mac_gone',
  createdAt: staleNow - 10_000,
  leaseExpiresAt: staleNow - 1,
  expiresAt: staleNow + 60_000,
});
const relist = await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin);
assert.equal(relist.status, 200, await relist.clone().text());
const leased = await relist.json();
assert.equal(leased.job.id, 'job_stalelease', 'expired lease without tokens requeues on poll');
assert.equal(leased.job.messages.at(-1).content, 'requeue me');

console.log('dasha-compute-poll-hotpath: PASS');
