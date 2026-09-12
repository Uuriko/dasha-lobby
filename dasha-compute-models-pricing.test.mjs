#!/usr/bin/env node
/**
 * OpenRouter gate: the public model list publishes honest per-model pricing.
 * GET /compute/api/v1/models entries carry pricing (flat prepaid per chat
 * completion - the only billing that exists; per-token fields stay 0, never
 * invented) plus measured tok/s when a benchmark exists (omitted otherwise).
 * No key needed for the list. llms.txt names the pricing field.
 */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COMPUTE_LLMS_TXT } from './dasha-compute-agent.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  LOBBY_SESSION_SECRET: 'models-pricing-secret',
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
const session = await createSessionToken(env, { xId: 'models-pricing', handle: 'models_pricing' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

// Two providers: one benchmarked, one not (honesty: no benchmark, no tok/s claim).
const regA = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Bench Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(regA.status, 201, await regA.clone().text());
const credsA = await regA.json();
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST',
  headers: { Authorization: `Bearer ${credsA.provider_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider_id: credsA.provider_id, name: 'Bench Mac', models: ['qwen3-8b'],
    hardware: { system: 'Darwin', machine: 'arm64', memory_gb: 64, benchmarked_at: Date.now(),
      benchmarks: [{ model: 'qwen3-8b', tokens_per_second: 42.125 }] } }),
}), origin)).status, 204);

const regB = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Plain Mac', models: ['gemma3-12b'] }),
}), origin);
assert.equal(regB.status, 201);
const credsB = await regB.json();
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST',
  headers: { Authorization: `Bearer ${credsB.provider_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider_id: credsB.provider_id, name: 'Plain Mac', models: ['gemma3-12b'] }),
}), origin)).status, 204);

// Public list, no key: entries carry honest flat pricing + measured tok/s when benchmarked.
const list = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models'), origin);
assert.equal(list.status, 200, await list.clone().text());
const body = await list.json();
assert.equal(body.object, 'list');
const hosted = body.data.find(m => m.id === 'gpt-oss-20b');
const qwen = body.data.find(m => m.id === 'qwen3-8b');
const gemma = body.data.find(m => m.id === 'gemma3-12b');
assert.ok(hosted && qwen && gemma, 'Hosted floor + both serving models listed');
assert.equal(hosted.owned_by, 'dasha-hosted', 'Hosted floor is not Community');
assert.equal(hosted.providers_online, 0, 'Hosted floor does not invent Community Macs');
assert.equal('measured_tok_per_sec' in hosted, false, 'Hosted floor does not invent tok/s');
for (const entry of [qwen, gemma]) {
  assert.deepEqual(entry.pricing, {
    request: '0.05', prompt: '0', completion: '0', currency: 'USD',
    note: 'flat per chat completion (prepaid credits); self-route free',
  });
  assert.equal(entry.providers_online, 1);
  assert.equal(entry.owned_by, 'dasha-community');
}
assert.equal(qwen.measured_tok_per_sec, 42.13);
assert.equal(gemma.measured_tok_per_sec, undefined, 'no benchmark, no tok/s claim');

// Retrieve carries the same fields (guest key allowed for models scope).
const mint = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/guest-keys', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
}), origin);
assert.equal(mint.status, 201, await mint.clone().text());
const { api_key: guestKey } = await mint.json();
const one = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models/qwen3-8b', {
  headers: { Authorization: `Bearer ${guestKey}` },
}), origin);
assert.equal(one.status, 200, await one.clone().text());
const detail = await one.json();
assert.deepEqual(detail.pricing, qwen.pricing);
assert.equal(detail.measured_tok_per_sec, 42.13);

// Doc pin: llms.txt names the pricing on the public list.
assert.match(COMPUTE_LLMS_TXT, /pricing\.request/);

console.log('dasha-compute-models-pricing: ok');
