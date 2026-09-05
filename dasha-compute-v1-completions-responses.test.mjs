#!/usr/bin/env node
/** OpenAI leftover POST /v1/completions + /v1/responses: 401 unauth, 400 not supported authed. GET chat/completions JSON 401/405 not {error:not found}. Do not invent completions. Do not break chat POST. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'v1-completions-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_completexxxx.abcdefghijklmnopqrstuvwx';
const id = 'key_completexxxx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:complete',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
const completeBody = JSON.stringify({ model: 'qwen3-8b', prompt: 'hi' });
const responseBody = JSON.stringify({ model: 'qwen3-8b', input: 'hi' });
const chatBody = JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] });
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

function assertOpenAI401(res, label) {
  assert.equal(res.status, 401, label);
  assert.equal(res.body.error.message, 'invalid API key', label);
  assert.equal(res.body.error.type, 'authentication_error', label);
  assert.notEqual(res.body.error, 'not found', label);
}

function assertUnsupported400(res, kind, label) {
  assert.equal(res.status, 400, label);
  assert.equal(res.body.error.type, 'invalid_request_error', label);
  assert.match(res.body.error.message, /not supported/, label);
  assert.match(res.body.error.message, /chat\/completions/, label);
  assert.equal(res.body.choices, undefined, `${label} no fake choices`);
  assert.equal(res.body.id, undefined, `${label} no fake id`);
}

const unauthComplete = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/completions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: completeBody,
});
assertOpenAI401(unauthComplete, 'network unauth completions');

const unauthResponses = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/responses', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: responseBody,
});
assertOpenAI401(unauthResponses, 'network unauth responses');

const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const authedComplete = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/completions', {
  method: 'POST', headers: auth, body: completeBody,
});
assertUnsupported400(authedComplete, 'completions', 'network authed completions');

const authedResponses = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/responses', {
  method: 'POST', headers: auth, body: responseBody,
});
assertUnsupported400(authedResponses, 'responses', 'network authed responses');

const getChatUnauth = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/chat/completions', { method: 'GET' });
assertOpenAI401(getChatUnauth, 'network GET chat unauth');

const getChatAuthed = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/chat/completions', {
  method: 'GET', headers: { Authorization: `Bearer ${token}` },
});
assert.equal(getChatAuthed.status, 405);
assert.equal(getChatAuthed.body.error.type, 'invalid_request_error');
assert.match(getChatAuthed.body.error.message, /POST/);
assert.notEqual(getChatAuthed.body.error, 'not found');

assert.equal([...rows.keys()].some(key => key.startsWith('compute:job:')), false, 'must not ghost-queue leftover OpenAI routes');
assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'no fake Mac');

const chatPost = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/chat/completions', {
  method: 'POST', headers: auth, body: chatBody,
});
assert.equal(chatPost.status, 503);
assert.equal(chatPost.body.error.message, 'No Mac is online.');

const embed = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/embeddings', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: embedBody,
});
assertOpenAI401(embed, 'embeddings unauth still 401');
const embedAuth = await pair(network.fetch.bind(network), 'lobby.getdasha.com', '/compute/api/v1/embeddings', {
  method: 'POST', headers: auth, body: embedBody,
});
assert.equal(embedAuth.status, 400);
assert.match(embedAuth.body.error.message, /not supported/);

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wUnauthC = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: completeBody,
  });
  assertOpenAI401(wUnauthC, `${host} worker unauth completions`);
  const wAuthC = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/completions', {
    method: 'POST', headers: auth, body: completeBody,
  });
  assertUnsupported400(wAuthC, 'completions', `${host} worker authed completions`);

  const wUnauthR = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: responseBody,
  });
  assertOpenAI401(wUnauthR, `${host} worker unauth responses`);
  const wAuthR = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/responses', {
    method: 'POST', headers: auth, body: responseBody,
  });
  assertUnsupported400(wAuthR, 'responses', `${host} worker authed responses`);

  const wGet = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/chat/completions', { method: 'GET' });
  assertOpenAI401(wGet, `${host} worker GET chat`);

  const wChat = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody,
  });
  assertOpenAI401(wChat, `${host} worker POST chat still 401`);

  const wEmbed = await pair((req) => worker.fetch(req, workerEnv), host, '/compute/api/v1/embeddings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: embedBody,
  });
  assertOpenAI401(wEmbed, `${host} worker POST embeddings still 401`);
}

const list = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/models'), workerEnv);
assert.equal(list.status, 401);
assert.deepEqual(await list.json(), { error: { message: 'invalid API key', type: 'authentication_error', code: null } });
const retrieve = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/models/qwen3-8b'), workerEnv);
assert.equal(retrieve.status, 401);
assert.equal((await retrieve.json()).error.message, 'invalid API key');
const providers = await worker.fetch(new Request('https://www.getdasha.com/compute/api/providers'), workerEnv);
assert.equal(providers.status, 401);
const healthz = await worker.fetch(new Request('https://www.getdasha.com/compute/api/healthz'), workerEnv);
assert.equal(healthz.status, 200);
const sponsors = await worker.fetch(new Request('https://www.getdasha.com/compute/api/sponsors'), workerEnv);
assert.equal(sponsors.status, 200);
const status = await worker.fetch(new Request('https://www.getdasha.com/compute/api/status'), workerEnv);
assert.equal(status.status, 200);
const net = await worker.fetch(new Request('https://www.getdasha.com/compute/api/network'), workerEnv);
assert.equal(net.status, 200);
const jobs = await worker.fetch(new Request('https://www.getdasha.com/compute/api/jobs'), workerEnv);
assert.equal(jobs.status, 401);
const foo = await worker.fetch(new Request('https://www.getdasha.com/compute/api/foo'), workerEnv);
assert.equal(foo.status, 404);
assert.deepEqual(await foo.json(), { error: 'not found' });

console.log('dasha-compute-v1-completions-responses: PASS (401 then 400 not supported; GET chat 401/405; chat/embeddings unregressed)');
