#!/usr/bin/env node
/** ComputeNetwork in-memory happy path: register → verify → poll → heartbeat → result. */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-network-happy-secret',
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
const session = await createSessionToken(env, { xId: '42', handle: 'happy_mac' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const register = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST',
  headers: userHeaders,
  body: JSON.stringify({ name: 'Happy Mac', models: ['gemma3-27b', 'qwen3-8b'] }),
}), origin);
assert.equal(register.status, 201);
const credentials = await register.json();
assert.match(credentials.provider_id, /^mac_/);
assert.match(credentials.provider_token, /^dcp_/);
assert.equal(credentials.coordinator_url, 'https://lobby.getdasha.com/compute/api');
assert.equal(JSON.stringify([...rows.values()]).includes(credentials.provider_token), false);

const providerHeaders = {
  Authorization: `Bearer ${credentials.provider_token}`,
  'Content-Type': 'application/json',
};
const heartbeatBody = {
  provider_id: credentials.provider_id,
  name: 'Happy Mac',
  models: ['gemma3-27b'],
  hardware: { system: 'Darwin', machine: 'arm64', memory_gb: 36 },
};

const verified = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/verify', {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify(heartbeatBody),
}), origin);
assert.equal(verified.status, 200);
assert.deepEqual((await verified.json()).models, ['gemma3-27b', 'qwen3-8b']);

const idle = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify(heartbeatBody),
}), origin);
assert.equal(idle.status, 204);

const net = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/network'), origin)).json();
assert.equal(net.providers_online, 1);
assert.deepEqual(net.models_available, ['gemma3-27b']);

const submit = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST',
  headers: userHeaders,
  body: JSON.stringify({ model: 'gemma3-27b', prompt: 'Say hello from the Mac.' }),
}), origin);
assert.equal(submit.status, 202);
const submitted = await submit.json();

const poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify(heartbeatBody),
}), origin);
assert.equal(poll.status, 200);
const leased = await poll.json();
assert.equal(leased.job.id, submitted.id);
assert.equal(leased.job.messages.at(-1).content, 'Say hello from the Mac.');

const beat = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${submitted.id}/heartbeat`, {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id }),
}), origin);
assert.equal(beat.status, 200);
const beatBody = await beat.json();
assert.equal(beatBody.ok, true);
assert.equal(beatBody.cancelled, false);

const result = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${submitted.id}/result`, {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify({
    provider_id: credentials.provider_id,
    content: 'Hello from the Mac.',
    usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 },
  }),
}), origin);
assert.equal(result.status, 202);
assert.equal(rows.get(`compute:job:${submitted.id}`).messages, null);

const completed = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${submitted.id}`, {
  headers: userHeaders,
}), origin);
assert.equal(completed.status, 200);
const done = await completed.json();
assert.equal(done.status, 'complete');
assert.equal(done.answer, 'Hello from the Mac.');


// Stream:true community jobs return event-stream with X-Dasha-Job (poll JSON still when omitted).
const streamSubmit = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST',
  headers: userHeaders,
  body: JSON.stringify({ model: 'gemma3-27b', messages: [{ role: 'user', content: 'hi' }], stream: true }),
}), origin);
assert.equal(streamSubmit.status, 200);
assert.match(streamSubmit.headers.get('content-type') || '', /text\/event-stream/);
const jobId = streamSubmit.headers.get('X-Dasha-Job');
assert.match(jobId || '', /^job_/);
const sseText = streamSubmit.text();
const cancel = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${jobId}`, {
  method: 'DELETE',
  headers: userHeaders,
}), origin);
assert.equal(cancel.status, 200);
const sseBody = await sseText;
assert.match(sseBody, /\[DONE\]/);

const noStream = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST',
  headers: userHeaders,
  body: JSON.stringify({ model: 'gemma3-27b', messages: [{ role: 'user', content: 'hi again' }] }),
}), origin);
assert.equal(noStream.status, 202);
assert.match(noStream.headers.get('content-type') || '', /application\/json/);
const queuedJson = await noStream.json();
assert.match(queuedJson.id, /^job_/);
assert.equal(queuedJson.status, 'queued');
const drop = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${queuedJson.id}`, {
  method: 'DELETE',
  headers: userHeaders,
}), origin);
assert.equal(drop.status, 200);


console.log('dasha-compute-network-happy: PASS');
