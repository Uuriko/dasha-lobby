#!/usr/bin/env node
/** GET+HEAD /v1/embeddings|/completions|/responses (bare+slash) on ComputeNetwork + worker www/lobby: OpenAI JSON, never 404 not-found. Match chat/completions auth-first. POST unauth stays 401. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'v1-get-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_getheadxxxxx.abcdefghijklmnopqrstuvwx';
const id = 'key_getheadxxxxx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:gethead',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});

const PATHS = [
  '/compute/api/v1/embeddings',
  '/compute/api/v1/completions',
  '/compute/api/v1/responses',
];

function assertNotGeneric404(status, body, label) {
  assert.notEqual(status, 404, `${label} must not be 404`);
  if (body && typeof body === 'object') {
    assert.notEqual(body.error, 'not found', `${label} must not be generic not-found`);
  }
}

async function assertGetHeadOpenAI(fetchImpl, host, path, init = {}) {
  const bare = path.endsWith('/') ? path.slice(0, -1) : path;
  const slash = bare + '/';
  let last = null;
  for (const p of [bare, slash]) {
    const get = await fetchImpl(new Request(`https://${host}${p}`, { ...init, method: 'GET' }));
    const head = await fetchImpl(new Request(`https://${host}${p}`, { ...init, method: 'HEAD' }));
    const getText = await get.text();
    const headText = await head.text();
    assert.match(get.headers.get('content-type') || '', /application\/json/, `${host} ${p} GET type`);
    assert.match(head.headers.get('content-type') || '', /application\/json/, `${host} ${p} HEAD type`);
    assert.equal(head.status, get.status, `${host} ${p} HEAD status`);
    assert.equal(headText, '', `${host} ${p} HEAD body empty`);
    const body = JSON.parse(getText);
    assertNotGeneric404(get.status, body, `${host} ${p} GET`);
    assert.equal(typeof body.error, 'object', `${host} ${p} OpenAI error object`);
    assert.equal(typeof body.error.message, 'string', `${host} ${p} message`);
    assert.equal(typeof body.error.type, 'string', `${host} ${p} type`);
    if (last) {
      assert.equal(get.status, last.status, `${host} ${bare} slash parity status`);
      assert.deepEqual(body, last.body, `${host} ${bare} slash parity body`);
    }
    last = { status: get.status, body };
  }
  return last;
}

for (const path of PATHS) {
  const unauth = await assertGetHeadOpenAI(network.fetch.bind(network), 'lobby.getdasha.com', path);
  assert.equal(unauth.status, 401, `network ${path} unauth`);
  assert.equal(unauth.body.error.message, 'invalid API key');
  assert.equal(unauth.body.error.type, 'authentication_error');

  const authed = await assertGetHeadOpenAI(network.fetch.bind(network), 'lobby.getdasha.com', path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(authed.status, 405, `network ${path} authed GET`);
  assert.equal(authed.body.error.type, 'invalid_request_error');
  assert.match(authed.body.error.message, /Only POST is supported/);
}

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of PATHS) {
    const wUnauth = await assertGetHeadOpenAI((req) => worker.fetch(req, workerEnv), host, path);
    assert.equal(wUnauth.status, 401, `${host} worker ${path} unauth`);
    assert.equal(wUnauth.body.error.message, 'invalid API key');

    const wAuth = await assertGetHeadOpenAI((req) => worker.fetch(req, workerEnv), host, path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(wAuth.status, 405, `${host} worker ${path} authed`);
    assert.match(wAuth.body.error.message, /Only POST is supported/);

    const post = await worker.fetch(new Request(`https://${host}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3-8b', input: 'hi' }),
    }), workerEnv);
    assert.equal(post.status, 401, `${host} POST ${path} still 401`);
    const postBody = await post.json();
    assert.equal(postBody.error.message, 'invalid API key');
  }
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:job:')), false, 'must not ghost-queue');
assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'no fake Mac');

console.log('dasha-compute-v1-embeddings-completions-responses-get-head: PASS (GET+HEAD OpenAI 401/405, not 404; POST unauth 401)');
