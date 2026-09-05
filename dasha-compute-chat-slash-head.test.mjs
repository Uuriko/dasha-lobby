#!/usr/bin/env node
/** GET+HEAD /compute/api/chat and /chat/; 405 method not allowed; empty HEAD; slash parity. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { computeApi, ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'chat-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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

async function pair(host, path, init = {}, fetchImpl) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, type: a.headers.get('content-type'), body: aText ? JSON.parse(aText) : null, headers: a.headers };
}

for (const path of ['/compute/api/chat', '/compute/api/chat/']) {
  const get = await pair('lobby.getdasha.com', path, {}, (req) => computeApi(req, env, null));
  assert.equal(get.status, 405, `${path} GET`);
  assert.deepEqual(get.body, { error: 'method not allowed' });
  const head = await computeApi(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }), env, null);
  assert.equal(head.status, 405, `${path} HEAD`);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wGet = await pair(host, '/compute/api/chat', {}, (request) => worker.fetch(request, workerEnv));
  assert.equal(wGet.status, 405, `${host} /compute/api/chat GET`);
  assert.deepEqual(wGet.body, { error: 'method not allowed' });
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/chat/`, { method: 'HEAD' }), workerEnv);
  assert.equal(wHead.status, 405, `${host} /compute/api/chat/ HEAD`);
  assert.match(wHead.headers.get('content-type') || '', /application\/json/);
  assert.equal(await wHead.text(), '');

  const foo = await worker.fetch(new Request(`https://${host}/compute/api/chatx`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-chat-slash-head: PASS');
