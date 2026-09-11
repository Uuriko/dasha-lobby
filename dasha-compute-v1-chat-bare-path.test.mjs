#!/usr/bin/env node
/**
 * Leftover /compute/v1/chat/completions (agents omit /api) was opaque
 * `{error:"not found"}` 404 while /compute/api/v1/chat/completions is
 * fail-loud 401 OpenAI + status/reason/hint/next.
 * Same GET+HEAD+POST handler as the /api/v1 path (internal alias, not 308).
 * Apex + www + lobby. Trailing slash + Title-case via toLowerCase.
 * /compute/v1/models still 308. Bare /v1/chat/completions stays 404.
 * Do not invent singular /compute/v1/chat/completion. No guest-mint rewrite.
 * Disk only. No Designer. Never plugin.jup.ag. No Graham OCM.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import {
  ComputeNetwork,
  openaiErrorBody,
  rewriteComputeV1ChatCompletionsPath,
} from './dasha-compute-network.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const guestSrc = readFileSync(join(root, 'dasha-compute-guest-key.mjs'), 'utf8');
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/, 'network must not mention plugin.jup.ag');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(networkSrc, /rewriteComputeV1ChatCompletionsPath/, 'shared leftover rewrite helper');
assert.match(networkSrc, /\/compute\/v1\/chat\/completions/, 'leftover chat alias path');
assert.doesNotMatch(networkSrc, /\/compute\/v1\/chat\/completion'/, 'do not invent singular leftover');
assert.doesNotMatch(networkSrc, /\/compute\/ocm/, 'must not fold ocm');
assert.doesNotMatch(guestSrc, /\/compute\/v1\/chat\/completions/, 'guest-key mint must not advertise leftover path');

assert.equal(rewriteComputeV1ChatCompletionsPath('/compute/v1/chat/completions'), '/compute/api/v1/chat/completions');
assert.equal(rewriteComputeV1ChatCompletionsPath('/compute/v1/chat/completions/'), '/compute/api/v1/chat/completions/');
assert.equal(rewriteComputeV1ChatCompletionsPath('/Compute/v1/chat/completions'), '/compute/api/v1/chat/completions');
assert.equal(rewriteComputeV1ChatCompletionsPath('/COMPUTE/V1/CHAT/COMPLETIONS/'), '/compute/api/v1/chat/completions/');
assert.equal(rewriteComputeV1ChatCompletionsPath('/compute/api/v1/chat/completions'), null, 'exact API stays');
assert.equal(rewriteComputeV1ChatCompletionsPath('/v1/chat/completions'), null, 'do not invent bare /v1');
assert.equal(rewriteComputeV1ChatCompletionsPath('/compute/v1/chat/completion'), null, 'do not invent singular');
assert.equal(rewriteComputeV1ChatCompletionsPath('/compute/v1/models'), null, 'models stays 308 family');

const CANON = '/compute/api/v1/chat/completions';
const ALIAS = [
  '/compute/v1/chat/completions',
  '/compute/v1/chat/completions/',
  '/Compute/v1/chat/completions',
  '/COMPUTE/V1/CHAT/COMPLETIONS/',
];
const STAY_OUT = [
  '/v1/chat/completions',
  '/v1/chat/completions/',
  '/compute/v1/chat/completion',
  '/compute/v1/embeddings',
];

for (const path of ALIAS) {
  assert.equal(potterHome308Dest(path), null, `${path} is alias not 308`);
}
assert.equal(potterHome308Dest(CANON), null, 'exact API stays handler');
assert.equal(potterHome308Dest('/compute/v1/models'), 'https://www.getdasha.com/compute/api/v1/models', 'models still 308');
assert.equal(potterHome308Dest('/v1/chat/completions'), null, 'bare /v1/chat/completions stays out');
assert.equal(potterHome308Dest('/compute/ocm/healthz'), null, 'do not fold /compute/ocm');

const env = { LOBBY_SESSION_SECRET: 'compute-v1-chat-bare-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const chatBody = JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] });
const want = openaiErrorBody('invalid API key', 401, 'authentication_error');

function assertFailLoud(res, body, label) {
  assert.equal(res.status, 401, `${label} 401`);
  assert.notEqual(res.status, 404, `${label} not opaque 404`);
  assert.notDeepEqual(body, { error: 'not found' }, `${label} not {error:not found}`);
  assert.equal(body.error.message, 'invalid API key', `${label} message`);
  assert.equal(body.error.type, 'authentication_error', `${label} type`);
  assert.equal(body.reason, 'invalid_api_key', `${label} reason`);
  assert.equal(body.status, 'action_required', `${label} status`);
  assert.ok(Array.isArray(body.next) && body.next.length >= 1, `${label} next[]`);
  assert.equal(body.next.some((s) => s.path === '/compute#build'), true, `${label} next build`);
  assert.equal(body.next.some((s) => s.path === '/compute/llms.txt'), true, `${label} next llms`);
  assert.equal(body.next.some((s) => s.path === '/compute/skill.md'), true, `${label} next skill`);
  assert.equal(body.next.some((s) => s.path === '/compute/api/guest-keys'), true, `${label} next guest-keys`);
  assert.deepEqual(body, want, `${label} body parity with openaiErrorBody`);
  assert.doesNotMatch(JSON.stringify(body), /plugin\.jup\.ag/);
}

async function readJson(res, label) {
  const text = await res.text();
  assert.match(res.headers.get('content-type') || '', /application\/json/, `${label} json`);
  return text ? JSON.parse(text) : null;
}

{
  const canon = await network.fetch(new Request(`https://lobby.getdasha.com${CANON}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody,
  }));
  const alias = await network.fetch(new Request('https://lobby.getdasha.com/compute/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody,
  }));
  const canonBody = await readJson(canon, 'ComputeNetwork canon POST');
  const aliasBody = await readJson(alias, 'ComputeNetwork alias POST');
  assertFailLoud(canon, canonBody, 'ComputeNetwork canon POST');
  assertFailLoud(alias, aliasBody, 'ComputeNetwork alias POST');
  assert.deepEqual(aliasBody, canonBody, 'ComputeNetwork alias==canon');
}

for (const host of ['getdasha.com', 'www.getdasha.com', 'lobby.getdasha.com']) {
  const fetchImpl = (req) => worker.fetch(req, workerEnv);
  const canonRes = await fetchImpl(new Request(`https://${host}${CANON}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody,
  }));
  const canonBody = await readJson(canonRes, `${host} canon POST`);
  assertFailLoud(canonRes, canonBody, `${host} canon POST`);

  for (const path of ALIAS) {
    for (const method of ['POST', 'GET', 'HEAD']) {
      const init = method === 'POST'
        ? { method, headers: { 'Content-Type': 'application/json' }, body: chatBody }
        : { method };
      const res = await fetchImpl(new Request(`https://${host}${path}`, init));
      const label = `${host} ${path} ${method}`;
      assert.equal(res.status, 401, `${label} 401`);
      assert.notEqual(res.status, 404, `${label} not 404`);
      const text = await res.text();
      if (method === 'HEAD' && !text) continue;
      assert.match(res.headers.get('content-type') || '', /application\/json/, `${label} json`);
      const body = JSON.parse(text);
      assertFailLoud(res, body, label);
      assert.deepEqual(body, canonBody, `${label} same shape as api/v1`);
    }
  }

  const models = await fetchImpl(new Request(`https://${host}/compute/v1/models`, { method: 'GET' }));
  assert.equal(models.status, 308, `${host} /compute/v1/models still 308`);
  const wantLoc = host === 'lobby.getdasha.com'
    ? 'https://lobby.getdasha.com/compute/api/v1/models'
    : 'https://www.getdasha.com/compute/api/v1/models';
  assert.equal(models.headers.get('location'), wantLoc, `${host} models dest`);

  for (const path of STAY_OUT) {
    const res = await fetchImpl(new Request(`https://${host}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody,
    }));
    assert.notEqual(res.status, 401, `${host} ${path} is not the chat alias`);
    if ((res.headers.get('content-type') || '').includes('json')) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) {
        assert.notEqual(body?.error?.type, 'authentication_error', `${host} ${path} not fail-loud chat`);
      }
    } else {
      await res.text();
    }
  }
}

assert.equal([...rows.keys()].some((key) => key.startsWith('compute:job:')), false, 'must not ghost-queue');
assert.equal([...rows.keys()].some((key) => key.startsWith('compute:api-key:')), false, 'must not mint a key');
console.log('dasha-compute-v1-chat-bare-path: PASS (/compute/v1/chat/completions same fail-loud 401 as /api/v1; GET+HEAD+POST; apex+www+lobby; slash/Title-case; models 308; bare /v1 404; no guest-mint; no plugin.jup.ag)');
