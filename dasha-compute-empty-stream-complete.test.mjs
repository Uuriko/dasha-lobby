#!/usr/bin/env node
/** Stream done with zero deltas must fail closed (parity with non-stream empty result). */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'empty-stream-complete-secret',
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
const session = await createSessionToken(env, { xId: '77', handle: 'empty_stream' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const register = await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/register', {
  method: 'POST',
  headers: userHeaders,
  body: JSON.stringify({ name: 'Empty Stream Mac', models: ['gemma3-27b'] }),
}), origin);
assert.equal(register.status, 201);
const credentials = await register.json();
const providerHeaders = {
  Authorization: `Bearer ${credentials.provider_token}`,
  'Content-Type': 'application/json',
};
await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/verify', {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, name: 'Empty Stream Mac', models: ['gemma3-27b'] }),
}), origin);
const idle = await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, name: 'Empty Stream Mac', models: ['gemma3-27b'] }),
}), origin);
assert.equal(idle.status, 204);

const submit = await network.fetch(new Request('https://www.getdasha.com/compute/api/jobs', {
  method: 'POST',
  headers: userHeaders,
  body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], model: 'gemma3-27b', stream: true }),
}), origin);
assert.equal(submit.status, 200);
assert.match(submit.headers.get('content-type') || '', /text\/event-stream/);
const jobId = submit.headers.get('X-Dasha-Job');
assert.ok(jobId);

const poll = await network.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, name: 'Empty Stream Mac', models: ['gemma3-27b'] }),
}), origin);
assert.equal(poll.status, 200);
const leased = await poll.json();
assert.equal(leased.job.id, jobId);

const emptyDone = await network.fetch(new Request(`https://www.getdasha.com/compute/api/providers/jobs/${jobId}/chunk`, {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, done: true, finish_reason: 'stop', usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3 } }),
}), origin);
assert.equal(emptyDone.status, 202);

const shown = await network.fetch(new Request(`https://www.getdasha.com/compute/api/jobs/${jobId}`, { headers: userHeaders }), origin);
assert.equal(shown.status, 200);
const body = await shown.json();
assert.equal(body.status, 'failed');
assert.match(String(body.error || ''), /empty completion/i);
assert.equal(body.answer, null);

const factory = await (await network.fetch(new Request('https://www.getdasha.com/compute/api/factory'), origin)).json();
assert.ok(Number(factory.jobs?.failed) >= 1, 'empty stream counts as failed, not community success');

rows.clear();
const network2 = new ComputeNetwork({ storage }, env);
const session2 = await createSessionToken(env, { xId: '78', handle: 'ok_stream' });
const user2 = { Cookie: `${COOKIE}=${session2}`, Origin: origin, 'Content-Type': 'application/json' };
const reg2 = await network2.fetch(new Request('https://www.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: user2, body: JSON.stringify({ name: 'Ok Mac', models: ['gemma3-27b'] }),
}), origin);
const cred2 = await reg2.json();
const prov2 = { Authorization: `Bearer ${cred2.provider_token}`, 'Content-Type': 'application/json' };
await network2.fetch(new Request('https://www.getdasha.com/compute/api/providers/verify', {
  method: 'POST', headers: prov2, body: JSON.stringify({ provider_id: cred2.provider_id, name: 'Ok Mac', models: ['gemma3-27b'] }),
}), origin);
assert.equal((await network2.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: prov2, body: JSON.stringify({ provider_id: cred2.provider_id, name: 'Ok Mac', models: ['gemma3-27b'] }),
}), origin)).status, 204);
const sub2 = await network2.fetch(new Request('https://www.getdasha.com/compute/api/jobs', {
  method: 'POST', headers: user2, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], model: 'gemma3-27b', stream: true }),
}), origin);
const job2 = sub2.headers.get('X-Dasha-Job');
await network2.fetch(new Request('https://www.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: prov2, body: JSON.stringify({ provider_id: cred2.provider_id, name: 'Ok Mac', models: ['gemma3-27b'] }),
}), origin);
await network2.fetch(new Request(`https://www.getdasha.com/compute/api/providers/jobs/${job2}/chunk`, {
  method: 'POST', headers: prov2, body: JSON.stringify({ provider_id: cred2.provider_id, delta: 'hello' }),
}), origin);
await network2.fetch(new Request(`https://www.getdasha.com/compute/api/providers/jobs/${job2}/chunk`, {
  method: 'POST', headers: prov2, body: JSON.stringify({ provider_id: cred2.provider_id, done: true, usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } }),
}), origin);
const ok = await (await network2.fetch(new Request(`https://www.getdasha.com/compute/api/jobs/${job2}`, { headers: user2 }), origin)).json();
assert.equal(ok.status, 'complete');
assert.equal(ok.answer, 'hello');

console.log('dasha-compute-empty-stream-complete: PASS');
