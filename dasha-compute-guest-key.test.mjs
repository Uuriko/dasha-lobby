#!/usr/bin/env node
/**
 * Guest / pairing API key — smallest vertical.
 * POST /compute/api/guest-keys is 501 mint deferred (status/reason/hint/next).
 * GET/HEAD is the public contract. Never returns api_key. Chat stays keyed.
 * Packet + /compute/skill.md document Sign in → /compute#build.
 * No wrangler. No Room. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
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
  COMPUTE_SKILL_URL,
} from './dasha-compute-agent.mjs';
import {
  COMPUTE_GUEST_KEYS_PATH,
  GUEST_KEY_MINT_DEFERRED_REASON,
  computeGuestKeyResponse,
  guestKeyContractBody,
  isComputeGuestKeyPath,
} from './dasha-compute-guest-key.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const guestSrc = readFileSync(join(root, 'dasha-compute-guest-key.mjs'), 'utf8');
const design = readFileSync(join(root, 'COMPUTE-GUEST-KEY.md'), 'utf8');

assert.match(networkSrc, /computeGuestKeyResponse/);
assert.match(workerSrc, /computeGuestKeyResponse/);
assert.match(networkSrc, /guest_key_mint: 'deferred'/);
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(guestSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(guestSrc, /potter[_-]?key|DASHA_POTTER|people-data/i);
assert.doesNotMatch(guestSrc, /console\.log\([^)]*api_key/);
assert.match(design, /Mint is deferred/);
assert.match(design, /pairing-code/i);
assert.match(design, /Packet claim/);
assert.doesNotMatch(design, /project-room/i);

assert.equal(isComputeGuestKeyPath('/compute/api/guest-keys'), true);
assert.equal(isComputeGuestKeyPath('/compute/api/guest-keys/'), true);
assert.equal(isComputeGuestKeyPath('/compute/api/guest-keys/key_abc'), true);
assert.equal(isComputeGuestKeyPath('/compute/api/keys'), false);
assert.equal(isComputeGuestKeyPath('/compute/api/v1/chat/completions'), false);

const contract = guestKeyContractBody();
assert.equal(contract.status, 'action_required');
assert.equal(contract.reason, GUEST_KEY_MINT_DEFERRED_REASON);
assert.equal(contract.mint, 'deferred');
assert.match(contract.hint, /\/compute#build/);
assert.match(contract.hint, /Sign in/);
assert.ok(contract.hint.length > 0 && contract.hint.length < 160);
assert.equal(contract.next.some(s => s.path === '/compute#build'), true);
assert.equal(contract.next.some(s => s.path === '/compute/llms.txt'), true);
assert.equal(contract.next.some(s => s.path === '/compute/skill.md'), true);
assert.equal('api_key' in contract, false, 'contract never mints');
assert.doesNotMatch(JSON.stringify(contract), /plugin\.jup\.ag/);
assert.doesNotMatch(JSON.stringify(contract), /guest-agent/i);

assert.match(COMPUTE_LLMS_TXT, /^guest key POST \/compute\/api\/guest-keys — mint deferred; Sign in at \/compute#build$/m);
assert.match(COMPUTE_SKILL_MD, /Guest key: POST \/compute\/api\/guest-keys \(mint deferred\)/);
assert.match(COMPUTE_SKILL_MD, /Sign in at https:\/\/www\.getdasha\.com\/compute#build/);
assert.doesNotMatch(COMPUTE_SKILL_MD, /guest-agent/i);
assert.equal(COMPUTE_AGENT_JSON.endpoints.guest_keys, COMPUTE_GUEST_KEYS_URL);

{
  const key = openaiErrorBody('invalid API key', 401, 'authentication_error');
  assert.equal(key.next.some(s => s.path === '/compute#build'), true);
  assert.equal(key.next.some(s => s.path === '/compute/llms.txt'), true);
  assert.equal(key.next.some(s => s.path === '/compute/skill.md'), true);
  assert.equal(key.next.some(s => s.path === '/compute/api/guest-keys'), true);
  assert.match(key.hint, /\/compute\/skill\.md/);
}

{
  const miss = computeGuestKeyResponse(new Request('https://www.getdasha.com/compute/api/keys'));
  assert.equal(miss, null, 'helper ignores developer keys');
}

const env = { LOBBY_SESSION_SECRET: 'guest-key-secret', AI: { run: async () => ({ response: 'ok' }) } };
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

function assertContract(body, label) {
  assert.equal(body.status, 'action_required', `${label} status`);
  assert.equal(body.reason, GUEST_KEY_MINT_DEFERRED_REASON, `${label} reason`);
  assert.equal(body.mint, 'deferred', `${label} mint deferred`);
  assert.match(body.hint, /\/compute#build/, `${label} hint #build`);
  assert.equal(body.next.some(s => s.path === '/compute#build'), true, `${label} next #build`);
  assert.equal(body.next.some(s => s.path === COMPUTE_SKILL_URL.replace('https://www.getdasha.com', '') || s.path === '/compute/skill.md'), true, `${label} next skill`);
  assert.equal('api_key' in body, false, `${label} no api_key`);
  assert.doesNotMatch(JSON.stringify(body), /dsk_|plugin\.jup\.ag|guest-agent/i, `${label} no mint leak`);
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

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const fetchImpl = host === 'lobby.getdasha.com'
    ? (req) => network.fetch(req)
    : (req) => worker.fetch(req, workerEnv);

  const get = await pair(host, COMPUTE_GUEST_KEYS_PATH, {}, fetchImpl);
  assert.equal(get.status, 200, `${host} GET guest-keys`);
  assert.match(get.type || '', /application\/json/);
  assert.equal(get.headers.get('access-control-allow-origin'), '*');
  assert.equal(get.headers.get('x-dasha-edge'), 'compute-guest-key');
  assertContract(get.body, `${host} GET`);

  const head = await fetchImpl(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}/`, { method: 'HEAD' }));
  assert.equal(head.status, 200, `${host} HEAD guest-keys`);
  assert.equal(head.headers.get('x-dasha-edge'), 'compute-guest-key');
  assert.equal(await head.text(), '');

  const posted = await pair(host, COMPUTE_GUEST_KEYS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'agent' }),
  }, fetchImpl);
  assert.equal(posted.status, 501, `${host} POST guest-keys 501`);
  assertContract(posted.body, `${host} POST`);

  const revoked = await pair(host, `${COMPUTE_GUEST_KEYS_PATH}/key_nope`, { method: 'DELETE' }, fetchImpl);
  assert.equal(revoked.status, 501, `${host} DELETE guest-keys 501`);
  assertContract(revoked.body, `${host} DELETE`);

  const opt = await fetchImpl(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}`, { method: 'OPTIONS' }));
  assert.equal(opt.status, 204, `${host} OPTIONS`);
  assert.equal(opt.headers.get('access-control-allow-origin'), '*');

  const workerGet = await worker.fetch(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}`), workerEnv);
  assert.equal(workerGet.status, 200, `${host} worker GET`);
  assertContract(await workerGet.json(), `${host} worker GET`);
  const workerPost = await worker.fetch(new Request(`https://${host}${COMPUTE_GUEST_KEYS_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }), workerEnv);
  assert.equal(workerPost.status, 501, `${host} worker POST`);
  assertContract(await workerPost.json(), `${host} worker POST`);
}

const rootApi = await network.fetch(new Request('https://lobby.getdasha.com/compute/api'));
assert.equal(rootApi.status, 200);
const rootBody = await rootApi.json();
assert.equal(rootBody.guest_keys, COMPUTE_GUEST_KEYS_PATH);
assert.equal(rootBody.guest_key_mint, 'deferred');

assert.equal([...rows.keys()].some(k => /email|phone|ssn|api_key/i.test(k)), false, 'no people-data or minted keys');
assert.equal([...rows.keys()].some(k => String(k).startsWith('compute:api-key:')), false, 'must not invent developer keys');

console.log('dasha-compute-guest-key: PASS (501 mint deferred + GET contract + packet/skill/401 next; no plugin.jup.ag)');
