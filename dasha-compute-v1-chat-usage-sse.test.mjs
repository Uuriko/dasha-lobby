#!/usr/bin/env node
/**
 * OpenRouter apply bar: POST /compute/api/v1/chat/completions must include usage
 * on successful non-stream JSON and on the SSE final stop chunk (community path).
 * Page Hosted /compute/api/chat SSE usage: see dasha-compute-hosted-chat-usage-sse.test.mjs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /finish_reason: 'stop' \}\], usage: current\.usage/);
assert.match(src, /usage: job\.usage \|\| \{ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 \}/);

const env = {
  LOBBY_SESSION_SECRET: 'v1-chat-usage-sse-secret',
  AI: { run: async () => ({ response: 'hosted-unused' }) },
};
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
const session = await createSessionToken(env, { xId: 'usage-sse', handle: 'usage_sse' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Usage Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201, await reg.clone().text());
const creds = await reg.json();
const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: creds.provider_id, name: 'Usage Mac', models: ['qwen3-8b'] };
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin)).status, 204);

const keyCreated = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'usage-sse', limit_cents: null, limit_reset: 'none' }),
}), origin);
assert.equal(keyCreated.status, 201, await keyCreated.clone().text());
const developerKey = await keyCreated.json();
await storage.put('compute:credit-balance:x:usage-sse', { owner: 'x:usage-sse', cents: 1000, updatedAt: Date.now() });
const apiHeaders = { Authorization: `Bearer ${developerKey.api_key}`, 'Content-Type': 'application/json' };

async function pollJob() {
  let poll;
  for (let attempt = 0; attempt < 40; attempt++) {
    poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
      method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
    }), origin);
    if (poll.status === 200) return poll;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail(`provider poll never leased a job (last ${poll?.status})`);
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'nonstream usage' }] }),
  }));
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const job = (await poll.json()).job;
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: creds.provider_id,
      content: 'usage ok',
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }),
  }), origin)).status, 202);
  const res = await pending;
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.object, 'chat.completion');
  assert.equal(body.choices[0].message.content, 'usage ok');
  assert.deepEqual(body.usage, { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 });
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({
      model: 'qwen3-8b',
      stream: true,
      messages: [{ role: 'user', content: 'stream usage' }],
    }),
  }));
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const job = (await poll.json()).job;
  assert.equal(job.stream, true);
  for (const chunk of [
    { delta: 'hi ' },
    { delta: 'there', done: true, usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } },
  ]) {
    assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/chunk`, {
      method: 'POST', headers: providerHeaders,
      body: JSON.stringify({ provider_id: creds.provider_id, ...chunk }),
    }), origin)).status, 202);
  }
  const res = await pending;
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
  const text = await res.text();
  assert.match(text, /"content":"hi "/);
  assert.match(text, /"content":"there"/);
  assert.match(text, /"finish_reason":"stop"/);
  assert.match(text, /"prompt_tokens":5/);
  assert.match(text, /"completion_tokens":2/);
  assert.match(text, /"total_tokens":7/);
  assert.match(text, /data: \[DONE\]/);
  const stopChunk = [...text.matchAll(/^data: (\{.*\})\s*$/gm)]
    .map((m) => JSON.parse(m[1]))
    .find((c) => c?.choices?.[0]?.finish_reason === 'stop');
  assert.ok(stopChunk, 'SSE must emit a stop chunk');
  assert.deepEqual(stopChunk.usage, { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 });
}

console.log('dasha-compute-v1-chat-usage-sse.test.mjs: PASS');
