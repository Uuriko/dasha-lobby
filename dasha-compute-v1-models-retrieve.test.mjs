#!/usr/bin/env node
/** OpenAI SDK GET /v1/models/{id} (models.retrieve) must auth like list, not generic {error:not found}. Empty network 404 does not invent a Mac. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'v1-models-retrieve-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_retrievexxxx.abcdefghijklmnopqrstuvwx';
const id = 'key_retrievexxxx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:retrieve',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
const auth = { Authorization: `Bearer ${token}` };

async function getHead(fetchImpl, host, path, init = {}) {
  const get = await fetchImpl(new Request(`https://${host}${path}`, init));
  const head = await fetchImpl(new Request(`https://${host}${path}`, { ...init, method: 'HEAD' }));
  const getText = await get.text();
  const headText = await head.text();
  assert.equal(head.status, get.status, `${host} ${path} HEAD status`);
  assert.equal(head.headers.get('content-type'), get.headers.get('content-type'), `${host} ${path} HEAD type`);
  assert.match(head.headers.get('content-type') || '', /application\/json/, `${host} ${path} JSON`);
  assert.equal(headText, '', `${host} ${path} HEAD empty`);
  return { status: get.status, body: getText ? JSON.parse(getText) : null, type: get.headers.get('content-type') };
}

for (const path of ['/compute/api/v1/models/qwen3-8b', '/compute/api/v1/models/qwen3-8b/']) {
  const unauth = await getHead(network.fetch.bind(network), 'lobby.getdasha.com', path);
  assert.equal(unauth.status, 401, `${path} unauth`);
  assert.equal(unauth.body.error.message, 'invalid API key');
  assert.equal(unauth.body.error.type, 'authentication_error');
  assert.notEqual(unauth.body.error, 'not found');
}

for (const path of ['/compute/api/v1/models/qwen3-8b', '/compute/api/v1/models/qwen3-8b/']) {
  const empty = await getHead(network.fetch.bind(network), 'lobby.getdasha.com', path, { headers: auth });
  assert.equal(empty.status, 404, `${path} empty network`);
  assert.equal(empty.body.error.message, "The model 'qwen3-8b' does not exist");
  assert.equal(empty.body.error.type, 'invalid_request_error');
  assert.notEqual(empty.body.error, 'not found');
}

const listed = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models', { headers: auth }));
assert.equal(listed.status, 200);
assert.deepEqual((await listed.json()).data, []);
assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:') && key !== 'compute:api-key:' + id), false);

await storage.put('compute:provider:mac_retrieve', {
  id: 'mac_retrieve',
  owner: 'x:retrieve',
  name: 'Live Mac',
  models: ['gemma3-12b'],
  lastSeenAt: Date.now(),
});
const hit = await getHead(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/models/gemma3-12b', { headers: auth });
assert.equal(hit.status, 200);
assert.deepEqual(hit.body, { id: 'gemma3-12b', object: 'model', created: 0, owned_by: 'dasha-community' });

const miss = await getHead(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/models/qwen3-8b', { headers: auth });
assert.equal(miss.status, 404);
assert.equal(miss.body.error.message, "The model 'qwen3-8b' does not exist");

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wUnauth = await getHead((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/models/qwen3-8b');
  assert.equal(wUnauth.status, 401, `${host} worker unauth retrieve`);
  assert.equal(wUnauth.body.error.message, 'invalid API key');
  const wMiss = await getHead((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/models/qwen3-8b', { headers: auth });
  assert.equal(wMiss.status, 404, `${host} worker empty-id`);
  assert.notEqual(wMiss.body.error, 'not found');
  const wHit = await getHead((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/models/gemma3-12b', { headers: auth });
  assert.equal(wHit.status, 200, `${host} worker retrieve advertised`);
  assert.equal(wHit.body.id, 'gemma3-12b');
}

const list = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/models'), workerEnv);
assert.equal(list.status, 401);
assert.deepEqual(await list.json(), { error: { message: 'invalid API key', type: 'authentication_error', code: null } });
const foo = await worker.fetch(new Request('https://www.getdasha.com/compute/api/foo'), workerEnv);
assert.equal(foo.status, 404);
assert.deepEqual(await foo.json(), { error: 'not found' });

console.log('dasha-compute-v1-models-retrieve: PASS (OpenAI retrieve auth + empty-network 404, no fake Mac)');
