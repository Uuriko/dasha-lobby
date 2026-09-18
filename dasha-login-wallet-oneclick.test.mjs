#!/usr/bin/env node
/**
 * Wallet SIWS one-click polish.
 *
 * - parseSiwsMessage / validateSiwsSignin units (shape per phantom/sign-in-with-solana)
 * - /auth/wallet/challenge {mode:'signin'} + /verify round-trip with a real
 *   Ed25519 signature: origin-bound, single-use nonce, expiry, replay, tamper
 * - legacy connect+signMessage path unchanged (regression)
 * - challenge 503 when LOBBY_SESSION_SECRET is unset (unconfigured -> honest 503,
 *   consistent with the config-gating rule: no dead button)
 * - client source: one-click signIn preferred, quiet copy, rememberWallet,
 *   mobile deep link kept; baked X_CONNECT_JS / LOGIN_PAGE_HTML byte-parity;
 *   served /login pins the real x-connect SRI (no __X_CONNECT_SRI__ placeholder)
 *
 * Disk only. No wrangler. No deploys. No external sends.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
globalThis.WebSocketRequestResponsePair ||= class {};
import workerDefault, { DashaLobby } from './dasha-lobby-worker.mjs';
import { parseSiwsMessage, validateSiwsSignin, walletLoginMessage } from './dasha-simp-actions.mjs';
import { etc, getPublicKey, sign } from '@noble/ed25519';
import { LOGIN_PAGE_HTML, X_CONNECT_JS, X_CONNECT_SRI } from './dasha-lobby-static-gen.mjs';

etc.sha512Sync = (...msgs) => createHash('sha512').update(Buffer.concat(msgs.map((m) => Buffer.from(m)))).digest();

const root = dirname(fileURLToPath(import.meta.url));
const SECRET = '<redacted>';
const ORIGINS = 'https://www.getdasha.com,https://lobby.getdasha.com';
const originHeaders = { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };

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

async function post(lobby, path, body, headers = originHeaders) {
  return lobby.fetch(new Request(`https://lobby.getdasha.com${path}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  }));
}

// ---------- parser / validator units ----------
{
  const good = {
    domain: 'www.getdasha.com',
    address: 'Dasha1111111111111111111111111111111111111111'.slice(0, 44),
    statement: 'Log in to Dasha.',
    uri: 'https://www.getdasha.com/login',
    nonce: 'abcdef0123456789',
    issuedAt: '2026-09-17T23:00:00.000Z',
    expirationTime: '2026-09-17T23:05:00.000Z',
  };
  const text = siwsText(good);
  const p = parseSiwsMessage(text);
  assert.equal(p.domain, good.domain, 'domain parsed');
  assert.equal(p.address, good.address, 'address parsed');
  assert.equal(p.uri, good.uri, 'uri parsed');
  assert.equal(p.chainId, 'solana:mainnet', 'chain id parsed');
  assert.equal(p.nonce, good.nonce, 'nonce parsed');
  assert.equal(p.statement, good.statement, 'statement parsed');
  const now = Date.parse('2026-09-17T23:01:00.000Z');
  assert.equal(validateSiwsSignin(p, { domain: good.domain, uri: good.uri, nonce: good.nonce, now }), p, 'valid passes');

  assert.throws(() => validateSiwsSignin(p, { domain: 'evil.com', uri: good.uri, nonce: good.nonce, now }), /domain mismatch/, 'domain bound');
  assert.throws(() => validateSiwsSignin(p, { domain: good.domain, uri: 'https://evil.com/login', nonce: good.nonce, now }), /uri mismatch/, 'uri bound');
  assert.throws(() => validateSiwsSignin(p, { domain: good.domain, uri: good.uri, nonce: 'nope', now }), /nonce mismatch/, 'nonce bound');
  assert.throws(() => validateSiwsSignin(parseSiwsMessage(siwsText({ ...good, domain: 'evil.com' })), { domain: good.domain, uri: good.uri, nonce: good.nonce, now }), /domain mismatch/, 'tampered domain in signed bytes');
  const badChain = parseSiwsMessage(text.replace('Chain ID: solana:mainnet', 'Chain ID: mainnet'));
  assert.throws(() => validateSiwsSignin(badChain, { domain: good.domain, uri: good.uri, nonce: good.nonce, now }), /chain mismatch/, 'chain id strict');
  assert.throws(() => validateSiwsSignin(p, { domain: good.domain, uri: good.uri, nonce: good.nonce, now: Date.parse('2026-09-17T23:06:00.000Z') }), /expired/, 'expiry enforced');
  assert.throws(() => validateSiwsSignin(p, { domain: good.domain, uri: good.uri, nonce: good.nonce, now: Date.parse('2026-09-17T22:00:00.000Z') }), /future/, 'future issuedAt rejected');
  assert.throws(() => parseSiwsMessage('hello world'), /invalid sign-in message/, 'garbage rejected');
  assert.throws(() => parseSiwsMessage('www.getdasha.com wants you to sign in with your Solana account:\nnot-an-address'), /invalid sign-in message/, 'bad address rejected');
  assert.throws(() => parseSiwsMessage('x'.repeat(5000)), /invalid sign-in message/, 'oversize rejected');
}

// ---------- signin-mode challenge + verify round-trip ----------
const priv = new Uint8Array(32).fill(7);
const addr = base58Encode(getPublicKey(priv));

async function signinChallenge(env = { LOBBY_SESSION_SECRET: SECRET, ALLOWED_ORIGINS: ORIGINS }) {
  const { lobby, ready } = makeLobby(env);
  await ready;
  return { lobby, challenge: await (await post(lobby, '/auth/wallet/challenge', { mode: 'signin' })).json() };
}

{
  const { lobby } = await signinChallenge();
  const chRes = await post(lobby, '/auth/wallet/challenge', { mode: 'signin' });
  assert.equal(chRes.status, 200, 'signin challenge 200');
  const ch = await chRes.json();
  assert.equal(ch.mode, 'signin');
  assert.match(ch.nonce, /^[0-9a-f]{32}$/, 'nonce shape');
  assert.equal(ch.domain, 'www.getdasha.com', 'domain is the request origin host');
  assert.equal(ch.uri, 'https://www.getdasha.com/login', 'uri is origin-bound');
  assert.equal(ch.chainId, 'solana:mainnet');
  assert.ok(ch.challenge && ch.expiresAt > Date.now(), 'signed challenge + expiry');

  const message = siwsText({
    domain: ch.domain, address: addr, statement: ch.statement, uri: ch.uri,
    nonce: ch.nonce, issuedAt: new Date().toISOString(), expirationTime: new Date(ch.expiresAt).toISOString(),
  });
  const signature = base58Encode(await sign(new TextEncoder().encode(message), priv));
  const vRes = await post(lobby, '/auth/wallet/verify', { mode: 'signin', challenge: ch.challenge, message, signature });
  assert.equal(vRes.status, 200, 'signin verify 200');
  assert.deepEqual(await vRes.json(), { ok: true, provider: 'wallet' });
  const setCookie = vRes.headers.get('set-cookie') || '';
  assert.match(setCookie, /HttpOnly/, 'session cookie set');
  assert.match(setCookie, /Path=\//, 'cookie path');

  const replay = await post(lobby, '/auth/wallet/verify', { mode: 'signin', challenge: ch.challenge, message, signature });
  assert.equal(replay.status, 409, 'nonce is single-use');
  assert.match((await replay.json()).error || '', /already used/, 'replay copy');
}

// wrong-origin verify: challenge bound to www, verified from lobby host
{
  const { lobby, challenge: ch0 } = await signinChallenge();
  const chRes = await post(lobby, '/auth/wallet/challenge', { mode: 'signin' });
  const ch = await chRes.json();
  const message = siwsText({
    domain: ch.domain, address: addr, statement: ch.statement, uri: ch.uri,
    nonce: ch.nonce, issuedAt: new Date().toISOString(), expirationTime: new Date(ch.expiresAt).toISOString(),
  });
  const signature = base58Encode(await sign(new TextEncoder().encode(message), priv));
  assert.ok(ch0, 'setup ok');
  const cross = await post(lobby, '/auth/wallet/verify', { mode: 'signin', challenge: ch.challenge, message, signature },
    { Origin: 'https://lobby.getdasha.com', 'Content-Type': 'application/json' });
  assert.equal(cross.status, 401, 'challenge is origin-bound');
}

// tampered domain inside the signed message -> 400 (re-signed so the signature itself is valid)
{
  const { lobby } = await signinChallenge();
  const ch = await (await post(lobby, '/auth/wallet/challenge', { mode: 'signin' })).json();
  const message = siwsText({
    domain: 'evil.example', address: addr, statement: ch.statement, uri: ch.uri,
    nonce: ch.nonce, issuedAt: new Date().toISOString(), expirationTime: new Date(ch.expiresAt).toISOString(),
  });
  const signature = base58Encode(await sign(new TextEncoder().encode(message), priv));
  const res = await post(lobby, '/auth/wallet/verify', { mode: 'signin', challenge: ch.challenge, message, signature });
  assert.equal(res.status, 400, 'tampered domain rejected');
}

// corrupted signature -> 400
{
  const { lobby } = await signinChallenge();
  const ch = await (await post(lobby, '/auth/wallet/challenge', { mode: 'signin' })).json();
  const message = siwsText({
    domain: ch.domain, address: addr, statement: ch.statement, uri: ch.uri,
    nonce: ch.nonce, issuedAt: new Date().toISOString(), expirationTime: new Date(ch.expiresAt).toISOString(),
  });
  const bad = base58Encode(await sign(new TextEncoder().encode(message + 'tamper'), priv));
  const res = await post(lobby, '/auth/wallet/verify', { mode: 'signin', challenge: ch.challenge, message, signature: bad });
  assert.equal(res.status, 400, 'bad signature rejected');
}

// ---------- legacy connect+signMessage path unchanged ----------
{
  const { lobby, ready } = makeLobby({ LOBBY_SESSION_SECRET: SECRET, ALLOWED_ORIGINS: ORIGINS });
  await ready;
  const chRes = await post(lobby, '/auth/wallet/challenge', { publicKey: addr });
  assert.equal(chRes.status, 200, 'legacy challenge 200');
  const ch = await chRes.json();
  assert.ok(ch.message && ch.message.includes(addr), 'legacy message binds address');
  const signature = base58Encode(await sign(new TextEncoder().encode(ch.message), priv));
  const vRes = await post(lobby, '/auth/wallet/verify', { publicKey: addr, challenge: ch.challenge, signature });
  assert.equal(vRes.status, 200, 'legacy verify 200');
  assert.deepEqual(await vRes.json(), { ok: true, provider: 'wallet' });
  const replay = await post(lobby, '/auth/wallet/verify', { publicKey: addr, challenge: ch.challenge, signature });
  assert.equal(replay.status, 409, 'legacy nonce single-use');
  // legacy challenge still requires a valid address
  const bad = await post(lobby, '/auth/wallet/challenge', { publicKey: 'nope' });
  assert.equal(bad.status, 400, 'legacy challenge still validates address');
}

// ---------- unconfigured -> honest 503, not a dead button ----------
{
  const { lobby, ready } = makeLobby({ ALLOWED_ORIGINS: ORIGINS });
  await ready;
  const r1 = await post(lobby, '/auth/wallet/challenge', { mode: 'signin' });
  assert.equal(r1.status, 503, 'signin challenge 503 without secret');
  const r2 = await post(lobby, '/auth/wallet/challenge', { publicKey: addr });
  assert.equal(r2.status, 503, 'legacy challenge 503 without secret');
}

// ---------- client source + baked parity + served SRI ----------
{
  const clientSrc = readFileSync(join(root, 'dasha-x-connect-prompt.js'), 'utf8');
  const loginSrc = readFileSync(join(root, 'dasha-login-page.html'), 'utf8');
  assert.match(clientSrc, /\.signIn\(\{/, 'one-click signIn path');
  assert.match(clientSrc, /mode: 'signin'/, 'signin mode wired');
  assert.match(clientSrc, /Sign-in cancelled\./, 'quiet rejection copy');
  assert.match(clientSrc, /No Solana wallet found/, 'quiet not-installed copy');
  assert.match(clientSrc, /Get Phantom/, 'not-installed recovery action');
  assert.match(clientSrc, /phantom\.app\/ul\/browse/, 'mobile deep link kept');
  assert.match(clientSrc, /localStorage\.setItem\('dasha_last_provider', 'wallet'\)/, 'wallet remembered for the provider hint');
  assert.match(clientSrc, /Check your wallet/, 'single quiet in-flight line');
  assert.doesNotMatch(clientSrc, /Connect, then sign the login message/, 'two-step noise removed');
  assert.match(clientSrc, /backpack/i, 'multi-wallet: backpack');
  assert.match(clientSrc, /solflare/i, 'multi-wallet: solflare');

  assert.match(loginSrc, /Sign in with Solana/, 'button is one-click SIWS copy');
  assert.doesNotMatch(loginSrc, /Connect wallet/, 'old button copy gone');
  assert.match(loginSrc, /data-wallet-login/, 'wallet hook kept');

  assert.equal(X_CONNECT_JS, clientSrc, 'baked x-connect matches source');
  assert.equal(LOGIN_PAGE_HTML, loginSrc, 'baked login page matches source');
  assert.equal(X_CONNECT_SRI, 'sha384-' + createHash('sha384').update(X_CONNECT_JS, 'utf8').digest('base64'), 'SRI pin matches bundle');

  const res = await workerDefault.fetch(new Request('https://www.getdasha.com/login'), {});
  assert.equal(res.status, 200, '/login 200');
  const body = await res.text();
  assert.doesNotMatch(body, /__X_CONNECT_SRI__/, 'no SRI placeholder served');
  assert.ok(body.includes(`integrity="${X_CONNECT_SRI}"`), 'served page pins the real x-connect SRI');
  assert.match(body, /Sign in with Solana/, 'served page has the one-click button');
}

console.log('dasha-login-wallet-oneclick: PASS (SIWS one-click challenge/verify, origin-bound single-use, legacy intact, quiet copy, baked parity, served SRI)');
