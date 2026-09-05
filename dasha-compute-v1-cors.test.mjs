#!/usr/bin/env node
/** CORS on every /compute/api/v1 response: errors (401/400/404/405/402) and successes must carry
    Access-Control-Allow-Origin so the console and browser SDKs can read them. No-Origin API clients
    get ACAO '*' (OpenAI convention, same as the v1 gateway). Stream path threads the origin too. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'v1-cors-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const ORIGIN = 'https://www.getdasha.com';
const token = 'dsk_corskeyxxxxx.abcdefghijklmnopqrstuvwx';
await storage.put('compute:api-key:key_corskeyxxxxx', {
  id: 'key_corskeyxxxxx',
  owner: 'x:cors',
  name: 'CORS key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
const cappedToken = 'dsk_corscappedxx.abcdefghijklmnopqrstuvwx';
await storage.put('compute:api-key:key_corscappedxx', {
  id: 'key_corscappedxx',
  owner: 'x:cors',
  name: 'Capped key',
  prefix: cappedToken.slice(0, 12),
  tokenHash: createHash('sha256').update(cappedToken).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
  limit_cents: 0,
});

await storage.put('compute:provider:prov_cors', {
  id: 'prov_cors',
  owner: 'x:someoneelse',
  name: 'CORS Mac',
  models: ['qwen3-8b'],
  createdAt: Date.now(),
  lastSeenAt: Date.now(),
});

const auth = { Authorization: `Bearer ${token}` };
const capped = { Authorization: `Bearer ${cappedToken}` };

async function call(path, { method = 'GET', headers = {}, origin = ORIGIN, body } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  const init = { method, headers: h };
  if (body) init.body = JSON.stringify(body);
  return network.fetch(new Request(`https://lobby.getdasha.com${path}`, init), origin ? ORIGIN : null);
}

function assertCors(res, label, expected = ORIGIN) {
  assert.equal(res.headers.get('access-control-allow-origin'), expected, `${label}: ACAO must be ${expected} (got ${res.headers.get('access-control-allow-origin')})`);
}

// 1. unauth errors carry ACAO
assertCors(await call('/compute/api/v1/embeddings'), 'GET embeddings 401');
assert.equal((await call('/compute/api/v1/embeddings')).status, 401);
assertCors(await call('/compute/api/v1/embeddings', { method: 'POST' }), 'POST embeddings unauth 401');
assertCors(await call('/compute/api/v1/chat/completions'), 'GET chat 401');
assertCors(await call('/compute/api/v1/models'), 'GET models 401');

// 2. authed errors carry ACAO
const notSupported = await call('/compute/api/v1/embeddings', { method: 'POST', headers: auth });
assert.equal(notSupported.status, 400);
assertCors(notSupported, 'POST embeddings 400');
const only = await call('/compute/api/v1/completions', { headers: auth });
assert.equal(only.status, 405);
assertCors(only, 'GET completions 405');
const missing = await call('/compute/api/v1/models/no-such-model', { headers: auth });
assert.equal(missing.status, 404);
assertCors(missing, 'GET models/missing 404');

// 3. spend-cap 402 carries ACAO
const capped402 = await call('/compute/api/v1/chat/completions', { method: 'POST', headers: { ...capped, 'Content-Type': 'application/json' }, body: { model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] } });
assert.equal(capped402.status, 402);
assertCors(capped402, 'POST chat capped 402');

// 4. success: models list carries ACAO
const models = await call('/compute/api/v1/models', { headers: auth });
assert.equal(models.status, 200);
assertCors(models, 'GET models 200');

// 5. HEAD keeps the CORS headers
const head = await call('/compute/api/v1/embeddings', { method: 'HEAD' });
assert.equal(head.status, 401);
assertCors(head, 'HEAD embeddings 401');

// 6. stream path threads the origin
const stream = await call('/compute/api/v1/chat/completions', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: { model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }], stream: true } });
assert.equal(stream.status, 200);
assert.match(stream.headers.get('content-type') || '', /text\/event-stream/, 'stream SSE type');
assertCors(stream, 'POST chat stream 200');
await stream.body?.cancel().catch(() => {});

// 6b. non-stream success: complete the queued job mid-poll, 200 carries ACAO
const done = (async () => {
  const res = await call('/compute/api/v1/chat/completions', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: { model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] } });
  return res;
})();
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 100));
  const jobs = await storage.list({ prefix: 'compute:job:' });
  const row = [...jobs.values()].find(j => j.status === 'queued' || j.status === 'leased');
  if (row) { await storage.put(`compute:job:${row.id}`, { ...row, status: 'complete', answer: 'hi back', usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }); break; }
}
const chatOk = await done;
assert.equal(chatOk.status, 200, 'non-stream chat 200');
assertCors(chatOk, 'POST chat non-stream 200');
const chatBody = await chatOk.json();
assert.equal(chatBody.object, 'chat.completion');

// 7. no Origin: ACAO '*' (OpenAI convention; v1 gateway already behaves this way)
const noOrigin = await call('/compute/api/v1/embeddings', { origin: null });
assert.equal(noOrigin.status, 401);
assertCors(noOrigin, 'GET embeddings no-origin 401', '*');

// 8. credentials flag only on specific origins
assert.equal((await call('/compute/api/v1/embeddings')).headers.get('access-control-allow-credentials'), 'true', 'specific origin is credentialed');
assert.equal((await call('/compute/api/v1/embeddings', { origin: null })).headers.get('access-control-allow-credentials'), null, "star origin must not be credentialed");

console.log('dasha-compute-v1-cors: all assertions passed');
