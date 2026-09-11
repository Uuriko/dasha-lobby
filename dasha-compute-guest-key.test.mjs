#!/usr/bin/env node
/**
 * Guest / pairing API key — live mint.
 * POST /compute/api/guest-keys issues a 24h dgk_ key (hash at rest).
 * Rate-limited by IP + optional pairing code. Chat + models only.
 * GET/HEAD is the public contract (never mints). Chat accepts guest Bearer.
 * Packet + /compute/skill.md document the curl. No wrangler. No Room.
 * No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork, openaiErrorBody } from './dasha-compute-network.mjs';
import {
  COMPUTE_AGENT_JSON,
  COMPUTE_GUEST_KEYS_URL,
  COMPUTE_LLMS_TXT,
  COMPUTE_SKILL_MD,
} from './dasha-compute-agent.mjs';
import {
  COMPUTE_GUEST_KEYS_PATH,
  GUEST_KEY_CHAT_MAX,
  GUEST_KEY_KIND,
  GUEST_KEY_MINT_CURL,
  GUEST_KEY_MINT_MAX,
  GUEST_KEY_MINT_REASON,
  GUEST_KEY_RATE_LIMITED_REASON,
  GUEST_KEY_SCOPES,
  GUEST_KEY_SCOPE_REASON,
  GUEST_KEY_TTL_SECONDS,
  computeGuestKeyResponse,
  guestKeyAllows,
  guestKeyContractBody,
  guestKeyExpired,
  isComputeGuestKeyPath,
  isGuestApiKey,
  mintGuestKey,
  parseGuestApiToken,
  revokeGuestKey,
} from './dasha-compute-guest-key.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const guestSrc = readFileSync(join(root, 'dasha-compute-guest-key.mjs'), 'utf8');
const design = readFileSync(join(root, 'COMPUTE-GUEST-KEY.md'), 'utf8');

assert.match(networkSrc, /computeGuestKeyResponse/);
assert.match(networkSrc, /handleGuestKeyWrite/);
assert.match(workerSrc, /computeGuestKeyResponse/);
assert.match(networkSrc, /guest_key_mint: 'live'/);
assert.doesNotMatch(networkSrc, /guest_key_mint: 'deferred'/);
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(guestSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(guestSrc, /potter[_-]?key|DASHA_POTTER|people-data/i);
assert.doesNotMatch(guestSrc, /console\.log\([^)]*api_key/);
assert.match(design, /mint live/i);
assert.match(design, /pairing/i);
assert.match(design, /24h|86400/);
assert.doesNotMatch(design, /project-room/i);
assert.doesNotMatch(design, /plugin\.jup\.ag/);

assert.equal(isComputeGuestKeyPath('/compute/api/guest-keys'), true);
assert.equal(isComputeGuestKeyPath('/compute/api/guest-keys/'), true);
assert.equal(isComputeGuestKeyPath('/compute/api/guest-keys/gkey_abc'), true);
assert.equal(isComputeGuestKeyPath('/compute/api/keys'), false);
assert.equal(isComputeGuestKeyPath('/compute/api/v1/chat/completions'), false);

const contract = guestKeyContractBody();
assert.equal(contract.status, 'ok');
assert.equal(contract.reason, GUEST_KEY_MINT_REASON);
assert.equal(contract.mint, 'live');
assert.equal(contract.ttl_seconds, GUEST_KEY_TTL_SECONDS);
assert.deepEqual(contract.scopes, [...GUEST_KEY_SCOPES]);
assert.match(contract.hint, /24h/);
assert.match(contract.hint, /3\/hour\/IP/);
assert.ok(contract.hint.length > 0 && contract.hint.length < 160);
assert.equal(contract.next.some(s => s.path === '/compute/api/guest-keys'), true);
assert.equal(contract.next.some(s => s.path === '/compute/llms.txt'), true);
assert.equal(contract.next.some(s => s.path === '/compute/skill.md'), true);
assert.equal('api_key' in contract, false, 'GET contract never mints');
assert.equal(contract.curl, GUEST_KEY_MINT_CURL);
assert.doesNotMatch(JSON.stringify(contract), /plugin\.jup\.ag/);
assert.doesNotMatch(JSON.stringify(contract), /guest-agent/i);

assert.match(COMPUTE_LLMS_TXT, /^guest key POST \/compute\/api\/guest-keys — 24h chat\+models, 3\/hour\/IP$/m);
assert.match(COMPUTE_LLMS_TXT, /curl -sS -X POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/);
assert.match(COMPUTE_SKILL_MD, /Guest key: POST \/compute\/api\/guest-keys — 24h chat\+models/);
assert.match(COMPUTE_SKILL_MD, /curl -sS -X POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/);
assert.match(COMPUTE_SKILL_MD, /Sign in at https:\/\/www\.getdasha\.com\/compute#build/);
assert.doesNotMatch(COMPUTE_SKILL_MD, /guest-agent/i);
assert.doesNotMatch(COMPUTE_SKILL_MD, /mint deferred/);
assert.equal(COMPUTE_AGENT_JSON.endpoints.guest_keys, COMPUTE_GUEST_KEYS_URL);
assert.equal(COMPUTE_AGENT_JSON.auth.guest_key.ttl_seconds, GUEST_KEY_TTL_SECONDS);
assert.deepEqual(COMPUTE_AGENT_JSON.auth.guest_key.scopes, ['chat', 'models']);
assert.match(COMPUTE_AGENT_JSON.auth.guest_key.curl, /POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/);

{
  const key = openaiErrorBody('invalid API key', 401, 'authentication_error');
  assert.equal(key.next.some(s => s.path === '/compute#build'), true);
  assert.equal(key.next.some(s => s.path === '/compute/llms.txt'), true);
  assert.equal(key.next.some(s => s.path === '/compute/skill.md'), true);
  assert.equal(key.next.some(s => s.path === '/compute/api/guest-keys'), true);
  assert.match(key.hint, /\/compute\/skill\.md/);
}

{
  const limited = openaiErrorBody('guest key rate limited; try again shortly', 429, 'invalid_request_error');
  assert.equal(limited.reason, GUEST_KEY_RATE_LIMITED_REASON);
  assert.equal(limited.next.some(s => s.path === '/compute/api/guest-keys'), true);
  const scoped = openaiErrorBody('guest key cannot use this endpoint', 403, 'invalid_request_error');
  assert.equal(scoped.reason, GUEST_KEY_SCOPE_REASON);
}

{
  const miss = computeGuestKeyResponse(new Request('https://www.getdasha.com/compute/api/keys'));
  assert.equal(miss, null, 'helper ignores developer keys');
  const write = computeGuestKeyResponse(new Request('https://www.getdasha.com/compute/api/guest-keys', { method: 'POST' }));
  assert.equal(write, null, 'POST falls through to the DO');
}

function memoryStorage() {
  const rows = new Map();
  return {
    rows,
    async get(key) { return rows.get(key); },
    async put(key, value) {
      if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
      else rows.set(key, value);
    },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
  };
}

{
  const storage = memoryStorage();
  const rates = new Map();
  const minted = await mintGuestKey({ storage, rates, ip: '203.0.113.9', name: 'agent' });
  assert.equal(minted.status, 201, 'unit mint 201');
  assert.equal(minted.body.status, 'ok');
  assert.equal(minted.body.reason, GUEST_KEY_MINT_REASON);
  assert.match(minted.body.api_key, /^dgk_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]+$/);
  assert.equal(minted.body.ttl_seconds, GUEST_KEY_TTL_SECONDS);
  assert.deepEqual(minted.body.scopes, ['chat', 'models']);
  assert.equal(typeof minted.body.expires_at, 'number');
  assert.ok(minted.body.expires_at > Date.now());
  const parsed = parseGuestApiToken(minted.body.api_key);
  assert.equal(parsed.id, minted.body.id);
  const row = await storage.get(`compute:api-key:${minted.body.id}`);
  assert.equal(row.kind, GUEST_KEY_KIND);
  assert.equal(row.owner.startsWith('guest:'), true);
  assert.equal(row.tokenHash, createHash('sha256').update(minted.body.api_key).digest('hex'));
  assert.equal(JSON.stringify([...storage.rows.values()]).includes(minted.body.api_key), false, 'plaintext guest key must not be stored');
  assert.equal(isGuestApiKey(row), true);
  assert.equal(guestKeyAllows(row, 'chat'), true);
  assert.equal(guestKeyAllows(row, 'models'), true);
  assert.equal(guestKeyAllows(row, 'embeddings'), false);
  assert.equal(guestKeyExpired(row), false);
  assert.equal(guestKeyExpired({ ...row, expiresAt: Date.now() - 1 }), true);

  const badPair = await mintGuestKey({ storage, rates, ip: '203.0.113.10', pairing: 'no' });
  assert.equal(badPair.status, 400);
  assert.equal(badPair.body.reason, 'guest_key_invalid_pairing');
  assert.ok(badPair.body.hint);
  assert.ok(Array.isArray(badPair.body.next));

  const revoked = await revokeGuestKey({ storage, token: minted.body.api_key });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.revoked, true);
  assert.equal(await storage.get(`compute:api-key:${minted.body.id}`), undefined);
}

{
  const storage = memoryStorage();
  const rates = new Map();
  const ip = '198.51.100.7';
  for (let i = 0; i < GUEST_KEY_MINT_MAX; i++) {
    const minted = await mintGuestKey({ storage, rates, ip });
    assert.equal(minted.status, 201, `unit mint ${i + 1}`);
  }
  const blocked = await mintGuestKey({ storage, rates, ip });
  assert.equal(blocked.status, 429, 'unit mint rate-limit');
  assert.equal(blocked.body.reason, GUEST_KEY_RATE_LIMITED_REASON);
  assert.equal(blocked.body.status, 'action_required');
  assert.match(blocked.body.hint, /Wait/);
  assert.equal(blocked.body.next.some(s => s.path === '/compute/api/guest-keys'), true);
  const otherIp = await mintGuestKey({ storage, rates, ip: '198.51.100.8' });
  assert.equal(otherIp.status, 201, 'other IP still mints');

  const pairRates = new Map();
  for (let i = 0; i < GUEST_KEY_MINT_MAX; i++) {
    const minted = await mintGuestKey({ storage, rates: pairRates, ip: `203.0.113.${20 + i}`, pairing: 'room42' });
    assert.equal(minted.status, 201, `pairing mint ${i + 1}`);
  }
  const pairBlocked = await mintGuestKey({ storage, rates: pairRates, ip: '203.0.113.40', pairing: 'room42' });
  assert.equal(pairBlocked.status, 429, 'pairing code rate-limit');
  assert.equal(pairBlocked.body.reason, GUEST_KEY_RATE_LIMITED_REASON);
}

const env = { LOBBY_SESSION_SECRET: 'guest-key-secret', AI: { run: async () => ({ response: 'ok' }) } };
const storage = memoryStorage();
const network = new ComputeNetwork({ storage }, env);
const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };

function assertLiveGet(body, label) {
  assert.equal(body.status, 'ok', `${label} status`);
  assert.equal(body.reason, GUEST_KEY_MINT_REASON, `${label} reason`);
  assert.equal(body.mint, 'live', `${label} mint live`);
  assert.equal(body.ttl_seconds, GUEST_KEY_TTL_SECONDS, `${label} ttl`);
  assert.equal('api_key' in body, false, `${label} no api_key`);
  assert.match(body.curl, /POST /, `${label} curl`);
  assert.doesNotMatch(JSON.stringify(body), /dsk_|plugin\.jup\.ag|guest-agent/i, `${label} no leak`);
}

function assertMinted(body, label) {
  assert.equal(body.status, 'ok', `${label} status`);
  assert.equal(body.mint, 'live', `${label} mint`);
  assert.match(body.api_key, /^dgk_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]+$/, `${label} dgk_`);
  assert.equal(body.ttl_seconds, GUEST_KEY_TTL_SECONDS, `${label} ttl`);
  assert.deepEqual(body.scopes, ['chat', 'models'], `${label} scopes`);
  assert.doesNotMatch(body.api_key, /^dsk_/, `${label} not developer`);
}

async function pair(host, path, init = {}, fetchImpl) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  return { status: a.status, body: aText ? JSON.parse(aText) : null, type: a.headers.get('content-type'), headers: a.headers };
}

let hostIndex = 0;
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const fetchImpl = host === 'lobby.getdasha.com'
    ? (req) => network.fetch(req)
    : (req) => worker.fetch(req, workerEnv);

  const get = await pair(host, COMPUTE_GUEST_KEYS_PATH, {}, fetchImpl);
  assert.equal(get.status, 200, `${host} GET guest-keys`);
  assert.match(get.type || '', /application\/json/);
  assert.equal(get.headers.get('access-control-allow-origin'), '*');
  assert.equal(get.headers.get('x-dasha-edge'), 'compute-guest-key');
  assertLiveGet(get.body, `${host} GET`);

  const head = await fetchImpl(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}/`, { method: 'HEAD' }));
  assert.equal(head.status, 200, `${host} HEAD guest-keys`);
  assert.equal(head.headers.get('x-dasha-edge'), 'compute-guest-key');
  assert.equal(await head.text(), '');

  const posted = await fetchImpl(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${50 + hostIndex}` },
    body: JSON.stringify({ name: 'agent' }),
  }));
  assert.equal(posted.status, 201, `${host} POST guest-keys 201`);
  assert.equal(posted.headers.get('x-dasha-edge'), 'compute-guest-key');
  const minted = await posted.json();
  assertMinted(minted, `${host} POST`);
  assert.equal(JSON.stringify([...storage.rows.values()]).includes(minted.api_key), false, `${host} hash at rest`);

  const slashPost = await fetchImpl(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${60 + hostIndex}` },
    body: '{}',
  }));
  assert.equal(slashPost.status, 201, `${host} POST slash 201`);

  const opt = await fetchImpl(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}`, { method: 'OPTIONS' }));
  assert.equal(opt.status, 204, `${host} OPTIONS`);
  assert.equal(opt.headers.get('access-control-allow-origin'), '*');

  const workerGet = await worker.fetch(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}`), workerEnv);
  assert.equal(workerGet.status, 200, `${host} worker GET`);
  assertLiveGet(await workerGet.json(), `${host} worker GET`);
  const workerPost = await worker.fetch(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${70 + hostIndex}` },
    body: '{}',
  }), workerEnv);
  assert.equal(workerPost.status, 201, `${host} worker POST`);
  assertMinted(await workerPost.json(), `${host} worker POST`);
  hostIndex += 1;
}

const rootApi = await network.fetch(new Request('https://lobby.getdasha.com/compute/api'));
assert.equal(rootApi.status, 200);
const rootBody = await rootApi.json();
assert.equal(rootBody.guest_keys, COMPUTE_GUEST_KEYS_PATH);
assert.equal(rootBody.guest_key_mint, 'live');

{
  const rateIp = '192.0.2.44';
  for (let i = 0; i < GUEST_KEY_MINT_MAX; i++) {
    const res = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/guest-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': rateIp },
      body: '{}',
    }));
    assert.equal(res.status, 201, `http mint ${i + 1}`);
  }
  const limited = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/guest-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': rateIp },
    body: '{}',
  }));
  assert.equal(limited.status, 429, 'http mint rate-limit');
  const limitedBody = await limited.json();
  assert.equal(limitedBody.reason, GUEST_KEY_RATE_LIMITED_REASON);
  assert.equal(limitedBody.status, 'action_required');
  assert.ok(limitedBody.hint);
  assert.ok(Array.isArray(limitedBody.next));
  assert.equal('api_key' in limitedBody, false);
}

const chatMint = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/guest-keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.80' },
  body: JSON.stringify({ name: 'chat-agent' }),
}));
assert.equal(chatMint.status, 201);
const guest = await chatMint.json();
const guestAuth = { Authorization: `Bearer ${guest.api_key}`, 'Content-Type': 'application/json' };
const chatBody = JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] });

const emptyChat = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: guestAuth,
  body: chatBody,
}));
assert.equal(emptyChat.status, 503, 'guest Bearer accepted (empty fleet)');
assert.equal((await emptyChat.json()).error.message, 'No Mac is online.');

await storage.put('compute:provider:mac_guestkey', {
  id: 'mac_guestkey',
  owner: 'x:other',
  name: 'Online Mac',
  models: ['qwen3-8b', 'gemma3-12b'],
  lastSeenAt: Date.now(),
});

const retrieve = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models/qwen3-8b', {
  headers: { Authorization: `Bearer ${guest.api_key}` },
}));
assert.equal(retrieve.status, 200, 'guest models retrieve');
assert.deepEqual(await retrieve.json(), { id: 'qwen3-8b', object: 'model', created: 0, owned_by: 'dasha-community' });

const embeddings = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/embeddings', {
  method: 'POST',
  headers: guestAuth,
  body: JSON.stringify({ model: 'qwen3-8b', input: 'hi' }),
}));
assert.equal(embeddings.status, 403, 'guest embeddings scoped out');
assert.equal((await embeddings.json()).reason, GUEST_KEY_SCOPE_REASON);

const chatP = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: guestAuth,
  body: chatBody,
}));
let jobEntry;
for (let i = 0; i < 20 && !jobEntry; i++) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  jobEntry = [...storage.rows.entries()].find(([k]) => k.startsWith('compute:job:'));
}
assert.ok(jobEntry, 'guest chat queued a job');
const [jobKey, job] = jobEntry;
await storage.put(jobKey, {
  ...job,
  status: 'complete',
  answer: 'hey from a Mac',
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});
const chat = await chatP;
assert.equal(chat.status, 200, 'guest chat completes');
const chatJson = await chat.json();
assert.equal(chatJson.choices[0].message.content, 'hey from a Mac');
assert.equal(chatJson.model, 'qwen3-8b');

const workerChat = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/models/gemma3-12b', {
  headers: { Authorization: `Bearer ${guest.api_key}` },
}), workerEnv);
assert.equal(workerChat.status, 200, 'worker guest models retrieve');

const expiredToken = 'dgk_expiredguest.abcdefghijklmnopqrstuvwx';
const expiredId = 'gkey_expiredguest';
await storage.put(`compute:api-key:${expiredId}`, {
  id: expiredId,
  owner: 'guest:expiredguest',
  name: 'Expired',
  kind: GUEST_KEY_KIND,
  prefix: expiredToken.slice(0, 12),
  tokenHash: createHash('sha256').update(expiredToken).digest('hex'),
  createdAt: Date.now() - 48 * 60 * 60_000,
  lastUsedAt: 0,
  expiresAt: Date.now() - 1000,
  scopes: [...GUEST_KEY_SCOPES],
});
const expiredChat = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${expiredToken}`, 'Content-Type': 'application/json' },
  body: chatBody,
}));
assert.equal(expiredChat.status, 401, 'expired guest key');
assert.equal((await expiredChat.json()).reason, 'invalid_api_key');

const revoked = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/guest-keys/${guest.id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${guest.api_key}` },
}));
assert.equal(revoked.status, 200, 'DELETE revokes');
assert.deepEqual(await revoked.json(), { ok: true, revoked: true, id: guest.id });
const afterRevoke = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: guestAuth,
  body: chatBody,
}));
assert.equal(afterRevoke.status, 401, 'revoked guest key');

assert.equal([...storage.rows.keys()].some(k => /email|phone|ssn/i.test(k)), false, 'no people-data');
assert.equal([...storage.rows.keys()].some(k => String(k).startsWith('compute:api-key:key_')), false, 'must not invent developer keys');
assert.ok(GUEST_KEY_CHAT_MAX >= 1);

console.log('dasha-compute-guest-key: PASS (live mint + rate-limit + expired + guest chat; no plugin.jup.ag)');
