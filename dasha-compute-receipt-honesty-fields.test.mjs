#!/usr/bin/env node
/**
 * Receipt honesty fields: route community|hosted (same face as x-dasha-route),
 * turns/steps only when already counted, optional first-completion latency
 * from job timestamps. Never invent USD or turns. Effort still attaches.
 * No wrangler. No Ask chrome. No Room. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ComputeNetwork, publicPhase0Receipt } from './dasha-compute-network.mjs';
import { COMMUNITY_EFFORT_NOTE, HOSTED_EFFORT_NOTE } from './dasha-compute-reasoning-effort.mjs';
import {
  countConversationTurns,
  firstCompletionLatencyMs,
  honestLoopFields,
  receiptRouteFace,
  settledReceiptRoute,
} from './dasha-compute-receipt-honesty.mjs';
import { publicReceipt, recordSettledInference } from './dasha-compute-settled.mjs';
import { COMPUTE_LLMS_TXT, COMPUTE_SKILL_MD } from './dasha-compute-agent.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const networkSrc = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(networkSrc, /from '\.\/dasha-compute-receipt-honesty\.mjs'/);
assert.match(networkSrc, /attachReceiptHonesty/);
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(networkSrc, /people-data|guest-agent/i);

assert.match(COMPUTE_SKILL_MD, /Job receipts include `route` \(`community`\|`hosted`/);
assert.match(COMPUTE_SKILL_MD, /`turns` only when already counted/);
assert.match(COMPUTE_LLMS_TXT, /receipts include route community\|hosted/);
assert.match(COMPUTE_LLMS_TXT, /turns only when counted/);
assert.doesNotMatch(COMPUTE_SKILL_MD, /plugin\.jup\.ag/);
assert.doesNotMatch(COMPUTE_LLMS_TXT, /project-room/i);

{
  assert.equal(receiptRouteFace({ route: 'community' }), 'community');
  assert.equal(receiptRouteFace({ route: 'mixture' }), 'community', 'Mac routes collapse like x-dasha-route');
  assert.equal(receiptRouteFace({ route: 'self' }), 'community');
  assert.equal(receiptRouteFace({ engine: 'hosted' }), 'hosted');
  assert.equal(receiptRouteFace({ route: 'hosted' }), 'hosted');
  assert.equal(receiptRouteFace({ engine: 'hosted', route: 'community' }), 'community', 'job route wins over hosted engine');
  assert.equal(receiptRouteFace({}), null, 'never invent route');
  assert.equal(receiptRouteFace({ route: 'mystery' }), null);
  assert.equal(settledReceiptRoute('hosted'), 'hosted');
  assert.equal(settledReceiptRoute('community'), 'community');
  assert.equal(settledReceiptRoute('mixture'), 'community');
  assert.equal(settledReceiptRoute('api'), null, 'api engine does not invent community');
}

{
  assert.equal(countConversationTurns(null), null);
  assert.equal(countConversationTurns([]), null);
  assert.equal(countConversationTurns([{ role: 'system', content: 'tip' }]), null, 'system-only is not a turn');
  assert.equal(countConversationTurns([{ role: 'user', content: 'hi' }]), 1);
  assert.equal(countConversationTurns([
    { role: 'system', content: 'tip' },
    { role: 'user', content: 'one' },
    { role: 'assistant', content: 'two' },
    { role: 'user', content: 'three' },
  ]), 3);
  assert.deepEqual(honestLoopFields({}), {});
  assert.deepEqual(honestLoopFields({ turns: 0 }), {}, 'zero turns omitted');
  assert.deepEqual(honestLoopFields({ turns: -2 }), {});
  assert.deepEqual(honestLoopFields({ turns: 'nope' }), {});
  assert.deepEqual(honestLoopFields({ turns: 4 }), { turns: 4 });
  assert.deepEqual(honestLoopFields({ steps: 2 }), { steps: 2 });
  assert.deepEqual(honestLoopFields({ turns: 3, steps: 9 }), { turns: 3 }, 'stored turns win; do not also invent steps');
  assert.deepEqual(honestLoopFields({ messages: [{ role: 'user', content: 'hi' }] }), { turns: 1 });
  assert.equal(firstCompletionLatencyMs({}), null);
  assert.equal(firstCompletionLatencyMs({ createdAt: 1_000, completedAt: 1_400 }), 400);
  assert.equal(firstCompletionLatencyMs({ createdAt: 1_000, leasedAt: 1_200, completedAt: 1_500 }), 300, 'leasedAt is first-completion start');
  assert.equal(firstCompletionLatencyMs({ createdAt: 1_000 }), null);
}

{
  const community = publicPhase0Receipt({
    id: 'job_com', model: 'qwen3-8b', route: 'community', status: 'complete',
  });
  assert.equal(community.route, 'community');
  assert.equal('turns' in community, false, 'never invent turns');
  assert.equal('steps' in community, false);
  assert.equal('first_edit_at' in community, false, 'no edit clock — omit first_edit_at');
  assert.equal(community.provider_class, 'community');
  assert.equal(community.attestation, null);

  const mixture = publicPhase0Receipt({
    id: 'job_mix', model: 'gemma3-12b', route: 'mixture', status: 'complete',
  });
  assert.equal(mixture.route, 'community');
  assert.equal(mixture.provider_class, 'mixture');

  const hosted = publicPhase0Receipt({
    id: 'job_host', model: 'gpt-oss-20b', engine: 'hosted', status: 'complete',
  });
  assert.equal(hosted.route, 'hosted');
  assert.equal(hosted.provider_class, 'hosted');
  assert.equal('turns' in hosted, false);

  const counted = publicPhase0Receipt({
    id: 'job_turns', model: 'qwen3-8b', route: 'community', status: 'complete',
    turns: 5,
    messages: [{ role: 'user', content: 'stale' }],
  });
  assert.equal(counted.turns, 5, 'stored count wins over leftover messages');
  assert.equal('steps' in counted, false);

  const fromMessages = publicPhase0Receipt({
    id: 'job_msgs', model: 'qwen3-8b', route: 'self', status: 'complete',
    messages: [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ],
  });
  assert.equal(fromMessages.route, 'community');
  assert.equal(fromMessages.turns, 3);

  const stepped = publicPhase0Receipt({
    id: 'job_steps', model: 'qwen3-8b', route: 'community', status: 'complete', steps: 2,
  });
  assert.equal(stepped.steps, 2);
  assert.equal('turns' in stepped, false);

  const withEffort = publicPhase0Receipt({
    id: 'job_effort', model: 'qwen3-8b', route: 'community', status: 'complete',
    effort: 'high', turns: 2,
    settle_cents: 6, settle_state: 'pending_operator',
  });
  assert.equal(withEffort.route, 'community');
  assert.equal(withEffort.turns, 2);
  assert.equal(withEffort.effort, 'high');
  assert.equal(withEffort.effort_applied, false);
  assert.equal(withEffort.note, COMMUNITY_EFFORT_NOTE);
  assert.deepEqual(withEffort.settled, { cents: 6, state: 'pending_operator' });

  const hostedEffort = publicPhase0Receipt({
    id: 'job_he', model: 'gpt-oss-20b', engine: 'hosted', status: 'complete', effort: 'low',
  });
  assert.equal(hostedEffort.route, 'hosted');
  assert.equal(hostedEffort.effort_applied, true);
  assert.equal(hostedEffort.note, HOSTED_EFFORT_NOTE);

  const late = publicPhase0Receipt({
    id: 'job_lat', model: 'qwen3-8b', route: 'community', status: 'complete',
    createdAt: 1_000, leasedAt: 1_250, completedAt: 2_000,
  });
  assert.equal(late.latency_ms, 750);
  assert.equal('first_edit_at' in late, false);

  const unknown = publicPhase0Receipt({ id: 'job_x', model: 'qwen3-8b', status: 'complete' });
  assert.equal('route' in unknown, false, 'omit route when job never stored one');
  assert.equal('turns' in unknown, false);
}

{
  const pubCommunity = publicReceipt({
    id: 'rcp_1', engine: 'community', tokens: 10, cents: 0, at: 1, job_id: 'job_a',
  });
  assert.equal(pubCommunity.route, 'community');
  assert.equal('turns' in pubCommunity, false);
  const pubHosted = publicReceipt({
    id: 'rcp_2', engine: 'hosted', tokens: 8, cents: 5, at: 1, turns: 2,
  });
  assert.equal(pubHosted.route, 'hosted');
  assert.equal(pubHosted.turns, 2);
  const pubApi = publicReceipt({ id: 'rcp_3', engine: 'api', tokens: 4, cents: 0, at: 1 });
  assert.equal('route' in pubApi, false);
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
  const { env, storage, network } = memoryNetwork('receipt-honesty-job-secret');
  const session = await createSessionToken(env, { xId: 'rx-honest', handle: 'rx_honest' });
  const cookie = { Cookie: `${COOKIE}=${session}` };
  const now = Date.now();

  const bareId = 'job_bare_rx';
  await storage.put(`compute:job:${bareId}`, {
    id: bareId, owner: 'x:rx-honest', status: 'complete', model: 'qwen3-8b',
    route: 'community', answer: 'hi',
    usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
    createdAt: now, expiresAt: now + 5 * 60_000,
  });
  const bare = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${bareId}`, { headers: cookie }))).json();
  assert.equal(bare.route, 'community');
  assert.equal(bare.receipt.route, 'community');
  assert.equal('turns' in bare, false, 'job JSON never invents turns');
  assert.equal('turns' in bare.receipt, false);
  assert.equal('first_edit_at' in bare.receipt, false);
  assert.deepEqual(bare.usage, { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 });

  const hostedId = 'job_hosted_rx';
  await storage.put(`compute:job:${hostedId}`, {
    id: hostedId, owner: 'x:rx-honest', status: 'complete', model: 'gpt-oss-20b',
    engine: 'hosted', answer: 'ok',
    usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
    createdAt: now, completedAt: now + 80, expiresAt: now + 5 * 60_000,
  });
  const hostedJob = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${hostedId}`, { headers: cookie }))).json();
  assert.equal('route' in hostedJob, false, 'job.route stays community/mixture/self — hosted lives on receipt');
  assert.equal(hostedJob.receipt.route, 'hosted');
  assert.equal(hostedJob.receipt.latency_ms, 80);
  assert.equal('turns' in hostedJob.receipt, false);

  const effortId = 'job_effort_rx';
  await storage.put(`compute:job:${effortId}`, {
    id: effortId, owner: 'x:rx-honest', status: 'complete', model: 'qwen3-8b',
    route: 'community', answer: 'ok', effort: 'medium', turns: 2,
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    settle_cents: 6, settle_state: 'pending_operator',
    createdAt: now, leasedAt: now + 10, completedAt: now + 110, expiresAt: now + 5 * 60_000,
  });
  const effortJob = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${effortId}`, { headers: cookie }))).json();
  assert.equal(effortJob.turns, 2);
  assert.equal(effortJob.receipt.route, 'community');
  assert.equal(effortJob.receipt.turns, 2);
  assert.equal(effortJob.receipt.effort, 'medium');
  assert.equal(effortJob.receipt.effort_applied, false);
  assert.equal(effortJob.receipt.note, COMMUNITY_EFFORT_NOTE);
  assert.deepEqual(effortJob.receipt.settled, { cents: 6, state: 'pending_operator' });
  assert.equal(effortJob.receipt.latency_ms, 100);
  assert.deepEqual(effortJob.dasha, { effort: 'medium', effort_applied: false, note: COMMUNITY_EFFORT_NOTE });
}

{
  const { env, storage, network } = memoryNetwork('receipt-honesty-live-secret');
  const session = await createSessionToken(env, { xId: 'rx-live', handle: 'rx_live' });
  const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Honesty Mac', models: ['qwen3-8b'] }),
  }), origin);
  assert.equal(reg.status, 201, await reg.clone().text());
  const creds = await reg.json();
  const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
  const heartbeat = { provider_id: creds.provider_id, name: 'Honesty Mac', models: ['qwen3-8b'] };
  assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
  }), origin)).status, 204);

  const keyCreated = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'rx-live', limit_cents: null, limit_reset: 'none' }),
  }), origin);
  assert.equal(keyCreated.status, 201, await keyCreated.clone().text());
  const developerKey = await keyCreated.json();
  await storage.put('compute:credit-balance:x:rx-live', { owner: 'x:rx-live', cents: 1000, updatedAt: Date.now() });
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

  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
    method: 'POST', headers: apiHeaders,
    body: JSON.stringify({
      model: 'qwen3-8b',
      messages: [
        { role: 'user', content: 'one' },
        { role: 'assistant', content: 'two' },
        { role: 'user', content: 'three' },
      ],
      effort: 'high',
    }),
  }));
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const leased = (await poll.json()).job;
  assert.equal('turns' in leased, false, 'lease to Mac does not grow a fake loop knob');
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${leased.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: creds.provider_id,
      content: 'ok',
      usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 },
    }),
  }), origin)).status, 202);
  const res = await pending;
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-route'), 'community');
  assert.equal(res.headers.get('x-dasha-spend-usd'), null, 'never invent USD');

  const got = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${leased.id}`, {
    headers: userHeaders,
  }), origin);
  assert.equal(got.status, 200);
  const body = await got.json();
  assert.equal(body.route, 'community');
  assert.equal(body.turns, 3, 'persisted conversation count survives message wipe');
  assert.equal(body.receipt.route, 'community');
  assert.equal(body.receipt.turns, 3);
  assert.equal(body.receipt.effort, 'high');
  assert.equal(body.receipt.effort_applied, false);
  assert.equal('first_edit_at' in body.receipt, false);
  assert.equal(typeof body.receipt.latency_ms, 'number');
  assert.ok(body.receipt.latency_ms >= 0);

  const settledList = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/receipts', {
    headers: userHeaders,
  }), origin);
  assert.equal(settledList.status, 200);
  const settledBody = await settledList.json();
  const settledRow = settledBody.receipts.find((row) => row.job_id === leased.id);
  assert.ok(settledRow, 'result POST records a settled receipt for the leased job');
  assert.equal(settledRow.model, 'qwen3-8b', 'job.model is threaded through the settle call site');
}

{
  const store = new Map();
  const storage = {
    get: async (k) => store.get(k),
    put: async (k, v) => { store.set(k, v); },
    list: async ({ prefix } = {}) => [...store.entries()].filter(([k]) => k.startsWith(prefix)),
  };
  const settled = await recordSettledInference(storage, {
    owner: 'x:rx', engine: 'community', tokens: 12, cents: 6,
    jobId: 'job_s', replayKey: 'job:job_s', turns: 2, now: 1_700_000_000_000,
  });
  assert.equal(settled.ok, true);
  const pub = publicReceipt(settled.receipt);
  assert.equal(pub.route, 'community');
  assert.equal(pub.turns, 2);
  assert.equal(pub.cents, 6);
}

console.log('dasha-compute-receipt-honesty-fields: PASS (route + Community/Hosted + never invent turns + effort still attaches)');
