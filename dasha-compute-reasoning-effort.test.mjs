#!/usr/bin/env node
/**
 * Compute chat reasoning_effort (alias effort): parse low|medium|high,
 * Hosted applies Workers AI knob, Community ignores with honesty.
 * Invalid → short 400. skill.md + llms.txt mention it. No fake think.
 * No wrangler. No plugin.jup.ag. Compute ≠ Room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ComputeNetwork, computeApi, openaiErrorBody, publicPhase0Receipt } from './dasha-compute-network.mjs';
import {
  COMMUNITY_EFFORT_NOTE,
  HOSTED_EFFORT_NOTE,
  REASONING_EFFORT_CONFLICT,
  REASONING_EFFORT_ERROR,
  canonicalizeReasoningEffort,
  dashaEffortExtension,
  effortHonesty,
  effortHonestyFromJob,
  hostedReasoningEffortInput,
  parseReasoningEffort,
} from './dasha-compute-reasoning-effort.mjs';
import {
  COMPUTE_LLMS_TXT,
  COMPUTE_SKILL_MD,
} from './dasha-compute-agent.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const networkSrc = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(networkSrc, /from '\.\/dasha-compute-reasoning-effort\.mjs'/);
assert.match(networkSrc, /parseReasoningEffort/);
assert.match(networkSrc, /hostedReasoningEffortInput/);
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(networkSrc, /people-data|guest-agent/i);

assert.match(COMPUTE_SKILL_MD, /reasoning_effort/, 'skill.md mentions reasoning_effort');
assert.match(COMPUTE_LLMS_TXT, /reasoning_effort/, 'llms.txt mentions reasoning_effort');
assert.match(COMPUTE_SKILL_MD, /alias effort/);
assert.match(COMPUTE_LLMS_TXT, /Community may ignore/);
assert.doesNotMatch(COMPUTE_SKILL_MD, /plugin\.jup\.ag/);
assert.doesNotMatch(COMPUTE_LLMS_TXT, /project-room/i);

{
  assert.deepEqual(parseReasoningEffort({}), { ok: true, effort: null });
  assert.deepEqual(parseReasoningEffort({ messages: [] }), { ok: true, effort: null });
  for (const effort of ['low', 'medium', 'high']) {
    assert.deepEqual(parseReasoningEffort({ reasoning_effort: effort }), { ok: true, effort });
    assert.deepEqual(parseReasoningEffort({ effort }), { ok: true, effort }, `alias ${effort}`);
    assert.deepEqual(parseReasoningEffort({ reasoning_effort: effort.toUpperCase() }), { ok: true, effort });
    assert.deepEqual(parseReasoningEffort({ reasoning: { effort } }), { ok: true, effort }, `OpenAI reasoning.effort ${effort}`);
  }
  assert.deepEqual(parseReasoningEffort({ reasoning_effort: 'high', effort: 'high' }), { ok: true, effort: 'high' });
  assert.deepEqual(parseReasoningEffort({ reasoning_effort: 'nope' }), { ok: false, error: REASONING_EFFORT_ERROR });
  assert.deepEqual(parseReasoningEffort({ effort: 'ultra' }), { ok: false, error: REASONING_EFFORT_ERROR });
  assert.deepEqual(parseReasoningEffort({ reasoning_effort: 'minimal' }), { ok: false, error: REASONING_EFFORT_ERROR });
  assert.deepEqual(parseReasoningEffort({ reasoning_effort: 'low', effort: 'high' }), { ok: false, error: REASONING_EFFORT_CONFLICT });
  assert.deepEqual(parseReasoningEffort({ reasoning_effort: ' ' }), { ok: false, error: REASONING_EFFORT_ERROR });
  assert.equal(canonicalizeReasoningEffort('Medium').effort, 'medium');
  assert.deepEqual(hostedReasoningEffortInput('high'), { reasoning_effort: 'high' });
  assert.deepEqual(hostedReasoningEffortInput(null), {});
  assert.deepEqual(effortHonesty({ effort: 'high', route: 'hosted' }), {
    effort: 'high', effort_applied: true, note: HOSTED_EFFORT_NOTE,
  });
  assert.deepEqual(effortHonesty({ effort: 'low', route: 'community' }), {
    effort: 'low', effort_applied: false, note: COMMUNITY_EFFORT_NOTE,
  });
  assert.deepEqual(effortHonesty({ effort: 'medium', route: 'mixture' }), {
    effort: 'medium', effort_applied: false, note: COMMUNITY_EFFORT_NOTE,
  });
  assert.equal(effortHonestyFromJob({ route: 'community' }), null);
  const ax = openaiErrorBody(REASONING_EFFORT_ERROR, 400, 'invalid_request_error');
  assert.equal(ax.reason, 'invalid_effort');
  assert.match(ax.error.message, /effort must be low, medium, or high/);
  assert.ok(String(ax.hint).length < 80, 'short 400 hint');
}

{
  const receipt = publicPhase0Receipt({
    id: 'job_effort', model: 'qwen3-8b', route: 'community', status: 'complete', effort: 'high',
  });
  assert.equal(receipt.effort, 'high');
  assert.equal(receipt.effort_applied, false);
  assert.equal(receipt.note, COMMUNITY_EFFORT_NOTE);
  const hostedRx = publicPhase0Receipt({
    id: 'job_host', model: 'gpt-oss-20b', engine: 'hosted', status: 'complete', effort: 'low',
  });
  assert.equal(hostedRx.effort_applied, true);
  assert.deepEqual(dashaEffortExtension(effortHonesty({ effort: 'low', route: 'community' })), {
    dasha: { effort: 'low', effort_applied: false, note: COMMUNITY_EFFORT_NOTE },
  });
}

function memoryNetwork(secret) {
  const env = { LOBBY_SESSION_SECRET: secret, AI: { run: async () => ({ response: 'hosted-unused' }) } };
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
  return { env, rows, storage, network: new ComputeNetwork({ storage }, env) };
}

const origin = 'https://www.getdasha.com';

{
  const { env, storage, network } = memoryNetwork('effort-community-secret');
  const session = await createSessionToken(env, { xId: 'effort-com', handle: 'effort_com' });
  const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Effort Mac', models: ['qwen3-8b'] }),
  }), origin);
  assert.equal(reg.status, 201, await reg.clone().text());
  const creds = await reg.json();
  const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
  const heartbeat = { provider_id: creds.provider_id, name: 'Effort Mac', models: ['qwen3-8b'] };
  assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
  }), origin)).status, 204);

  const keyCreated = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'effort-com', limit_cents: null, limit_reset: 'none' }),
  }), origin);
  assert.equal(keyCreated.status, 201, await keyCreated.clone().text());
  const developerKey = await keyCreated.json();
  await storage.put('compute:credit-balance:x:effort-com', { owner: 'x:effort-com', cents: 1000, updatedAt: Date.now() });
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

  const bad = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'bad effort' }], reasoning_effort: 'ultra' }),
  }));
  assert.equal(bad.status, 400, 'invalid effort → 400');
  const badBody = await bad.json();
  assert.equal(badBody.error.message, REASONING_EFFORT_ERROR);
  assert.equal(badBody.reason, 'invalid_effort');
  assert.ok(String(badBody.error.message).length < 60, 'short 400');

  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({
      model: 'qwen3-8b',
      messages: [{ role: 'user', content: 'community effort' }],
      effort: 'high',
    }),
  }));
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const leased = (await poll.json()).job;
  assert.equal(leased.stream, false);
  assert.equal('reasoning_effort' in leased, false, 'do not send effort to Mac/Ollama');
  assert.equal('effort' in leased, false, 'lease stays honest — no fake think knob');
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${leased.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: creds.provider_id,
      content: 'ok',
      usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
    }),
  }), origin)).status, 202);
  const res = await pending;
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-effort'), 'high');
  assert.equal(res.headers.get('x-dasha-effort-applied'), '0');
  const body = await res.json();
  assert.equal(body.object, 'chat.completion');
  assert.equal(body.choices[0].message.content, 'ok');
  assert.deepEqual(body.dasha, { effort: 'high', effort_applied: false, note: COMMUNITY_EFFORT_NOTE });
  assert.equal(body.choices[0].message.role, 'assistant');

  const got = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${leased.id}`, {
    headers: userHeaders,
  }), origin);
  assert.equal(got.status, 200);
  const gotBody = await got.json();
  assert.equal(gotBody.route, 'community');
  assert.equal(gotBody.dasha.effort_applied, false);
  assert.equal(gotBody.dasha.note, COMMUNITY_EFFORT_NOTE);
  assert.equal(gotBody.receipt.effort, 'high');
  assert.equal(gotBody.receipt.effort_applied, false);
}

{
  let hostedInput;
  const env = {
    LOBBY_SESSION_SECRET: 'effort-hosted-secret',
    AI: { run: async (_model, input) => { hostedInput = input; return { response: 'Hosted effort ok.' }; } },
  };
  const session = await createSessionToken(env, { xId: 'effort-host', handle: 'effort_host' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const bad = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST', headers, body: JSON.stringify({ prompt: 'nope', reasoning_effort: 'wild' }),
  }), env, origin);
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, REASONING_EFFORT_ERROR);

  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST', headers,
    body: JSON.stringify({ prompt: 'Think a bit.', reasoning_effort: 'medium' }),
  }), env, origin);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-effort'), 'medium');
  assert.equal(res.headers.get('x-dasha-effort-applied'), '1');
  const body = await res.json();
  assert.equal(body.answer, 'Hosted effort ok.');
  assert.equal(body.effort, 'medium');
  assert.equal(body.effort_applied, true);
  assert.equal(body.note, HOSTED_EFFORT_NOTE);
  assert.equal(hostedInput.reasoning_effort, 'medium', 'Hosted passes Workers AI knob');
}

{
  let hostedInput;
  const env = {
    LOBBY_SESSION_SECRET: 'effort-hosted-sse-secret',
    AI: {
      async run(_model, input) {
        hostedInput = input;
        return new ReadableStream({
          start(controller) {
            controller.enqueue({ response: 'ok', usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } });
            controller.close();
          },
        });
      },
    },
  };
  const session = await createSessionToken(env, { xId: 'effort-sse', handle: 'effort_sse' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST', headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true, effort: 'low' }),
  }), env, origin);
  assert.equal(res.status, 200);
  assert.equal(hostedInput.reasoning_effort, 'low');
  const text = await res.text();
  const stop = [...text.matchAll(/^data: (\{.*\})\s*$/gm)].map((m) => JSON.parse(m[1])).find((c) => c?.choices?.[0]?.finish_reason === 'stop');
  assert.ok(stop, 'hosted SSE stop chunk');
  assert.deepEqual(stop.dasha, { effort: 'low', effort_applied: true, note: HOSTED_EFFORT_NOTE });
}

console.log('dasha-compute-reasoning-effort: PASS (parse + Hosted apply + Community ignore + 400 + skill/llms)');
