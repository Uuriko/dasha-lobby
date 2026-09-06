#!/usr/bin/env node
/** POST /compute/api/v1/chat/completions and trailing-slash /completions/ are the same handler. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'v1-chat-slash-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_chatslashxxx.abcdefghijklmnopqrstuvwx';
const id = 'key_chatslashxxx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:chatslash',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
const workerToken = 'dsk_workerchatxx.abcdefghijklmnopqrstuvwx';
const workerId = 'key_workerchatxx';
await storage.put(`compute:api-key:${workerId}`, {
  id: workerId,
  owner: 'x:chatslash-worker',
  name: 'Developer key',
  prefix: workerToken.slice(0, 12),
  tokenHash: createHash('sha256').update(workerToken).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});

await storage.put('compute:credit-balance:x:chatslash', { owner: 'x:chatslash', cents: 1000, updatedAt: Date.now() });
await storage.put('compute:credit-balance:x:chatslash-worker', { owner: 'x:chatslash-worker', cents: 1000, updatedAt: Date.now() });
const chatBody = JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] });

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

const unauth = await pair('/compute/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody });
assert.equal(unauth.status, 401);
assert.equal(unauth.body.error.message, 'invalid API key');
assert.equal(unauth.body.error.type, 'authentication_error');
assert.match(unauth.headers.get('content-type') || '', /application\/json/);

const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const empty = await pair('/compute/api/v1/chat/completions', { method: 'POST', headers: auth, body: chatBody });
assert.equal(empty.status, 503);
assert.equal(empty.body.error.message, 'No Mac is online.');
assert.equal([...rows.keys()].some(key => key.startsWith('compute:job:')), false, 'empty network must not ghost-queue v1 chat');

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
  const wUnauth = await workerPair(host, '/compute/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody });
  assert.equal(wUnauth.status, 401, `${host} unauth`);
  assert.match(wUnauth.type, /application\/json/);
  assert.equal(wUnauth.body.error.message, 'invalid API key');
  const wAuth = await workerPair(host, '/compute/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${workerToken}`, 'Content-Type': 'application/json' }, body: chatBody });
  assert.equal(wAuth.status, 503, `${host} authed empty`);
  assert.equal(wAuth.body.error.message, 'No Mac is online.');
}

const modelsSlash = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/models/'), workerEnv);
assert.equal(modelsSlash.status, 401);
assert.deepEqual(await modelsSlash.json(), { error: { message: 'invalid API key', type: 'authentication_error', code: null } });

const wwwFoo = await worker.fetch(new Request('https://www.getdasha.com/compute/api/foo'), workerEnv);
assert.equal(wwwFoo.status, 404);
assert.deepEqual(await wwwFoo.json(), { error: 'not found' });

console.log('dasha-compute-v1-chat-completions-slash: PASS');
