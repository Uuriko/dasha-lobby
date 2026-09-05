#!/usr/bin/env node
/** HEAD /compute/api/v1/models matches GET status and JSON content-type; empty body. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'v1-models-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_headmodelsxx.abcdefghijklmnopqrstuvwx';
const id = 'key_headmodelsxx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:head',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});

async function getHead(path, init = {}) {
  const get = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, init));
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { ...init, method: 'HEAD' }));
  const getText = await get.text();
  const headText = await head.text();
  assert.equal(head.status, get.status, `${path} HEAD status`);
  assert.equal(head.headers.get('content-type'), get.headers.get('content-type'), `${path} HEAD content-type`);
  assert.match(head.headers.get('content-type') || '', /application\/json/, `${path} JSON`);
  assert.equal(headText, '', `${path} HEAD body empty`);
  return { status: get.status, getBody: JSON.parse(getText), head };
}

for (const path of ['/compute/api/v1/models', '/compute/api/v1/models/']) {
  const unauth = await getHead(path);
  assert.equal(unauth.status, 401);
  assert.equal(unauth.getBody.error.message, 'invalid API key');
  assert.equal(unauth.getBody.error.type, 'authentication_error');
}

const auth = { Authorization: `Bearer ${token}` };
for (const path of ['/compute/api/v1/models', '/compute/api/v1/models/']) {
  const empty = await getHead(path, { headers: auth });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.getBody.data, []);
}

await storage.put('compute:provider:mac_live', {
  id: 'mac_live',
  owner: 'x:head',
  name: 'Live Mac',
  models: ['gemma3-12b'],
  lastSeenAt: Date.now(),
});
const live = await getHead('/compute/api/v1/models', { headers: auth });
assert.equal(live.status, 200);
assert.deepEqual(live.getBody.data, [{ id: 'gemma3-12b', object: 'model', created: 0, owned_by: 'dasha-community' }]);

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/compute/api/v1/models', '/compute/api/v1/models/']) {
    const get = await worker.fetch(new Request(`https://${host}${path}`), workerEnv);
    const head = await worker.fetch(new Request(`https://${host}${path}`, { method: 'HEAD' }), workerEnv);
    assert.equal(get.status, 401, `${host} ${path} GET`);
    assert.equal(head.status, 401, `${host} ${path} HEAD`);
    assert.match(head.headers.get('content-type') || '', /application\/json/);
    assert.equal(await head.text(), '');
    const authedGet = await worker.fetch(new Request(`https://${host}${path}`, { headers: auth }), workerEnv);
    const authedHead = await worker.fetch(new Request(`https://${host}${path}`, { method: 'HEAD', headers: auth }), workerEnv);
    assert.equal(authedGet.status, 200);
    assert.equal(authedHead.status, 200);
    assert.equal(await authedHead.text(), '');
  }
}

const wwwFoo = await worker.fetch(new Request('https://www.getdasha.com/compute/api/foo'), workerEnv);
assert.equal(wwwFoo.status, 404);
assert.deepEqual(await wwwFoo.json(), { error: 'not found' });

console.log('dasha-compute-v1-models-head: PASS');
