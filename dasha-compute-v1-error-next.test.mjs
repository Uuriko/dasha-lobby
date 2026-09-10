#!/usr/bin/env node
/**
 * AX slice: OpenAI-compatible /compute/api/v1 errors keep {error.message,type,code}
 * and add status/reason/hint/next so agents get the next command or path.
 * No wrangler. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker from './dasha-lobby-worker.mjs';
import {
  ComputeNetwork,
  openaiErrorAx,
  openaiErrorBody,
} from './dasha-compute-network.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /function openaiError\(/);
assert.match(src, /openaiErrorBody\(/);
assert.match(src, /errors: 'openai \+ status\/reason\/hint\/next'/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);
assert.doesNotMatch(src, /potter[_-]?key|DASHA_POTTER|people-data/i);

function assertAxNext(body, { message, type, reason, status = 'action_required' } = {}) {
  assert.equal(typeof body.error, 'object', 'openai error object');
  assert.equal(body.error.message, message);
  assert.equal(body.error.type, type);
  assert.equal(body.error.code, null);
  assert.equal(body.status, status);
  assert.equal(body.reason, reason);
  assert.equal(typeof body.hint, 'string');
  assert.ok(body.hint.length > 0 && body.hint.length < 160, 'short hint');
  assert.doesNotMatch(body.hint, /plugin\.jup\.ag/);
  assert.ok(Array.isArray(body.next) && body.next.length >= 1, 'next[]');
  for (const step of body.next) {
    assert.equal(typeof step, 'object');
    const path = step.path, command = step.command;
    assert.ok(path || command, 'command or path');
    if (path) {
      assert.equal(typeof path, 'string');
      assert.match(path, /^\/compute/);
      assert.doesNotMatch(path, /plugin\.jup\.ag/);
    }
    if (command) {
      assert.equal(typeof command, 'string');
      assert.doesNotMatch(command, /plugin\.jup\.ag/);
    }
  }
  assert.deepEqual(body, openaiErrorBody(message, body.status === 'failed' ? 500 : 400, type));
}

{
  const key = openaiErrorBody('invalid API key', 401, 'authentication_error');
  assertAxNext(key, { message: 'invalid API key', type: 'authentication_error', reason: 'invalid_api_key' });
  assert.equal(key.next.some(s => s.path === '/compute#build'), true);
  assert.equal(key.next.some(s => /Authorization: Bearer \$DASHA_KEY/.test(s.command || '')), true);

  const credits = openaiErrorBody('top up credits', 402, 'invalid_request_error');
  assertAxNext(credits, { message: 'top up credits', type: 'invalid_request_error', reason: 'credits_required' });
  assert.equal(credits.next.some(s => s.path === '/compute#pay'), true);

  const cap = openaiErrorBody('key spend limit reached', 402, 'invalid_request_error');
  assertAxNext(cap, { message: 'key spend limit reached', type: 'invalid_request_error', reason: 'key_spend_limit' });

  const nomac = openaiErrorBody('No Mac is online.', 503, 'server_error');
  assertAxNext(nomac, { message: 'No Mac is online.', type: 'server_error', reason: 'no_mac_online' });
  assert.equal(nomac.next.some(s => s.path === '/compute/api/network'), true);
  assert.equal(nomac.next.some(s => s.path === '/compute#provide'), true);

  const inflight = openaiErrorBody('finish your current community request first', 409, 'invalid_request_error');
  assertAxNext(inflight, { message: 'finish your current community request first', type: 'invalid_request_error', reason: 'job_in_flight' });
  assert.equal(inflight.next[0].path, '/compute/api/jobs');

  const limited = openaiErrorBody('community limit reached; try again shortly', 429, 'invalid_request_error');
  assertAxNext(limited, { message: 'community limit reached; try again shortly', type: 'invalid_request_error', reason: 'rate_limited' });

  const miss = openaiErrorBody("The model 'nope' does not exist", 404, 'invalid_request_error');
  assertAxNext(miss, { message: "The model 'nope' does not exist", type: 'invalid_request_error', reason: 'unknown_model' });

  const embed = openaiErrorBody('embeddings are not supported; use POST /v1/chat/completions', 400, 'invalid_request_error');
  assertAxNext(embed, {
    message: 'embeddings are not supported; use POST /v1/chat/completions',
    type: 'invalid_request_error',
    reason: 'use_chat_completions',
  });
  assert.equal(embed.next[0].path, '/compute/api/v1/chat/completions');

  const method = openaiErrorBody('Only POST is supported. Use POST /v1/chat/completions', 405, 'invalid_request_error');
  assertAxNext(method, {
    message: 'Only POST is supported. Use POST /v1/chat/completions',
    type: 'invalid_request_error',
    reason: 'method_not_allowed',
  });
  assert.equal(method.next[0].path, '/compute/api/v1/chat/completions');

  assert.equal(openaiErrorAx('internal exploded', 500, 'server_error').status, 'failed');
}

const env = { LOBBY_SESSION_SECRET: 'v1-error-next-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_errornextxxx.abcdefghijklmnopqrstuvwx';
const id = 'key_errornextxxx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:errornext',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
await storage.put('compute:credit-balance:x:errornext', { owner: 'x:errornext', cents: 1000, updatedAt: Date.now() });
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const chatBody = JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] });

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };

async function pair(host, path, init, fetchImpl) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  return { status: a.status, body: aText ? JSON.parse(aText) : null };
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const fetchImpl = host === 'lobby.getdasha.com'
    ? (req) => network.fetch(req)
    : (req) => worker.fetch(req, workerEnv);

  const unauth = await pair(host, '/compute/api/v1/models', {}, fetchImpl);
  assert.equal(unauth.status, 401, `${host} models 401`);
  assertAxNext(unauth.body, { message: 'invalid API key', type: 'authentication_error', reason: 'invalid_api_key' });

  const chat = await pair(host, '/compute/api/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody,
  }, fetchImpl);
  assert.equal(chat.status, 401, `${host} chat 401`);
  assertAxNext(chat.body, { message: 'invalid API key', type: 'authentication_error', reason: 'invalid_api_key' });

  const getChat = await pair(host, '/compute/api/v1/chat/completions', { method: 'GET', headers: auth }, fetchImpl);
  assert.equal(getChat.status, 405, `${host} chat GET 405`);
  assertAxNext(getChat.body, {
    message: 'Only POST is supported. Use POST /v1/chat/completions',
    type: 'invalid_request_error',
    reason: 'method_not_allowed',
  });

  const embed = await pair(host, '/compute/api/v1/embeddings', {
    method: 'POST', headers: auth, body: JSON.stringify({ model: 'qwen3-8b', input: 'hi' }),
  }, fetchImpl);
  assert.equal(embed.status, 400, `${host} embeddings 400`);
  assertAxNext(embed.body, {
    message: 'embeddings are not supported; use POST /v1/chat/completions',
    type: 'invalid_request_error',
    reason: 'use_chat_completions',
  });

  const miss = await pair(host, '/compute/api/v1/models/nope-model', { headers: auth }, fetchImpl);
  assert.equal(miss.status, 404, `${host} retrieve 404`);
  assertAxNext(miss.body, {
    message: "The model 'nope-model' does not exist",
    type: 'invalid_request_error',
    reason: 'unknown_model',
  });

  const empty = await pair(host, '/compute/api/v1/chat/completions', {
    method: 'POST', headers: auth, body: chatBody,
  }, fetchImpl);
  assert.equal(empty.status, 503, `${host} empty fleet 503`);
  assertAxNext(empty.body, { message: 'No Mac is online.', type: 'server_error', reason: 'no_mac_online' });

  const gw = await pair(host, '/compute/api/v1', {}, fetchImpl);
  assert.equal(gw.status, 200, `${host} /v1`);
  assert.equal(gw.body.errors, 'openai + status/reason/hint/next');
  assert.doesNotMatch(JSON.stringify(gw.body), /plugin\.jup\.ag/);
}

await storage.put('compute:credit-balance:x:errornext', { owner: 'x:errornext', cents: 0, updatedAt: Date.now() });
const noCredits = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: auth, body: chatBody,
}));
assert.equal(noCredits.status, 402);
const noCreditsBody = await noCredits.json();
assertAxNext(noCreditsBody, { message: 'top up credits', type: 'invalid_request_error', reason: 'credits_required' });
assert.equal([...rows.keys()].some(k => k.startsWith('compute:job:')), false, 'no ghost job');

const token2 = 'dsk_errornext2xx.abcdefghijklmnopqrstuvwx';
const id2 = 'key_errornext2xx';
await storage.put(`compute:api-key:${id2}`, {
  id: id2,
  owner: 'x:errornext2',
  name: 'Developer key',
  prefix: token2.slice(0, 12),
  tokenHash: createHash('sha256').update(token2).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
await storage.put('compute:credit-balance:x:errornext2', { owner: 'x:errornext2', cents: 1000, updatedAt: Date.now() });
await storage.put('compute:provider:mac_errornext', {
  id: 'mac_errornext',
  owner: 'x:other',
  name: 'Online Mac',
  models: ['qwen3-8b'],
  lastSeenAt: Date.now(),
});
const auth2 = { Authorization: `Bearer ${token2}`, 'Content-Type': 'application/json' };
const stream = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: auth2, body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }], stream: true }),
}));
assert.equal(stream.status, 200);
await stream.body?.cancel().catch(() => {});
const inflightRes = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: auth2, body: chatBody,
}));
assert.equal(inflightRes.status, 409);
assertAxNext(await inflightRes.json(), {
  message: 'finish your current community request first',
  type: 'invalid_request_error',
  reason: 'job_in_flight',
});

assert.equal([...rows.keys()].some(k => /email|phone|ssn/i.test(k)), false, 'no people-data keys');
console.log('dasha-compute-v1-error-next: PASS (openai + status/reason/hint/next; no plugin.jup.ag)');
