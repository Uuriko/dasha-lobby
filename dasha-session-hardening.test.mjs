#!/usr/bin/env node
/**
 * Session hardening (tasks 16 + 17):
 *  - auth_method / auth_time / sid claims on every session token creator
 *  - legacy (pre-claim) tokens keep parsing, with claim backfill
 *  - server-side session revocation (sid) + rotation preserving auth_time
 *  - rotation wired on login mint points, logouts, privilege-sensitive
 *    compute endpoints, and account deletion; no fingerprinting in tokens
 * Test-only. No wrangler. No Designer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.WebSocketRequestResponsePair ||= class {};

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const computeSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');

const {
  createSessionToken,
  createWalletSessionToken,
  createEmailSessionToken,
  createGrokSessionToken,
  authSessionFromRequest,
  sessionFromRequest,
  sessionIdentityKey,
  revokeSessionSid,
  isSessionSidRevoked,
  reissueSessionToken,
  rotateSessionForRequest,
  verifyPayload,
  signPayload,
  COOKIE,
} = await import('./dasha-lobby-x.mjs');
const {
  createGoogleSessionToken,
  reissueGoogleSessionToken,
  googleSessionFromRequest,
} = await import('./dasha-lobby-google.mjs');
const { createGithubSessionToken, githubSessionFromRequest, GH_COOKIE } = await import('./dasha-lobby-github.mjs');
const { DashaLobby } = await import('./dasha-lobby-worker.mjs');

const SECRET = 'test-session-hardening-secret-please-ignore';
const env = { LOBBY_SESSION_SECRET: SECRET, ALLOWED_ORIGINS: 'https://www.getdasha.com' };
const WALLET = 'A'.repeat(44); // valid base58, 44 chars

function fakeStorage() {
  const rows = new Map();
  return {
    rows,
    async get(k) { return rows.get(k); },
    async put(k, v) { rows.set(k, v); },
    async delete(k) { rows.delete(k); },
    async getAlarm() { return Date.now(); },
    async setAlarm() {},
  };
}
const cookieReq = (token, name = COOKIE) =>
  new Request('https://lobby.getdasha.com/auth/status', { headers: { Cookie: `${name}=${token}` } });
async function payloadOf(token) {
  return verifyPayload(SECRET, token);
}

// ---------- 1. claims on every creator ----------
{
  const before = Date.now();
  const x = await createSessionToken(env, { xId: '123', handle: 'TestUser' });
  const w = await createWalletSessionToken(env, WALLET);
  const e = await createEmailSessionToken(env, 'User@Example.com');
  const g = await createGrokSessionToken(env, 'Tester');
  const oo = await createGoogleSessionToken(env, { googleSub: '123456789' });
  const gh = await createGithubSessionToken(env, { ghId: '42', login: 'octocat' });
  const after = Date.now();
  const px = await payloadOf(x);
  assert.equal(px.auth_method, 'x', 'x auth_method');
  assert.equal((await payloadOf(w)).auth_method, 'wallet', 'wallet auth_method');
  assert.equal((await payloadOf(e)).auth_method, 'email', 'email auth_method');
  assert.equal((await payloadOf(g)).auth_method, 'grok', 'grok auth_method');
  assert.equal((await payloadOf(oo)).auth_method, 'google', 'google auth_method');
  assert.equal((await payloadOf(gh)).auth_method, 'github', 'github auth_method');
  for (const [label, token] of [['x', x], ['wallet', w], ['email', e], ['grok', g], ['google', oo], ['github', gh]]) {
    const p = await payloadOf(token);
    assert.ok(Number.isFinite(p.auth_time) && p.auth_time >= before && p.auth_time <= after, `${label} auth_time ~= mint`);
    assert.equal(typeof p.sid, 'string', `${label} sid present`);
    assert.ok(p.sid.length >= 8, `${label} sid entropy`);
    assert.ok(p.exp > p.iat, `${label} exp > iat`);
  }
  const sids = new Set([px.sid, (await payloadOf(w)).sid, (await payloadOf(e)).sid]);
  assert.equal(sids.size, 3, 'sids unique per mint');
  console.log('ok 1 - auth_method/auth_time/sid claims on all six creators');
}

// ---------- 2. no fingerprinting in tokens ----------
{
  const tokens = [
    await createSessionToken(env, { xId: '1', handle: 'a' }),
    await createWalletSessionToken(env, WALLET),
    await createEmailSessionToken(env, 'a@b.co'),
    await createGoogleSessionToken(env, { googleSub: '9' }),
  ];
  for (const token of tokens) {
    const p = await payloadOf(token);
    for (const key of Object.keys(p)) {
      assert.doesNotMatch(key, /ip|user.?agent|fingerprint|device|geo/i, `no fingerprint field: ${key}`);
    }
  }
  console.log('ok 2 - no fingerprinting fields in session tokens');
}

// ---------- 3. readers surface claims; legacy tokens backfill ----------
{
  const e = await createEmailSessionToken(env, 'user@example.com');
  const s = await authSessionFromRequest(env, cookieReq(e));
  assert.equal(s.authMethod, 'email');
  assert.ok(Number.isFinite(s.authTime));
  assert.equal(typeof s.sid, 'string');

  // legacy token: no claims at all
  const legacy = await signPayload(SECRET, {
    v: 1, provider: 'email', email: 'legacy@example.com', iat: 1700000000000, exp: Date.now() + 100000,
  });
  const ls = await authSessionFromRequest(env, cookieReq(legacy));
  assert.ok(ls, 'legacy token still parses');
  assert.equal(ls.authMethod, 'email', 'authMethod backfilled from provider');
  assert.equal(ls.authTime, 1700000000000, 'authTime backfilled from iat');
  assert.equal(ls.sid, null, 'legacy sid null');

  const legacyX = await signPayload(SECRET, {
    v: 1, xId: '77', handle: 'legacyx', iat: 1700000000001, exp: Date.now() + 100000,
  });
  const lxs = await sessionFromRequest(env, cookieReq(legacyX));
  assert.ok(lxs && lxs.handle === 'legacyx', 'legacy x session parses');

  const gs = await googleSessionFromRequest(env, cookieReq(await createGoogleSessionToken(env, { googleSub: '4242' })));
  assert.equal(gs.authMethod, 'google');
  assert.ok(Number.isFinite(gs.authTime));
  assert.equal(typeof gs.sid, 'string');
  const ghs = await githubSessionFromRequest(env, cookieReq(await createGithubSessionToken(env, { ghId: '7', login: 'octo' }), GH_COOKIE));
  assert.equal(ghs.authMethod, 'github');
  assert.ok(Number.isFinite(ghs.authTime));
  console.log('ok 3 - readers surface claims; legacy tokens backfill');
}

// ---------- 4. revocation primitives ----------
{
  const storage = fakeStorage();
  assert.equal(await isSessionSidRevoked(storage, 'nope'), false, 'unknown sid not revoked');
  await revokeSessionSid(storage, 'sid-1');
  assert.equal(await isSessionSidRevoked(storage, 'sid-1'), true, 'revoked sid rejected');
  assert.equal(await isSessionSidRevoked(storage, 'sid-2'), false, 'other sid fine');
  await revokeSessionSid(null, 'x');
  assert.equal(await isSessionSidRevoked(null, 'x'), false, 'null storage safe');
  console.log('ok 4 - revoke/isRevoked round-trip');
}

// ---------- 5. checked readers reject revoked sids ----------
{
  const storage = fakeStorage();
  const token = await createWalletSessionToken(env, WALLET);
  const s1 = await authSessionFromRequest(env, cookieReq(token), storage);
  assert.ok(s1 && s1.sid, 'valid before revoke');
  await revokeSessionSid(storage, s1.sid);
  assert.equal(await authSessionFromRequest(env, cookieReq(token), storage), null, 'revoked -> null (auth)');
  const xtoken = await createSessionToken(env, { xId: '5', handle: 'xuser' });
  const xs = await authSessionFromRequest(env, cookieReq(xtoken), storage);
  await revokeSessionSid(storage, xs.sid);
  assert.equal(await sessionFromRequest(env, cookieReq(xtoken), storage), null, 'revoked -> null (x-only)');
  // unchecked read still HMAC-verifies (worker-isolate behavior)
  assert.ok(await authSessionFromRequest(env, cookieReq(token)), 'unchecked read unaffected');
  console.log('ok 5 - revoked sids rejected by checked readers only');
}

// ---------- 6. reissue preserves identity + auth_time, rotates sid ----------
{
  const storage = fakeStorage();
  const orig = await createEmailSessionToken(env, 'rotate@example.com');
  const session = await authSessionFromRequest(env, cookieReq(orig), storage);
  const before = Date.now();
  const fresh = await reissueSessionToken(env, session);
  const fp = await payloadOf(fresh);
  const op = await payloadOf(orig);
  assert.equal(fp.email, 'rotate@example.com', 'identity preserved');
  assert.equal(fp.auth_method, 'email', 'auth_method preserved');
  assert.equal(fp.auth_time, op.auth_time, 'auth_time NOT refreshed on rotation');
  assert.ok(fp.auth_time < before, 'auth_time predates rotation');
  assert.notEqual(fp.sid, op.sid, 'sid rotated');
  assert.ok(fp.iat >= before && fp.exp > fp.iat, 'fresh iat/exp');
  // google reissue
  const g = await createGoogleSessionToken(env, { googleSub: '999', email: 'g@x.co' });
  const gs = await googleSessionFromRequest(env, cookieReq(g));
  const gf = await reissueGoogleSessionToken(env, gs);
  const gfp = await payloadOf(gf);
  assert.equal(gfp.googleSub, '999');
  assert.equal(gfp.auth_time, (await payloadOf(g)).auth_time, 'google auth_time preserved');
  assert.notEqual(gfp.sid, (await payloadOf(g)).sid, 'google sid rotated');
  console.log('ok 6 - reissue preserves auth_time/identity, rotates sid');
}

// ---------- 7. rotateSessionForRequest: revoke old + mint new ----------
{
  const storage = fakeStorage();
  const old = await createGrokSessionToken(env, 'RotateMe');
  const oldSession = await authSessionFromRequest(env, cookieReq(old), storage);
  const { token, session, rotated } = await rotateSessionForRequest(env, storage, cookieReq(old));
  assert.equal(rotated, true);
  assert.ok(token && session, 'token+session returned');
  assert.equal(await isSessionSidRevoked(storage, oldSession.sid), true, 'old sid revoked server-side');
  const fresh = await authSessionFromRequest(env, cookieReq(token), storage);
  assert.ok(fresh, 'new token valid');
  assert.equal(fresh.authMethod, 'grok');
  assert.equal(fresh.authTime, oldSession.authTime, 'auth_time carried forward');
  assert.notEqual(fresh.sid, oldSession.sid);
  const none = await rotateSessionForRequest(env, storage, new Request('https://lobby.getdasha.com/'));
  assert.equal(none.rotated, false, 'no session -> no rotation');
  console.log('ok 7 - rotateSessionForRequest revokes old, mints new');
}

// ---------- 8. sessionIdentityKey ----------
{
  assert.equal(sessionIdentityKey({ provider: 'x', xId: '1' }), 'x:1');
  assert.equal(sessionIdentityKey({ provider: 'google', googleSub: '2' }), 'google:2');
  assert.equal(sessionIdentityKey({ provider: 'wallet', wallet: WALLET }), `wallet:${WALLET}`);
  assert.equal(sessionIdentityKey({ provider: 'email', email: 'a@b.co' }), 'email:a@b.co');
  assert.equal(sessionIdentityKey({ provider: 'grok', displayName: 'T' }), 'grok:T');
  assert.equal(sessionIdentityKey({ provider: 'github', ghId: '9' }), 'github:9');
  assert.equal(sessionIdentityKey(null), null);
  console.log('ok 8 - sessionIdentityKey per method');
}

// ---------- 9. DO integration: internal revoke endpoint + checked reads ----------
{
  const rows = new Map();
  const storage = {
    async get(k) { return rows.get(k); },
    async put(k, v) { rows.set(k, v); },
    async delete(k) { rows.delete(k); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
    async getAlarm() { return Date.now(); },
    async setAlarm() {},
  };
  let ready;
  const lobby = new DashaLobby(
    { storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } },
    env,
  );
  await ready;

  const token = await createEmailSessionToken(env, 'do@example.com');
  const session = await authSessionFromRequest(env, cookieReq(token), storage);
  assert.ok(session, 'session valid pre-revoke');

  const revokeCall = (secret) =>
    lobby.fetch(new Request('https://lobby.getdasha.com/internal/session/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-dasha-internal': secret } : {}) },
      body: JSON.stringify({ sid: session.sid }),
    }));
  const denied = await revokeCall(null);
  assert.equal(denied.status, 401, 'internal endpoint requires the session secret');
  const wrong = await revokeCall('wrong-secret');
  assert.equal(wrong.status, 401, 'wrong secret rejected');
  const okRes = await revokeCall(SECRET);
  assert.equal(okRes.status, 200);
  assert.deepEqual(await okRes.json(), { ok: true });
  assert.equal(await authSessionFromRequest(env, cookieReq(token), storage), null, 'DO revoked sid rejected');
  console.log('ok 9 - internal revoke endpoint secret-gated, enforced on DO reads');
}

// ---------- 10. email login rotation: verify revokes the pre-login sid ----------
{
  const realFetch = globalThis.fetch;
  const resendCalls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.resend.com/')) {
      resendCalls.push({ url: String(url), init });
      return new Response(JSON.stringify({ id: 'mail_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, init);
  };
  try {
    const rows = new Map();
    const storage = {
      async get(k) { return rows.get(k); },
      async put(k, v) { rows.set(k, v); },
      async delete(k) { rows.delete(k); },
      async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
      async getAlarm() { return Date.now(); },
      async setAlarm() {},
    };
    let ready;
    const lobby = new DashaLobby(
      { storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } },
      { ...env, RESEND_API_KEY: 'test-resend-key' },
    );
    await ready;
    const originHeaders = { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
    // first login -> session A
    await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
      method: 'POST', headers: originHeaders, body: JSON.stringify({ email: 'rot@example.com' }),
    }));
    const codeA = JSON.parse(resendCalls[0].init.body).text.match(/\b(\d{6})\b/)[1];
    const verifyA = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/verify', {
      method: 'POST', headers: originHeaders, body: JSON.stringify({ email: 'rot@example.com', code: codeA }),
    }));
    assert.equal(verifyA.status, 200);
    const cookieA = verifyA.headers.get('set-cookie').split(';')[0];
    const sessionA = await authSessionFromRequest(env, cookieReq(cookieA.split('=')[1]), storage);
    assert.ok(sessionA.sid, 'session A has sid');
    // second login (same browser, old cookie presented) -> session B, A revoked
    await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
      method: 'POST', headers: originHeaders, body: JSON.stringify({ email: 'rot@example.com' }),
    }));
    const codeB = JSON.parse(resendCalls[1].init.body).text.match(/\b(\d{6})\b/)[1];
    const verifyB = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/verify', {
      method: 'POST',
      headers: { ...originHeaders, Cookie: cookieA },
      body: JSON.stringify({ email: 'rot@example.com', code: codeB }),
    }));
    assert.equal(verifyB.status, 200);
    assert.equal(await isSessionSidRevoked(storage, sessionA.sid), true, 'pre-login sid revoked on re-login');
    assert.equal(
      await authSessionFromRequest(env, cookieReq(cookieA.split('=')[1]), storage),
      null,
      'old token dead on checked reads',
    );
    const cookieB = verifyB.headers.get('set-cookie').split(';')[0];
    const sessionB = await authSessionFromRequest(env, cookieReq(cookieB.split('=')[1]), storage);
    assert.ok(sessionB && sessionB.sid !== sessionA.sid, 'new session live with fresh sid');
    console.log('ok 10 - email re-login revokes the pre-login session server-side');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ---------- 11. wiring assertions (repo style: source must call the rotation paths) ----------
{
  const must = (src, re, label) => assert.match(src, re, label);
  // internal endpoint mounted + secret-gated in the DO
  must(workerSrc, /\/internal\/session\/revoke/, 'internal revoke endpoint mounted');
  must(workerSrc, /x-dasha-internal/, 'internal endpoint uses x-dasha-internal gate');
  // worker-isolate rotation points
  must(workerSrc, /revokeSessionViaLobbyDO\(env, await currentSessionSid\(env, request\)\)/, 'oauth callbacks + logouts revoke via DO');
  must(workerSrc, /await revokePreviousSessionSid\(this, request\)/, 'DO mint points revoke previous sid');
  // privilege-sensitive compute endpoints rotate
  for (const label of ['key:create', 'API key not found', 'payout-pref', 'provider:payout']) {
    assert.ok(computeSrc.includes(label), `compute endpoint present: ${label}`);
  }
  const rotations = (computeSrc.match(/await rotateComputeSession\(this\.env, this\.state\.storage, request\)/g) || []).length;
  assert.equal(rotations, 4, 'four privilege-sensitive endpoints rotate (key create/delete, payout-pref, payout)');
  // DO session reads enforce revocation
  must(workerSrc, /sessionFromRequest\(this\.env, request, this\.state\.storage\)/, 'DO x-reads pass storage');
  must(computeSrc, /authSessionFromRequest\(this\.env, request, this\.state\.storage\)/, 'compute reads pass storage');
  // worker-isolate read-only paths stay HMAC-only (no storage arg)
  must(workerSrc, /const link = await sessionFromRequest\(env, request\);/, 'oauth/x/status stays HMAC-only');
  console.log('ok 11 - rotation wired at all specified points');
}

console.log('\ndasha-session-hardening: PASS (claims, revocation, rotation, wiring)');
