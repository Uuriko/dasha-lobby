#!/usr/bin/env node
/** OpenAI SDK POST /v1/embeddings must auth like chat completions, not generic {error:not found}. No fake vectors, no ghost jobs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'v1-embeddings-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_embedxxxxxxx.abcdefghijklmnopqrstuvwx';
const id = 'key_embedxxxxxxx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:embed',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
const embedBody = JSON.stringify({ model: 'qwen3-8b', input: 'hi' });

async function pair(fetchImpl, host, path, init = {}) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slashPath = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slashPath}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type`);
  assert.equal(aText, bText, `${host} ${path} body`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, body: JSON.parse(aText) };
}

const unauth = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/embeddings', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: embedBody,
});
assert.equal(unauth.status, 401);
assert.equal(unauth.body.error.message, 'invalid API key');
assert.equal(unauth.body.error.type, 'authentication_error');
assert.notEqual(unauth.body.error, 'not found');

const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const authed = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/embeddings', {
  method: 'POST', headers: auth, body: embedBody,
});
assert.equal(authed.status, 400);
assert.equal(authed.body.error.type, 'invalid_request_error');
assert.match(authed.body.error.message, /not supported/);
assert.equal(authed.body.object, undefined);
assert.equal(authed.body.data, undefined);
assert.equal([...rows.keys()].some(key => key.startsWith('compute:job:')), false, 'embeddings must not ghost-queue');
assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'no fake Mac');

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wUnauth = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/embeddings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: embedBody,
  });
  assert.equal(wUnauth.status, 401, `${host} worker unauth embeddings`);
  assert.equal(wUnauth.body.error.message, 'invalid API key');
  const wAuthed = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/embeddings', {
    method: 'POST', headers: auth, body: embedBody,
  });
  assert.equal(wAuthed.status, 400, `${host} worker authed embeddings`);
  assert.match(wAuthed.body.error.message, /not supported/);
}

const list = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/models'), workerEnv);
assert.equal(list.status, 401);
assert.deepEqual(await list.json(), { error: { message: 'invalid API key', type: 'authentication_error', code: null } });
const retrieve = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/models/qwen3-8b'), workerEnv);
assert.equal(retrieve.status, 401);
assert.equal((await retrieve.json()).error.message, 'invalid API key');
const chat = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] }),
}), workerEnv);
assert.equal(chat.status, 401);
const foo = await worker.fetch(new Request('https://www.getdasha.com/compute/api/foo'), workerEnv);
assert.equal(foo.status, 404);
assert.deepEqual(await foo.json(), { error: 'not found' });

console.log('dasha-compute-v1-embeddings: PASS (OpenAI embeddings auth-first 401, no fake vectors)');
