#!/usr/bin/env node
/**
 * Soft-guest Compute reads: no key for healthz + network + GET /v1/models.
 * Chat/completions and models.retrieve still require a Bearer key.
 * 401 on /v1/* keeps OpenAI shape + status/reason/hint/next → #build + /compute/llms.txt.
 * Packet line matches. No wrangler. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker from './dasha-lobby-worker.mjs';
import {
  ComputeNetwork,
  openaiErrorBody,
} from './dasha-compute-network.mjs';
import { COMPUTE_AGENT_JSON, COMPUTE_LLMS_TXT } from './dasha-compute-agent.mjs';
const MODEL_PRICING_USD = { request: '0.05', prompt: '0', completion: '0', currency: 'USD', note: 'flat per chat completion (prepaid credits); self-route free' };

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /Soft-guest list: same advertised ids as public GET \/compute\/api\/network/);
assert.match(src, /path: '\/compute\/llms\.txt'/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);
assert.doesNotMatch(src, /potter[_-]?key|DASHA_POTTER|people-data/i);

assert.match(COMPUTE_LLMS_TXT, /^no key needed for healthz \+ network \+ models; key needed for chat$/m);
assert.deepEqual(COMPUTE_AGENT_JSON.auth.public_reads, ['healthz', 'network', 'models']);
assert.equal(COMPUTE_AGENT_JSON.auth.chat, 'bearer');

const env = { LOBBY_SESSION_SECRET: 'soft-guest-secret', AI: { run: async () => ({ response: 'ok' }) } };
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

const token = 'dsk_softguestxxx.abcdefghijklmnopqrstuvwx';
const id = 'key_softguestxxx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:softguest',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
await storage.put('compute:credit-balance:x:softguest', { owner: 'x:softguest', cents: 1000, updatedAt: Date.now() });
await storage.put('compute:provider:mac_softguest', {
  id: 'mac_softguest',
  owner: 'x:other',
  name: 'Online Mac',
  models: ['gemma3-12b', 'qwen3-8b'],
  lastSeenAt: Date.now(),
});

const EMPTY_LIST = { object: 'list', data: [] };
const LIVE_LIST = {
  object: 'list',
  data: [
    { id: 'gemma3-12b', object: 'model', created: 0, owned_by: 'dasha-community', pricing: MODEL_PRICING_USD, providers_online: 1 },
    { id: 'qwen3-8b', object: 'model', created: 0, owned_by: 'dasha-community', pricing: MODEL_PRICING_USD, providers_online: 1 },
  ],
};

function assertAxKey(body) {
  assert.deepEqual(body, openaiErrorBody('invalid API key', 401, 'authentication_error'));
  assert.equal(body.status, 'action_required');
  assert.equal(body.reason, 'invalid_api_key');
  assert.match(body.hint, /dsk_|dgk_/);
  assert.match(body.hint, /ocm_live_/);
  assert.match(body.hint, /\/compute\/api\/v1/);
  assert.equal(body.next.some(s => s.path === '/compute#build'), true);
  assert.equal(body.next.some(s => s.path === '/compute/llms.txt'), true);
  assert.equal(body.next.some(s => s.path === '/compute/skill.md'), true);
  assert.equal(body.next.some(s => s.path === '/compute/api/guest-keys'), true);
  assert.equal(body.next.some(s => s.path === '/compute/ocm/v1'), true);
  assert.doesNotMatch(JSON.stringify(body), /plugin\.jup\.ag/);
}

async function pair(host, path, init = {}) {
  const fetchImpl = host === 'lobby.getdasha.com'
    ? (req) => network.fetch(req)
    : (req) => worker.fetch(req, workerEnv);
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  return { status: a.status, body: aText ? JSON.parse(aText) : null, type: a.headers.get('content-type') };
}

{
  const key = openaiErrorBody('invalid API key', 401, 'authentication_error');
  assertAxKey(key);
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const healthz = await pair(host, '/compute/api/healthz');
  assert.equal(healthz.status, 200, `${host} healthz public`);
  assert.equal(healthz.body.ok, true);

  for (const path of ['/compute/api/network', '/compute/api/v1/network']) {
    const net = await pair(host, path);
    assert.equal(net.status, 200, `${host} ${path} public`);
    assert.equal(net.body.providers_online, 1);
    assert.deepEqual(net.body.models_available, ['gemma3-12b', 'qwen3-8b']);
  }

  const models = await pair(host, '/compute/api/v1/models');
  assert.equal(models.status, 200, `${host} models soft-guest`);
  assert.match(models.type, /application\/json/);
  assert.deepEqual(models.body, LIVE_LIST);

  const junk = await pair(host, '/compute/api/v1/models', { headers: { Authorization: 'Bearer wrong' } });
  assert.equal(junk.status, 200, `${host} junk Bearer still lists`);
  assert.deepEqual(junk.body, LIVE_LIST);

  const retrieve = await pair(host, '/compute/api/v1/models/gemma3-12b');
  assert.equal(retrieve.status, 401, `${host} retrieve still keyed`);
  assertAxKey(retrieve.body);

  const chat = await pair(host, '/compute/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.equal(chat.status, 401, `${host} chat still keyed`);
  assertAxKey(chat.body);
}

await storage.delete('compute:provider:mac_softguest');
const empty = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models'));
assert.equal(empty.status, 200);
assert.deepEqual(await empty.json(), EMPTY_LIST);
const emptyNet = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/network'))).json();
assert.equal(emptyNet.providers_online, 0);
assert.deepEqual(emptyNet.models_available, []);

const packet = await worker.fetch(new Request('https://www.getdasha.com/compute/llms.txt'), workerEnv);
assert.equal(packet.status, 200);
const packetBody = await packet.text();
assert.equal(packetBody, COMPUTE_LLMS_TXT);
assert.match(packetBody, /^no key needed for healthz \+ network \+ models; key needed for chat$/m);
assert.doesNotMatch(packetBody, /plugin\.jup\.ag/);

const auth = { Authorization: `Bearer ${token}` };
const retrieveOk = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models/qwen3-8b', { headers: auth }));
assert.equal(retrieveOk.status, 404, 'empty fleet retrieve does not invent a Mac');

assert.equal([...rows.keys()].some(k => /email|phone|ssn/i.test(k)), false, 'no people-data keys');
console.log('dasha-compute-soft-guest: PASS (healthz+network+models public; chat keyed + AX next; packet line; no plugin.jup.ag)');
