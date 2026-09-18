#!/usr/bin/env node
/**
 * Step-up auth wired into the SIWS one-click `signIn` flow (task 18; builds on
 * PRs #287 + #292, design PR #291).
 *
 * The wallet-standard `signIn` input has no scope field, so the step-up scope
 * rides inside the server-generated statement; verify matches the parsed
 * statement byte-for-byte against the signed challenge (scope binding), on top
 * of the same guarantees as the legacy path: origin-bound, single-use nonce,
 * Ed25519 signature, 2-min challenge TTL, 3-failed-attempt invalidation.
 *
 * - walletStepUpStatement unit (scope named, bounded)
 * - /auth/wallet/stepup/challenge {mode:'signin'} + /verify round-trip with a
 *   real Ed25519 signature over a wallet-built standardized message:
 *   kind binding, origin binding, scope binding (statement tamper + cross-scope
 *   rejection), single-use replay, expiry, cross-wallet rejection,
 *   3-failure invalidation, 503 when unconfigured
 * - legacy signMessage step-up path still works (coexistence regression)
 * - end-to-end wiring: a SIWS one-click *login* (#287 flow) mints a session
 *   whose token carries auth_method/auth_time claims; the fresh login passes
 *   the sensitive-action gates without step-up, and the one-click step-up
 *   grant re-issues the cookie so a stale session can proceed
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
  STEP_UP_CHALLENGE_TTL_MS,
  STEP_UP_MAX_ATTEMPTS,
  createWalletSessionToken,
  signPayload,
  verifyPayload,
  sessionClaims,
  requireStepUp,
} from './dasha-lobby-x.mjs';
import { walletLoginMessage, walletStepUpStatement } from './dasha-simp-actions.mjs';

const { etc, getPublicKey, sign } = await import('@noble/ed25519');
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

/** Mirrors what a wallet-standard wallet builds from the signIn input. */
function siwsText({ domain, address, statement, uri, nonce, issuedAt, expirationTime }) {
  return `${domain} wants you to sign in with your Solana account:\n${address}\n\n${statement}\n\nURI: ${uri}\nVersion: 1\nChain ID: solana:mainnet\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;
}

const priv = new Uint8Array(32).fill(7);
const WALLET = base58Encode(getPublicKey(priv));
const priv2 = new Uint8Array(32).fill(42);
const WALLET2 = base58Encode(getPublicKey(priv2));

async function walletSign(message) {
  return base58Encode(await sign(new TextEncoder().encode(message), priv));
}

// ================= walletStepUpStatement =================
{
  const s = walletStepUpStatement('api-key-create');
  assert.ok(s.includes('"api-key-create"'), 'statement names the scope');
  assert.ok(s.length < 200, 'statement stays short for wallet display');
  const s2 = walletStepUpStatement('api-key-create');
  assert.equal(s, s2, 'statement is deterministic per scope (byte-matchable)');
  assert.notEqual(walletStepUpStatement('payout-wallet'), s, 'different scope, different statement');
}

// ================= lobby harness =================
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
const otherToken = await createWalletSessionToken({ LOBBY_SESSION_SECRET: SECRET }, WALLET2);

// 1. one-click step-up challenge: SIWS input shape, no server message
let ch;
{
  const r = await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'api-key-create' }, freshToken);
  assert.equal(r.status, 200, 'one-click step-up challenge 200');
  ch = await r.json();
  assert.equal(ch.mode, 'signin');
  assert.equal(ch.scope, 'api-key-create');
  assert.ok(!('message' in ch), 'one-click challenge carries no server message — the wallet builds it');
  assert.equal(ch.domain, 'www.getdasha.com');
  assert.equal(ch.uri, `${ORIGIN}/login`);
  assert.equal(ch.chainId, 'solana:mainnet');
  assert.equal(ch.version, '1');
  assert.ok(ch.statement.includes('"api-key-create"'), 'statement names the scope');
  assert.ok(Math.abs(ch.expiresAt - (Date.now() + STEP_UP_CHALLENGE_TTL_MS)) < 5000, 'tight 2-min TTL');
  assert.equal(ch.ttlSeconds, 120);
  const decoded = await verifyPayload(SECRET, ch.challenge);
  assert.equal(decoded.kind, 'wallet_stepup_signin', 'distinct challenge kind from legacy step-up');
  assert.equal(decoded.scope, 'api-key-create');
  assert.equal(decoded.statement, ch.statement, 'statement stored in the signed challenge');
  assert.equal(decoded.publicKey, WALLET);
  assert.equal(decoded.origin, ORIGIN);
  const stored = rows.get('walletLogins');
  const key = Object.keys(stored).find((k) => k.startsWith('stepup-signin:'));
  assert.ok(key, 'one-click challenge tracked single-use under its own namespace');
  assert.equal(stored[key].attempts, 0);
}

// 2. challenge: invalid scope -> 400 (one-click too)
{
  const r = await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'wipe-everything' }, freshToken);
  assert.equal(r.status, 400, 'invalid scope rejected in one-click mode');
}

// 3. challenge: non-wallet session -> 401
{
  const xToken = await signPayload(SECRET, {
    v: 1, xId: '123', handle: 'someone', iat: Date.now(), exp: Date.now() + 30 * 24 * 36e5,
  });
  const r = await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'api-key-create' }, xToken);
  assert.equal(r.status, 401, 'one-click step-up requires a wallet session');
}

function walletBuiltMessage(input, address) {
  const now = Date.now();
  return siwsText({
    domain: input.domain, address, statement: input.statement, uri: input.uri, nonce: input.nonce,
    issuedAt: new Date(now).toISOString(), expirationTime: new Date(now + 5 * 60_000).toISOString(),
  });
}

// 4. verify: success round-trip mints a grant; replay rejected
let grantTokenValue;
{
  const message = walletBuiltMessage(ch, WALLET);
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'api-key-create', challenge: ch.challenge,
    message, signature: await walletSign(message),
  }, freshToken);
  assert.equal(rv.status, 200, 'valid one-click re-sign succeeds');
  const vb = await rv.json();
  assert.equal(vb.ok, true);
  assert.equal(vb.scope, 'api-key-create');
  assert.equal(vb.step_up, true);
  const setCookie = rv.headers.get('Set-Cookie');
  assert.ok(setCookie && setCookie.includes(COOKIE), 'grant re-issues the session cookie');
  grantTokenValue = decodeURIComponent(setCookie.split(`${COOKIE}=`)[1].split(';')[0]);
  const gp = await verifyPayload(SECRET, grantTokenValue);
  assert.ok(Math.abs(gp.step_up_at - Date.now()) < 5000, 'grant token carries step_up_at');
  assert.equal(gp.step_up_method, 'wallet');
  assert.ok(requireStepUp({
    auth_method: 'wallet', auth_time: Date.now() - 20 * 60_000, step_up_at: gp.step_up_at,
  }).ok, 'one-click grant satisfies the gate');

  const replay = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'api-key-create', challenge: ch.challenge,
    message, signature: await walletSign(message),
  }, freshToken);
  assert.equal(replay.status, 409, 'consumed one-click challenge is single-use');
}

// 5. verify: cross-scope — challenge scope vs posted scope mismatch -> 401
{
  ({ lobby, ready, rows } = makeLobby(env));
  await ready;
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'api-key-create' }, freshToken);
  const c2 = await rc.json();
  const message = walletBuiltMessage(c2, WALLET);
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'payout-wallet', challenge: c2.challenge,
    message, signature: await walletSign(message),
  }, freshToken);
  assert.equal(rv.status, 401, 'cross-scope verify rejected');
}

// 6. verify: statement tamper — signed statement names another scope -> 401
//    (this is the scope binding: the wallet-standard input has no scope field,
//    so the exact statement is what stops a re-sign for action A being replayed
//    against action B)
{
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'api-key-create' }, freshToken);
  const c3 = await rc.json();
  const tampered = walletBuiltMessage({ ...c3, statement: walletStepUpStatement('payout-wallet') }, WALLET);
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'api-key-create', challenge: c3.challenge,
    message: tampered, signature: await walletSign(tampered),
  }, freshToken);
  assert.equal(rv.status, 401, 'statement tamper breaks the scope binding');
}

// 7. verify: legacy challenge kind presented to the one-click path -> 401
{
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'api-key-create' }, freshToken);
  const legacy = await rc.json();
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'api-key-create', challenge: legacy.challenge,
    message: walletBuiltMessage({ ...legacy, statement: legacy.statement || 'x' }, WALLET),
    signature: await walletSign('x'),
  }, freshToken);
  assert.equal(rv.status, 401, 'legacy challenge kind rejected on the one-click path');
}

// 8. verify: 3 failed attempts invalidates the one-click challenge
{
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'payout-request' }, freshToken);
  const c4 = await rc.json();
  const message = walletBuiltMessage(c4, WALLET);
  for (let i = 0; i < 2; i++) {
    const r = await post(lobby, '/auth/wallet/stepup/verify', {
      mode: 'signin', scope: 'payout-request', challenge: c4.challenge,
      message, signature: await walletSign(message + 'tamper'),
    }, freshToken);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).attempts_left, STEP_UP_MAX_ATTEMPTS - 1 - i, 'attempts count down');
  }
  const r3 = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'payout-request', challenge: c4.challenge,
    message, signature: await walletSign(message + 'tamper'),
  }, freshToken);
  assert.equal(r3.status, 409, '3rd failure invalidates the one-click challenge');
  assert.equal(STEP_UP_MAX_ATTEMPTS, 3, 'attempt cap unchanged');
}

// 9. verify: expired challenge -> 409
// Fresh lobby: earlier verify calls used up the per-wallet verify bucket.
{
  ({ lobby, ready, rows } = makeLobby(env));
  await ready;
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'api-key-create' }, freshToken);
  const c5 = await rc.json();
  const stored = rows.get('walletLogins');
  const key = Object.keys(stored).find((k) => k.startsWith('stepup-signin:'));
  stored[key].exp = Date.now() - 1000;
  const message = walletBuiltMessage(c5, WALLET);
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'api-key-create', challenge: c5.challenge,
    message, signature: await walletSign(message),
  }, freshToken);
  assert.equal(rv.status, 409, 'expired one-click challenge rejected');
}

// 10. verify: challenge bound to the session wallet — another wallet's session -> 401
{
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'api-key-create' }, freshToken);
  const c6 = await rc.json();
  const message = walletBuiltMessage(c6, WALLET);
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'api-key-create', challenge: c6.challenge,
    message, signature: await walletSign(message),
  }, otherToken);
  assert.equal(rv.status, 401, 'one-click challenge is bound to the wallet that requested it');
}

// 11. legacy signMessage step-up path coexists (regression)
{
  const rc = await post(lobby, '/auth/wallet/stepup/challenge', { scope: 'api-key-create' }, freshToken);
  const leg = await rc.json();
  assert.ok(leg.message && !leg.mode, 'legacy challenge still returns the server-composed message');
  const rv = await post(lobby, '/auth/wallet/stepup/verify', {
    scope: 'api-key-create', challenge: leg.challenge, signature: await walletSign(leg.message),
  }, freshToken);
  assert.equal(rv.status, 200, 'legacy step-up verify still succeeds');
}

// 12. 503 when the session secret is unset (config-gated, no dead button)
{
  const { lobby: noSecretLobby, ready: noSecretReady } = makeLobby({ ALLOWED_ORIGINS: `${ORIGIN},https://lobby.getdasha.com` });
  await noSecretReady;
  const r = await post(noSecretLobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'api-key-create' }, freshToken);
  assert.equal(r.status, 503, 'unconfigured one-click step-up is an honest 503');
}

// ================= end-to-end: SIWS one-click login -> gated action -> one-click step-up =================
{
  ({ lobby, ready, rows } = makeLobby(env));
  await ready;
  // One-click *login* (#287 flow): the wallet builds the standardized message.
  const lc = await (await post(lobby, '/auth/wallet/challenge', { mode: 'signin' })).json();
  assert.equal(lc.mode, 'signin', 'one-click login challenge');
  const loginMessage = siwsText({
    domain: lc.domain, address: WALLET, statement: lc.statement, uri: lc.uri, nonce: lc.nonce,
    issuedAt: new Date(Date.now()).toISOString(), expirationTime: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  const lv = await post(lobby, '/auth/wallet/verify', {
    mode: 'signin', challenge: lc.challenge, message: loginMessage, signature: await walletSign(loginMessage),
  });
  assert.equal(lv.status, 200, 'one-click SIWS login succeeds');
  const loginCookie = lv.headers.get('Set-Cookie');
  const loginToken = decodeURIComponent(loginCookie.split(`${COOKIE}=`)[1].split(';')[0]);
  const loginPayload = await verifyPayload(SECRET, loginToken);
  assert.equal(loginPayload.auth_method, 'wallet', 'one-click login token carries auth_method');
  assert.ok(Math.abs(loginPayload.auth_time - Date.now()) < 5000, 'one-click login token carries auth_time');

  const nrows = new Map();
  const nstorage = {
    async get(key) { return nrows.get(key); },
    async put(key, value) {
      if (typeof key === 'object') for (const [name, item] of Object.entries(key)) nrows.set(name, item);
      else nrows.set(key, value);
    },
    async delete(key) { nrows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...nrows].filter(([k]) => k.startsWith(prefix))); },
  };
  const network = new ComputeNetwork({ storage: nstorage }, { LOBBY_SESSION_SECRET: SECRET });
  const netReq = (path, method, token, body) => new Request(`https://lobby.getdasha.com${path}`, {
    method,
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Cookie: `${COOKIE}=${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Fresh one-click login (<10m auth_time) passes the gate with no extra prompt.
  const freshKey = await network.fetch(netReq('/compute/api/keys', 'POST', loginToken, { name: 'OneClickFresh' }), ORIGIN);
  assert.equal(freshKey.status, 201, 'fresh one-click login creates a key without step-up');

  // A stale session is gated…
  const blocked = await network.fetch(netReq('/compute/api/keys', 'POST', staleToken, { name: 'Blocked' }), ORIGIN);
  assert.equal(blocked.status, 403, 'stale session needs step-up');
  assert.equal((await blocked.json()).error, 'step_up_required');

  // …and a one-click step-up grant re-issues the cookie so it proceeds.
  const sc = await (await post(lobby, '/auth/wallet/stepup/challenge', { mode: 'signin', scope: 'api-key-create' }, staleToken)).json();
  const sm = walletBuiltMessage(sc, WALLET);
  const sv = await post(lobby, '/auth/wallet/stepup/verify', {
    mode: 'signin', scope: 'api-key-create', challenge: sc.challenge,
    message: sm, signature: await walletSign(sm),
  }, staleToken);
  assert.equal(sv.status, 200, 'one-click step-up on a stale session succeeds');
  const steppedToken = decodeURIComponent(sv.headers.get('Set-Cookie').split(`${COOKIE}=`)[1].split(';')[0]);
  const steppedKey = await network.fetch(netReq('/compute/api/keys', 'POST', steppedToken, { name: 'SteppedUp' }), ORIGIN);
  assert.equal(steppedKey.status, 201, 'one-click step-up grant satisfies the key-create gate');

  // The grant preserves the original auth_time — freshness comes only from step_up_at.
  const gp = await verifyPayload(SECRET, steppedToken);
  const sp = await verifyPayload(SECRET, staleToken);
  assert.equal(gp.auth_time, sp.auth_time, 'grant preserves auth_time — rotation can never buy freshness');
}

console.log('step-up auth wired into SIWS one-click signIn: all assertions passed');
