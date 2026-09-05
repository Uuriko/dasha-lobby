#!/usr/bin/env node
/** GET+HEAD /compute/api/network and /v1/network plus trailing slash; empty 0 Macs. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'network-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const EMPTY = { providers_online: 0, models_available: [], capacity: [], jobs_queued: 0 };

async function pair(host, path, init = {}, fetchImpl = network.fetch.bind(network), fetchEnv) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init), fetchEnv);
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init), fetchEnv);
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, type: a.headers.get('content-type'), body: aText ? JSON.parse(aText) : null, headers: a.headers };
}

for (const path of ['/compute/api/network', '/compute/api/network/', '/compute/api/v1/network', '/compute/api/v1/network/']) {
  const get = await pair('lobby.getdasha.com', path);
  assert.equal(get.status, 200, `${path} GET`);
  assert.equal(get.body.providers_online, 0);
  assert.deepEqual(get.body.models_available, []);
  assert.equal(get.body.jobs_queued, 0);
  assert.deepEqual(get.body.capacity, []);
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
  assert.equal(head.status, 200, `${path} HEAD`);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

await storage.put('compute:provider:mac_stale', {
  id: 'mac_stale',
  owner: 'x:net',
  name: 'Stale Mac',
  models: ['qwen3-8b'],
  lastSeenAt: Date.now() - 120_000,
});
const stale = await pair('lobby.getdasha.com', '/compute/api/network');
assert.deepEqual({ providers_online: stale.body.providers_online, models_available: stale.body.models_available, jobs_queued: stale.body.jobs_queued, capacity: stale.body.capacity }, EMPTY, 'stale Mac is not online');

await storage.put('compute:provider:mac_live', {
  id: 'mac_live',
  owner: 'x:net',
  name: 'Live Mac',
  models: ['gemma3-12b'],
  lastSeenAt: Date.now(),
});
const live = await pair('lobby.getdasha.com', '/compute/api/v1/network/');
assert.equal(live.status, 200);
assert.equal(live.body.providers_online, 1);
assert.deepEqual(live.body.models_available, ['gemma3-12b']);
const liveHead = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/network/', { method: 'HEAD' }));
assert.equal(liveHead.status, 200);
assert.equal(await liveHead.text(), '');

rows.delete('compute:provider:mac_live');
rows.delete('compute:provider:mac_stale');

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
async function workerPair(host, path, init = {}) {
  return pair(host, path, init, (request) => worker.fetch(request, workerEnv));
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/compute/api/network', '/compute/api/v1/network']) {
    const wGet = await workerPair(host, path);
    assert.equal(wGet.status, 200, `${host} ${path} GET`);
    assert.equal(wGet.body.providers_online, 0);
    assert.deepEqual(wGet.body.models_available, []);
    assert.equal(wGet.body.jobs_queued, 0);
    const wHead = await worker.fetch(new Request(`https://${host}${path}/`, { method: 'HEAD' }), workerEnv);
    assert.equal(wHead.status, 200, `${host} ${path}/ HEAD`);
    assert.match(wHead.headers.get('content-type') || '', /application\/json/);
    assert.equal(await wHead.text(), '');
  }
  const jobs = await worker.fetch(new Request(`https://${host}/compute/api/jobs`), workerEnv);
  assert.equal(jobs.status, 401);
  assert.deepEqual(await jobs.json(), { error: 'login required' });
  const models = await worker.fetch(new Request(`https://${host}/compute/api/v1/models/`), workerEnv);
  assert.equal(models.status, 401);
  assert.deepEqual(await models.json(), { error: { message: 'invalid API key', type: 'authentication_error', code: null } });
  const chat = await worker.fetch(new Request(`https://${host}/compute/api/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), workerEnv);
  assert.equal(chat.status, 401);
  assert.equal((await chat.json()).error.message, 'invalid API key');
  const foo = await worker.fetch(new Request(`https://${host}/compute/api/foo`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
  const status = await (await worker.fetch(new Request(`https://${host}/compute/api/status`), workerEnv)).json();
  assert.equal(status.live, true);
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-network-slash-head: PASS');
