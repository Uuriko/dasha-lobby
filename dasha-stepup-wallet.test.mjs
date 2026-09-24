#!/usr/bin/env node
/**
 * Step-up auth reference implementation (task 18; design PR #291), wallet SIWS path.
 *
 * - sessionClaims / requireStepUp / mintStepUpGrantToken units (fresh login counts
 *   as step-up; rotation can never refresh auth_time; grant writes step_up_at)
 * - /auth/wallet/stepup/challenge + /auth/wallet/stepup/verify round-trip with a real
 *   Ed25519 signature: origin-bound, scope-bound, tighter TTL, single-use nonce,
 *   expiry, cross-scope rejection, replay rejection, 3-failure invalidation
 * - gated endpoints (payout-pref POST, payout POST, keys POST create): stale sessions
 *   get 403 step_up_required; fresh login (<10m) passes; reads + key revocation stay
 *   ungated; step-up grant cookie satisfies the gate
 *
 * Disk only. No wrangler. No deploys. No external sends.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
globalThis.WebSocketRequestResponsePair ||= class {};
import workerDefault, { DashaLobby } from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import {
  COOKIE,
  STEP_UP_WINDOW_MS,
  STEP_UP_CHALLENGE_TTL_MS,
  STEP_UP_MAX_ATTEMPTS,
  createWalletSessionToken,
  signPayload,
  verifyPayload,
  sessionClaims,
  requireStepUp,
  mintStepUpGrantToken,
  stepUpRequiredBody,
} from './dasha-lobby-x.mjs';
import { etc, getPublicKey, sign } from '@noble/ed25519';

etc.sha512Sync = (...msgs) => createHash('sha512').update(Buffer.concat(msgs.map((m) => Buffer.from(m)))).digest();

const SECRET = '<redacted>';
const ORIGIN = 'https://www.getdasha.com';
const originHeaders = { Origin: ORIGIN, 'Content-Type': 'application/json' };

function base58Encode(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const b of bytes) value = value * 256n + BigInt(b);
  let out = '';
  while (value > 0n) { out = alphabet[Number(value % 58n)] + out; value /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = '1' + out; }
  return out || '1';
}

const priv = new Uint8Array(32).fill(7);
const WALLET = base58Encode(getPublicKey(priv));
const priv2 = new Uint8Array(32).fill(42);
const WALLET2 = base58Encode(getPublicKey(priv2));
assert.ok(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(WALLET), 'test wallet address shape');

async function walletSign(message) {
  return base58Encode(await sign(new TextEncoder().encode(message), priv));
}

// ================= session-claim units =================

{
  const token = await createWalletSessionToken({ LOBBY_SESSION_SECRET: SECRET }, WALLET);
  const payload = await verifyPayload(SECRET, token);
  assert.equal(payload.auth_method, 'wallet', 'wallet token carries auth_method');
  assert.ok(Math.abs(payload.auth_time - Date.now()) < 5000, 'wallet token carries auth_time');

  const req = new Request('https://x/', { headers: { Cookie: `${COOKIE}=${token}` } });
  const claims = await sessionClaims({ LOBBY_SESSION_SECRET: SECRET }, req);
  assert.equal(claims.auth_method, 'wallet');
  assert.ok(Math.abs(claims.auth_time - Date.now()) < 5000);
  assert.equal(claims.step_up_at, null);

  // Legacy token (pre-claim): backfills auth_method + auth_time from wallet + iat.
  const legacy = await signPayload(SECRET, { v: 1, wallet: WALLET, iat: Date.now() - 36e5, exp: Date.now() + 36e5 });
  const legacyClaims = await sessionClaims({ LOBBY_SESSION_SECRET: SECRET },
    new Request('https://x/', { headers: { Cookie: `${COOKIE}=${legacy}` } }));
  assert.equal(legacyClaims.auth_method, 'wallet', 'backfill auth_method');
  assert.ok(Math.abs(legacyClaims.auth_time - (Date.now() - 36e5)) < 5000, 'backfill auth_time from iat');
}

// requireStepUp
{
  const now = Date.now();
  assert.deepEqual(requireStepUp({ auth_method: 'wallet', auth_time: now - 60_000, step_up_at: null }, STEP_UP_WINDOW_MS, now).via, 'fresh-login', 'fresh auth_time satisfies gate');
  assert.ok(requireStepUp({ auth_method: 'wallet', auth_time: now - 60_000, step_up_at: null }, STEP_UP_WINDOW_MS, now).ok);
  assert.ok(!requireStepUp({ auth_method: 'wallet', auth_time: now - 20 * 60_000, step_up_at: null }, STEP_UP_WINDOW_MS, now).ok, 'stale auth_time does not satisfy gate');
  assert.deepEqual(requireStepUp({ auth_method: 'wallet', auth_time: now - 20 * 60_000, step_up_at: now - 60_000, step_up_method: 'wallet' }, STEP_UP_WINDOW_MS, now).via, 'grant', 'grant satisfies gate');
  assert.ok(!requireStepUp({ auth_method: 'wallet', auth_time: now - 20 * 60_000, step_up_at: now - 20 * 60_000 }, STEP_UP_WINDOW_MS, now).ok, 'expired grant does not satisfy gate');
  assert.ok(!requireStepUp(null).ok, 'no session does not satisfy gate');
  assert.equal(STEP_UP_WINDOW_MS, 10 * 60_000, 'grant window is 10 minutes (design §5)');
  assert.equal(STEP_UP_CHALLENGE_TTL_MS, 2 * 60_000, 'step-up challenge TTL is tighter than the 5-min login challenge');
}

// mintStepUpGrantToken: writes step_up_at, preserves auth_time + exp
{
  const now = Date.now();
  const old = await signPayload(SECRET, {
    v: 1, wallet: WALLET, auth_method: 'wallet', auth_time: now - 20 * 60_000,
    iat: now - 20 * 60_000, exp: now + 30 * 24 * 36e5,
  });
  const claims = { raw: await verifyPayload(SECRET, old), auth_method: 'wallet', auth_time: now - 20 * 60_000, step_up_at: null, step_up_method: null };
  const grant = await mintStepUpGrantToken(SECRET, claims, 'wallet');
  const gp = await verifyPayload(SECRET, grant);
  assert.ok(Math.abs(gp.step_up_at - Date.now()) < 5000, 'grant writes step_up_at');
  assert.equal(gp.step_up_method, 'wallet');
  assert.equal(gp.auth_time, now - 20 * 60_000, 'grant preserves auth_time — rotation can never buy freshness');
  assert.equal(gp.iat, now - 20 * 60_000, 'grant preserves iat');
  assert.ok(requireStepUp({ auth_method: 'wallet', auth_time: gp.auth_time, step_up_at: gp.step_up_at }, STEP_UP_WINDOW_MS, Date.now()).ok, 'grant satisfies gate');
}

// stepUpRequiredBody contract
{
  const body = stepUpRequiredBody({ auth_method: 'wallet' });
  assert.equal(body.error, 'step_up_required');
  assert.deepEqual(body.step_up_methods, ['wallet']);
  assert.equal(body.expires, 120);
  assert.ok(typeof body.copy === 'string' && body.copy.length > 0, 'quiet-failure copy present');
}

// ================= DashaLobby step-up endpoints =================

function makeLobby(env) {
  const rows = new Map();
  const storage = {
    async get(key) { return rows.get(key); },
    async put(key, value) { rows.set(key, value); },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
    async getAlarm() { return Date.now(); }, async setAlarm() {},
  };
  let ready;
  const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
  return { lobby, ready, rows };
}

async function post(lobby, path, body, cookieToken, headers = originHeaders) {
  const h = { ...headers };
  if (cookieToken) h.Cookie = `${COOKIE}=${cookieToken}`;
  return lobby.fetch(new Request(`https://lobby.getdasha.com${path}`, {
    method: 'POST', headers: h, body: JSON.stringify(body),
  }));
}

const env = { LOBBY_SESSION_SECRET: SECRET, ALLOWED_ORIGINS: `${ORIGIN},https://lobby.getdasha.com` };
let { lobby, ready, rows } = makeLobby(env);
await ready;

const freshToken = await createWalletSessionToken({ LOBBY_SESSION_SECRET: SECRET }, WALLET);
const staleToken = await signPayload(SECRET, {
  v: 1, wallet: WALLET, auth_method: 'wallet', auth_time: Date.now() - 20 * 60_000,
  iat: Date.now() - 20 * 60_000, exp: Date.now() + 30 * 24 * 36e5,
});
const xToken = await signPayload(SECRET, {
  v: 1, xId: '123', handle: 'someone', iat: Date.now(), exp: Date.now() + 30 * 24 * 36e5,
});

// 1. challenge: no session -> 401
{
  const r = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'api-key-create' }, null);
  assert.equal(r.status, 401, 'challenge without session is 401');
}

// 2. challenge: non-wallet session -> 401
{
  const r = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'api-key-create' }, xToken);
  assert.equal(r.status, 401, 'challenge with X session is 401 (wallet path only)');
}

// 3. challenge: wallet session -> 200 with scope-bound, tight-TTL challenge
let first;
{
  const r = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'api-key-create' }, freshToken);
  assert.equal(r.status, 200, 'challenge 200');
  first = await r.json();
  assert.equal(first.scope, 'api-key-create');
  assert.ok(first.message.includes('"api-key-create"'), 'signed message names the scope');
  assert.ok(first.message.includes(WALLET), 'signed message names the wallet');
  assert.ok(Math.abs(first.expiresAt - (Date.now() + STEP_UP_CHALLENGE_TTL_MS)) < 5000, 'tight 2-min TTL');
  assert.equal(first.ttlSeconds, 120);
  const decoded = await verifyPayload(SECRET, first.challenge);
  assert.equal(decoded.kind, 'wallet_stepup', 'distinct challenge kind from login challenges');
  assert.equal(decoded.scope, 'api-key-create');
  assert.equal(decoded.publicKey, WALLET);
  assert.equal(decoded.origin, ORIGIN);
  const stored = rows.get('walletLogins');
  const key = Object.keys(stored).find((k) => k.startsWith('stepup:'));
  assert.ok(key, 'challenge tracked single-use');
  assert.equal(stored[key].attempts, 0);
}

// 4. challenge: invalid scope -> 400
{
  const r = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'wipe-everything' }, freshToken);
  assert.equal(r.status, 400, 'invalid scope rejected');
}

// 5. verify: signature for the wrong scope (cross-scope) -> 401
{
  const r = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'payout-wallet', challenge: first.challenge, signature: await walletSign(first.message),
  }, freshToken);
  assert.equal(r.status, 401, 'cross-scope verify rejected');
}

// 6. verify: 3 failed attempts invalidates the challenge; then success path
{
  const r = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'api-key-create', challenge: first.challenge, signature: await walletSign(first.message + 'tamper'),
  }, freshToken);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).attempts_left, 2);

  const r2 = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'api-key-create', challenge: first.challenge, signature: await walletSign(first.message + 'tamper'),
  }, freshToken);
  assert.equal(r2.status, 400);
  assert.equal((await r2.json()).attempts_left, 1);

  const r3 = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'api-key-create', challenge: first.challenge, signature: await walletSign(first.message + 'tamper'),
  }, freshToken);
  assert.equal(r3.status, 409, '3rd failure invalidates the challenge');
  assert.match(await r3.text(), /fresh step-up challenge/);

  // Even a now-correct signature fails: challenge is gone (single-use + invalidated).
  const r4 = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'api-key-create', challenge: first.challenge, signature: await walletSign(first.message),
  }, freshToken);
  assert.equal(r4.status, 409, 'invalidated challenge cannot be replayed');
}

// 7. verify: success mints a grant token; replay rejected
// Fresh lobby: new in-memory rate buckets (attempt-counting above used the per-wallet verify bucket).
let grantTokenValue;
{
  ({ lobby, ready, rows } = makeLobby(env));
  await ready;
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'payout-wallet' }, freshToken);
  assert.equal(rc.status, 200);
  const ch = await rc.json();
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'payout-wallet', challenge: ch.challenge, signature: await walletSign(ch.message),
  }, freshToken);
  assert.equal(rv.status, 200, 'valid re-sign succeeds');
  const vb = await rv.json();
  assert.equal(vb.ok, true);
  assert.equal(vb.scope, 'payout-wallet');
  assert.equal(vb.step_up, true);
  const setCookie = rv.headers.get('Set-Cookie');
  assert.ok(setCookie && setCookie.includes(COOKIE), 'grant re-issues the session cookie');
  grantTokenValue = decodeURIComponent(setCookie.split(`${COOKIE}=`)[1].split(';')[0]);
  assert.ok(grantTokenValue.length > 0, 'grant token extracted');
  const gp = await verifyPayload(SECRET, grantTokenValue);
  assert.ok(Math.abs(gp.step_up_at - Date.now()) < 5000, 'grant token carries step_up_at');
  assert.equal(gp.step_up_method, 'wallet');
  assert.ok(Math.abs(gp.auth_time - (await verifyPayload(SECRET, freshToken)).auth_time) < 1000, 'grant preserves auth_time');

  // Replay the consumed challenge -> 409.
  const replay = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'payout-wallet', challenge: ch.challenge, signature: await walletSign(ch.message),
  }, freshToken);
  assert.equal(replay.status, 409, 'consumed challenge is single-use');
}

// 8. verify: expired challenge -> 409
{
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'api-key-create' }, freshToken);
  const ch = await rc.json();
  const stored = rows.get('walletLogins');
  const key = Object.keys(stored).find((k) => k.startsWith('stepup:'));
  stored[key].exp = Date.now() - 1000; // simulate expiry
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'api-key-create', challenge: ch.challenge, signature: await walletSign(ch.message),
  }, freshToken);
  assert.equal(rv.status, 409, 'expired challenge rejected');
}

// 9. verify: challenge bound to a different wallet's session -> 401
{
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'api-key-create' }, freshToken);
  const ch = await rc.json();
  const otherToken = await createWalletSessionToken({ LOBBY_SESSION_SECRET: SECRET }, WALLET2);
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'api-key-create', challenge: ch.challenge, signature: await walletSign(ch.message),
  }, otherToken);
  assert.equal(rv.status, 401, 'challenge is bound to the wallet that requested it');
}

// 10. challenge 503 when the session secret is unset (config-gated, no dead button)
{
  const { lobby: noSecretLobby, ready: noSecretReady } = makeLobby({ ALLOWED_ORIGINS: `${ORIGIN},https://lobby.getdasha.com` });
  await noSecretReady;
  const r = await post(noSecretLobby, '/auth/wallet/stepup/challenge', { scope: 'api-key-create' }, freshToken);
  assert.equal(r.status, 503, 'unconfigured step-up is an honest 503');
}

// ================= ComputeNetwork gates =================

function makeNetwork() {
  const nrows = new Map();
  const storage = {
    async get(key) { return nrows.get(key); },
    async put(key, value) {
      if (typeof key === 'object') for (const [name, item] of Object.entries(key)) nrows.set(name, item);
      else nrows.set(key, value);
    },
    async delete(key) { nrows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...nrows].filter(([k]) => k.startsWith(prefix))); },
  };
  const network = new ComputeNetwork({ storage }, { LOBBY_SESSION_SECRET: SECRET });
  return { network, nrows };
}

function netReq(path, method, token, body) {
  const headers = { Origin: ORIGIN, 'Content-Type': 'application/json', Cookie: `${COOKIE}=${token}` };
  return new Request(`https://lobby.getdasha.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

const { network } = makeNetwork();

// 11. fresh login (<10m auth_time) satisfies the gate — no extra prompt
{
  const keys = await network.fetch(netReq('/compute/api/keys', 'POST', freshToken, { name: 'FreshKey' }), ORIGIN);
  assert.equal(keys.status, 201, 'fresh wallet login creates a key without step-up');
  const pref = await network.fetch(netReq('/compute/api/provider/payout-pref', 'POST', freshToken, { method: 'usdc', wallet: WALLET }), ORIGIN);
  assert.equal(pref.status, 200, 'fresh wallet login sets payout wallet without step-up');
}

// 12. stale session: gated endpoints refuse with the 403 contract
for (const [path, body] of [
  ['/compute/api/keys', { name: 'Blocked' }],
  ['/compute/api/provider/payout-pref', { method: 'usdc', wallet: WALLET }],
  ['/compute/api/provider/payout', { cents: 100 }],
]) {
  const r = await network.fetch(netReq(path, 'POST', staleToken, body), ORIGIN);
  assert.equal(r.status, 403, `${path} requires step-up for stale sessions`);
  const b = await r.json();
  assert.equal(b.error, 'step_up_required', `${path} returns the step-up contract`);
  assert.deepEqual(b.step_up_methods, ['wallet'], `${path} offers the wallet step-up method`);
}

// 13. reads stay ungated; key revocation stays one click (recovery)
{
  const listed = await network.fetch(netReq('/compute/api/keys', 'GET', staleToken), ORIGIN);
  assert.equal(listed.status, 200, 'key listing needs no step-up');
  const keys = (await listed.json()).keys;
  assert.ok(keys.length > 0, 'key from the fresh session is listed');
  const del = await network.fetch(netReq(`/compute/api/keys/${keys[0].id}`, 'DELETE', staleToken), ORIGIN);
  assert.equal(del.status, 200, 'key revocation stays one click — recovery must never be blocked');
}

// 14. the step-up grant cookie satisfies the gate
{
  const r = await network.fetch(netReq('/compute/api/keys', 'POST', grantTokenValue, { name: 'SteppedUp' }), ORIGIN);
  assert.equal(r.status, 201, 'grant cookie satisfies the key-create gate');
}

// 15. wallet method required for the wallet step-up path: stale X session gets its own methods
{
  const staleX = await signPayload(SECRET, {
    v: 1, xId: '123', handle: 'someone', auth_method: 'x', auth_time: Date.now() - 20 * 60_000,
    iat: Date.now() - 20 * 60_000, exp: Date.now() + 30 * 24 * 36e5,
  });
  const r = await network.fetch(netReq('/compute/api/keys', 'POST', staleX, { name: 'XBlocked' }), ORIGIN);
  assert.equal(r.status, 403);
  const b = await r.json();
  assert.deepEqual(b.step_up_methods, ['x'], 'per-method step-up menu follows auth_method');
}

console.log('step-up auth reference (wallet SIWS path): all assertions passed');
