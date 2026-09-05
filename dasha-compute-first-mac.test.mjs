#!/usr/bin/env node
import assert from 'node:assert/strict';

const { default: worker, DashaLobby } = await import('./dasha-lobby-worker.mjs');
const { ComputeNetwork } = await import('./dasha-compute-network.mjs');
const { COOKIE, createSessionToken, createGrokSessionToken } = await import('./dasha-lobby-x.mjs');

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-test-secret',
};
const token = await createSessionToken(env, { xId: '123', handle: 'dasha_test' });

const empty = { async list() { return new Map(); }, async get() {}, async put() {}, async delete() {} };
const v1 = await new ComputeNetwork({ storage: empty }, env).fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network'));
assert.equal(v1.status, 200);
const v1body = await v1.json();
assert.equal(v1body.providers_online, 0);
globalThis.WebSocketRequestResponsePair ||= class {};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) { if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item); else rows.set(key, value); },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
  async getAlarm() { return Date.now(); }, async setAlarm() {},
};
let ready;
const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
await ready;
const userHeaders = { Cookie: `${COOKIE}=${token}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
const register = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', { method: 'POST', headers: userHeaders, body: JSON.stringify({ name: '  ', models: ['qwen3-8b', 'gemma3-12b'] }) }));
assert.equal(register.status, 201);
const credentials = await register.json();
assert.match(credentials.provider_token, /^dcp_/);
assert.equal(JSON.stringify([...rows.values()]).includes(credentials.provider_token), false, 'plaintext provider token must not be stored');
assert.equal(rows.get(`compute:provider:${credentials.provider_id}`).name, 'My Mac', 'blank provider names need a usable fallback');
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).models, [], 'registered models are not online until the provider reports them');
const providerHeaders = { Authorization: `Bearer ${credentials.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: credentials.provider_id, name: '  ', models: ['qwen3-8b'], hardware: { system: 'Darwin', machine: 'arm64', memory_gb: 64, ignored: 'nope', benchmarked_at: 1234, benchmarks: [{ model: 'qwen3-8b', tokens_per_second: 42.125 }, { model: 'gpt-oss-120b', tokens_per_second: 999 }] } };
const verified = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/verify', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }));
assert.equal(verified.status, 200);
assert.deepEqual((await verified.json()).models, ['qwen3-8b', 'gemma3-12b']);
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/verify', { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify(heartbeat) }))).status, 401);
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }))).status, 204);
assert.equal(rows.get(`compute:provider:${credentials.provider_id}`).name, 'My Mac', 'blank heartbeats must not erase the provider name');
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).hardware, { system: 'Darwin', machine: 'arm64', memory_gb: 64, benchmarked_at: 1234, benchmarks: [{ model: 'qwen3-8b', tokens_per_second: 42.13 }] });
const network = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/network'))).json();
assert.equal(network.providers_online, 1);
assert.deepEqual(network.models_available, ['qwen3-8b']);
assert.deepEqual(network.capacity, [{ model: 'qwen3-8b', providers: 1, measured_providers: 1, tokens_per_second: 42.13 }]);
const v1network = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network'))).json();
assert.equal(v1network.providers_online, 1);
assert.deepEqual(v1network.models_available, ['qwen3-8b']);
const mine = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers', { headers: userHeaders }))).json();
assert.equal(mine.providers[0].id, credentials.provider_id);
assert.deepEqual(mine.providers[0].allowed_models, ['qwen3-8b', 'gemma3-12b']);
assert.equal(mine.providers[0].hardware.memory_gb, 64);
assert.equal('tokenHash' in mine.providers[0], false);
const unregisteredHeartbeat = { ...heartbeat, models: ['gpt-oss-120b'] };
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(unregisteredHeartbeat) }))).status, 204);
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).models, [], 'a provider cannot self-authorize another supported model');
const switchedHeartbeat = { ...heartbeat, models: ['gemma3-12b'] };
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(switchedHeartbeat) }))).status, 204);
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).models, ['gemma3-12b'], 'a temporarily absent registered model can come back online');
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }))).status, 204);
const submit = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', { method: 'POST', headers: userHeaders, body: JSON.stringify({ model: 'qwen3-8b', prompt: 'Community hello.' }) }));
assert.equal(submit.status, 202);
const submitted = await submit.json();
const queued = await (await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${submitted.id}`, { headers: userHeaders }))).json();
assert.equal(queued.queue_position, 1);
const poll = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }));
assert.equal(poll.status, 200);
assert.equal((await poll.json()).job.messages[0].content, 'Community hello.');
const result = await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${submitted.id}/result`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id, content: 'Community inference works.' }) }));
assert.equal(result.status, 202);
assert.equal(rows.get(`compute:job:${submitted.id}`).messages, null, 'prompt must be removed after completion');
const completed = await (await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${submitted.id}`, { headers: userHeaders }))).json();
assert.equal(completed.answer, 'Community inference works.');

const grokToken = await createGrokSessionToken(env, 'Potter');
const grokHeaders = { Cookie: `${COOKIE}=${grokToken}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
const grokRegister = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', { method: 'POST', headers: grokHeaders, body: JSON.stringify({ models: ['qwen3-8b'] }) }));
assert.equal(grokRegister.status, 201);
const grokCredentials = await grokRegister.json();
assert.match(grokCredentials.provider_token, /^dcp_/);
assert.equal(grokCredentials.coordinator_url, 'https://lobby.getdasha.com/compute/api');
const grokMine = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers', { headers: grokHeaders }))).json();
assert.equal(grokMine.providers.some(provider => provider.id === grokCredentials.provider_id), true);

assert.equal(typeof worker.fetch, 'function');
console.log('dasha-compute-first-mac: PASS');

