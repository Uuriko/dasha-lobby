#!/usr/bin/env node
/**
 * Provider poll is the hottest DO path (kit loops ~1s).
 * After the first prune, idle polls list queued/leased stubs — not every compute:job:.
 * Night + provider GC stay off poll. Expired leases requeue from the leased index.
 * No wrangler.
 */
import assert from 'node:assert/strict';
import {
  ComputeNetwork,
  JOB_LEASED_PREFIX,
  JOB_QUEUED_PREFIX,
  POLL_FULL_PRUNE_MS,
  jobLeasedKey,
} from './dasha-compute-network.mjs';
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

// Park a completed job so a naive full job-list would grow with history.
const doneAt = Date.now();
rows.set('compute:job:job_history', {
  id: 'job_history',
  owner: 'x:done',
  model: 'qwen3-8b',
  status: 'complete',
  createdAt: doneAt - 30_000,
  expiresAt: doneAt + 9 * 60_000,
});

lists.length = 0;
const idle = await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin);
assert.equal(idle.status, 204);
const jobLists = lists.filter((p) => p === 'compute:job:');
const nightLists = lists.filter((p) => p === 'compute:night:');
const providerLists = lists.filter((p) => p === 'compute:provider:');
const queuedLists = lists.filter((p) => p === JOB_QUEUED_PREFIX);
const leasedLists = lists.filter((p) => p === JOB_LEASED_PREFIX);
assert.equal(jobLists.length, 0, `idle poll must not list all jobs, got ${jobLists.length} (${lists.join(',')})`);
assert.ok(queuedLists.length >= 1, 'idle poll reads queued index');
assert.ok(leasedLists.length >= 1, 'idle poll reads leased index');
assert.equal(nightLists.length, 0, 'poll must not scan night tasks');
assert.equal(providerLists.length, 0, 'poll must not GC-scan providers');
assert.equal(rows.get('compute:night:night_idle').status, 'scheduled', 'due night stays parked on poll');
assert.ok(POLL_FULL_PRUNE_MS >= 10_000, 'full prune stays off the 1s loop');

const staleNow = Date.now();
const stale = {
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
};
rows.set('compute:job:job_stalelease', stale);
rows.set(jobLeasedKey(stale.id), {
  id: stale.id,
  owner: stale.owner,
  leaseExpiresAt: stale.leaseExpiresAt,
  stream: false,
  hasProgress: false,
});
lists.length = 0;
const relist = await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin);
assert.equal(relist.status, 200, await relist.clone().text());
const leased = await relist.json();
assert.equal(leased.job.id, 'job_stalelease', 'expired lease without tokens requeues from leased index');
assert.equal(leased.job.messages.at(-1).content, 'requeue me');
assert.equal(lists.filter((p) => p === 'compute:job:').length, 0, 'index requeue does not list all jobs');

console.log('dasha-compute-poll-hotpath: PASS');
