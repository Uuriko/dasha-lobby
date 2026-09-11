#!/usr/bin/env node
/**
 * Compute JSON API opaque errors (404 / 405 / provider 401) use the same
 * fail-loud envelope as chat completions: {error.message,type,code} + status/reason/hint/next.
 * No wrangler. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork, openaiErrorBody } from './dasha-compute-network.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /function computeApiError\(/);
assert.match(src, /reason: 'not_found'/);
assert.match(src, /reason: 'invalid_provider_token'/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);
assert.doesNotMatch(src, /potter[_-]?key|DASHA_POTTER|people-data/i);

function assertLoud(body, message, status, type = 'invalid_request_error') {
  assert.equal(typeof body.error, 'object', 'openai error object');
  assert.equal(body.error.message, message);
  assert.equal(body.error.type, type);
  assert.equal(body.error.code, null);
  assert.equal(typeof body.status, 'string');
  assert.equal(typeof body.reason, 'string');
  assert.match(body.reason, /^[a-z][a-z0-9_]*$/);
  assert.equal(typeof body.hint, 'string');
  assert.ok(body.hint.length > 0 && body.hint.length < 160, 'short hint');
  assert.doesNotMatch(body.hint, /plugin\.jup\.ag/);
  assert.ok(Array.isArray(body.next) && body.next.length >= 1, 'next[]');
  for (const step of body.next) {
    assert.equal(typeof step, 'object');
    assert.ok(step.path || step.command, 'command or path');
    if (step.path) assert.match(step.path, /^\/compute/);
  }
  assert.deepEqual(body, openaiErrorBody(message, status, type));
}

const env = { LOBBY_SESSION_SECRET: 'api-error-loud-secret', AI: { run: async () => ({ response: 'ok' }) } };
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

  const unknown = await pair(host, '/compute/api/v1/foo', {}, fetchImpl);
  assert.equal(unknown.status, 404, `${host} /v1/foo 404`);
  assertLoud(unknown.body, 'not found', 404);
  assert.equal(unknown.body.reason, 'not_found');

  const method = await pair(host, '/compute/api/providers/verify', { method: 'GET' }, fetchImpl);
  assert.equal(method.status, 405, `${host} verify GET 405`);
  assertLoud(method.body, 'method not allowed', 405);
  assert.equal(method.body.reason, 'method_not_allowed');

  const provider = await pair(host, '/compute/api/providers/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }, fetchImpl);
  assert.equal(provider.status, 401, `${host} verify POST 401`);
  assertLoud(provider.body, 'invalid provider token', 401, 'authentication_error');
  assert.equal(provider.body.reason, 'invalid_provider_token');
}

const chat = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] }),
}), workerEnv);
assert.equal(chat.status, 401);
assertLoud(await chat.json(), 'invalid API key', 401, 'authentication_error');

assert.equal([...rows.keys()].some(k => /email|phone|ssn/i.test(k)), false, 'no people-data keys');
console.log('dasha-compute-api-error-loud: PASS (404/405/provider 401 fail-loud; chat 401 unregressed)');
