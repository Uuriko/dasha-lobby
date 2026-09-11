#!/usr/bin/env node
/**
 * LiteLLM-style spend visibility on POST /compute/api/v1/chat/completions.
 * Headers only — OpenAI-compat body stays intact.
 * Community never invents USD. skill.md + llms.txt mention the headers.
 * No wrangler. No guest-mint rewrite. No Room. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ComputeNetwork,
  dashaChatSpendHeaders,
} from './dasha-compute-network.mjs';
import { COMPUTE_LLMS_TXT, COMPUTE_SKILL_MD } from './dasha-compute-agent.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /dashaChatSpendHeaders/);
assert.match(src, /X-Dasha-Spend-Usd/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);

{
  const community = dashaChatSpendHeaders({ route: 'community', model: 'qwen3-8b' });
  assert.equal(community['X-Dasha-Route'], 'community');
  assert.equal(community['X-Dasha-Model'], 'qwen3-8b');
  assert.equal(community['X-Dasha-Spend-Usd'], undefined, 'community omits unknown USD');

  const mixture = dashaChatSpendHeaders({ route: 'mixture', model: 'gemma3-12b' });
  assert.equal(mixture['X-Dasha-Route'], 'community', 'Mac routes collapse to community');
  assert.equal(mixture['X-Dasha-Spend-Usd'], undefined);

  const hosted = dashaChatSpendHeaders({ route: 'hosted', model: 'gpt-oss-20b', spendCents: 5 });
  assert.equal(hosted['X-Dasha-Route'], 'hosted');
  assert.equal(hosted['X-Dasha-Model'], 'gpt-oss-20b');
  assert.equal(hosted['X-Dasha-Spend-Usd'], '0.05');

  const free = dashaChatSpendHeaders({ route: 'hosted', model: 'gpt-oss-20b', spendCents: 0 });
  assert.equal(free['X-Dasha-Spend-Usd'], '0.00', 'known $0 is honest, not omitted');

  const invented = dashaChatSpendHeaders({
    route: 'community',
    model: 'qwen3-8b',
    spendCents: null,
  });
  assert.equal(invented['X-Dasha-Spend-Usd'], undefined, 'null spend never becomes pennies');
}

assert.match(COMPUTE_SKILL_MD, /x-dasha-route/);
assert.match(COMPUTE_SKILL_MD, /x-dasha-spend-usd/);
assert.match(COMPUTE_SKILL_MD, /Community omits USD when unknown/);
assert.match(COMPUTE_LLMS_TXT, /x-dasha-route/);
assert.match(COMPUTE_LLMS_TXT, /x-dasha-spend-usd/);
assert.match(COMPUTE_LLMS_TXT, /Community omits unknown USD/);

const env = {
  LOBBY_SESSION_SECRET: 'v1-chat-spend-headers-secret',
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
const session = await createSessionToken(env, { xId: 'spend-hdr', handle: 'spend_hdr' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Spend Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201, await reg.clone().text());
const creds = await reg.json();
const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: creds.provider_id, name: 'Spend Mac', models: ['qwen3-8b'] };
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin)).status, 204);

const keyCreated = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'spend-hdr', limit_cents: null, limit_reset: 'none' }),
}), origin);
assert.equal(keyCreated.status, 201, await keyCreated.clone().text());
const developerKey = await keyCreated.json();
await storage.put('compute:credit-balance:x:spend-hdr', { owner: 'x:spend-hdr', cents: 1000, updatedAt: Date.now() });
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

function assertCommunitySpendHeaders(res, model, label) {
  assert.equal(res.headers.get('x-dasha-route'), 'community', `${label} route`);
  assert.equal(res.headers.get('x-dasha-model'), model, `${label} model`);
  assert.equal(res.headers.get('x-dasha-spend-usd'), null, `${label} never invents USD`);
  const expose = String(res.headers.get('access-control-expose-headers') || '');
  assert.match(expose, /X-Dasha-Route/i, `${label} expose route`);
  assert.match(expose, /X-Dasha-Model/i, `${label} expose model`);
  assert.match(expose, /X-Dasha-Spend-Usd/i, `${label} expose spend`);
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'nonstream spend' }] }),
  }));
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const job = (await poll.json()).job;
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: creds.provider_id,
      content: 'spend ok',
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }),
  }), origin)).status, 202);
  const res = await pending;
  assert.equal(res.status, 200);
  assertCommunitySpendHeaders(res, 'qwen3-8b', 'complete JSON');
  const body = await res.json();
  assert.equal(body.object, 'chat.completion');
  assert.equal(body.choices[0].message.content, 'spend ok');
  assert.equal('dasha' in body, false, 'OpenAI-compat body has no dasha extension');
  assert.deepEqual(body.usage, { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 });
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({
      model: 'qwen3-8b',
      stream: true,
      messages: [{ role: 'user', content: 'stream spend' }],
    }),
  }));
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const job = (await poll.json()).job;
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/chunk`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: creds.provider_id,
      delta: 'hi',
      done: true,
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    }),
  }), origin)).status, 202);
  const res = await pending;
  assert.equal(res.status, 200);
  assertCommunitySpendHeaders(res, 'qwen3-8b', 'SSE');
  const text = await res.text();
  assert.match(text, /"finish_reason":"stop"/);
  assert.doesNotMatch(text, /"dasha":/, 'SSE body stays OpenAI-compat');
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'fail spend' }] }),
  }));
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const job = (await poll.json()).job;
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({ provider_id: creds.provider_id, error: 'provider failed' }),
  }), origin)).status, 202);
  const res = await pending;
  assert.equal(res.status, 502);
  assertCommunitySpendHeaders(res, 'qwen3-8b', 'failed JSON');
  const err = await res.json();
  assert.equal(err.error?.type, 'server_error');
  assert.equal('dasha' in err, false);
}

{
  const miss = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'gemma3-27b', messages: [{ role: 'user', content: 'no mac' }] }),
  }));
  assert.equal(miss.status, 503);
  assert.equal(miss.headers.get('x-dasha-route'), 'community');
  assert.equal(miss.headers.get('x-dasha-model'), 'gemma3-27b');
  assert.equal(miss.headers.get('x-dasha-spend-usd'), null, 'error path still omits unknown USD');
}

console.log('dasha-compute-v1-chat-spend-headers.test.mjs: PASS');
