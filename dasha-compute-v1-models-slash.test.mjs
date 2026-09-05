#!/usr/bin/env node
/** GET /compute/api/v1/models and trailing-slash /models/ are the same handler. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'v1-models-slash-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_mnopqrstuvwx.abcdefghijklmnopqrstuvwx';
const id = 'key_mnopqrstuvwx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:slash',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});

async function pair(path, init = {}) {
  const a = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, init));
  const b = await network.fetch(new Request(`https://lobby.getdasha.com${path.endsWith('/') ? path.slice(0, -1) : path + '/'}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${path} content-type parity`);
  assert.equal(aText, bText, `${path} body parity`);
  return { status: a.status, headers: a.headers, body: JSON.parse(aText) };
}

const unauth = await pair('/compute/api/v1/models');
assert.equal(unauth.status, 401);
assert.equal(unauth.body.error.message, 'invalid API key');
assert.equal(unauth.body.error.type, 'authentication_error');

const auth = { Authorization: `Bearer ${token}` };
const empty = await pair('/compute/api/v1/models', { headers: auth });
assert.equal(empty.status, 200);
assert.equal(empty.body.object, 'list');
assert.deepEqual(empty.body.data, []);
assert.equal(empty.body.data.some(row => row.owned_by === 'dasha-community'), false);

await storage.put('compute:provider:mac_stale', {
  id: 'mac_stale',
  owner: 'x:slash',
  name: 'Stale Mac',
  models: ['qwen3-8b'],
  lastSeenAt: Date.now() - 120_000,
});
const stale = await pair('/compute/api/v1/models', { headers: auth });
assert.equal(stale.status, 200);
assert.deepEqual(stale.body.data, [], 'stale Mac is not a listed community model');

await storage.put('compute:provider:mac_live', {
  id: 'mac_live',
  owner: 'x:slash',
  name: 'Live Mac',
  models: ['gemma3-12b'],
  lastSeenAt: Date.now(),
});
const live = await pair('/compute/api/v1/models', { headers: auth });
assert.equal(live.status, 200);
assert.deepEqual(live.body.data, [{ id: 'gemma3-12b', object: 'model', created: 0, owned_by: 'dasha-community' }]);

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
async function workerPair(host, path, init = {}) {
  const a = await worker.fetch(new Request(`https://${host}${path}`, init), workerEnv);
  const slashPath = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await worker.fetch(new Request(`https://${host}${slashPath}`, init), workerEnv);
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type`);
  assert.equal(aText, bText, `${host} ${path} body`);
  return { status: a.status, type: a.headers.get('content-type'), body: JSON.parse(aText) };
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wUnauth = await workerPair(host, '/compute/api/v1/models');
  assert.equal(wUnauth.status, 401, `${host} unauth`);
  assert.match(wUnauth.type, /application\/json/);
  const wAuth = await workerPair(host, '/compute/api/v1/models', { headers: auth });
  assert.equal(wAuth.status, 200, `${host} authed`);
  assert.deepEqual(wAuth.body.data, [{ id: 'gemma3-12b', object: 'model', created: 0, owned_by: 'dasha-community' }]);
}

const wwwFoo = await worker.fetch(new Request('https://www.getdasha.com/compute/api/foo'), workerEnv);
assert.equal(wwwFoo.status, 404);
assert.deepEqual(await wwwFoo.json(), { error: 'not found' });

console.log('dasha-compute-v1-models-slash: PASS');
