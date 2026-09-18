#!/usr/bin/env node
/**
 * Google OAuth module unit tests (dasha-lobby-google.mjs).
 * No network. No wrangler. ID-token crypto is exercised with a locally
 * generated RSA key via WebCrypto.
 */
import assert from 'node:assert/strict';
import {
  googleConfigured,
  googleRedirectUri,
  googleAuthorizeUrl,
  googleOauthStateCookie,
  normalizeGoogleUser,
  createGoogleSessionToken,
  googleSessionFromRequest,
  publicGoogleLink,
  GOOGLE_START_PATH,
  GOOGLE_CALLBACK_PATH,
  GOOGLE_OAUTH_COOKIE,
} from './dasha-lobby-google.mjs';

const env = {
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  LOBBY_SESSION_SECRET: 'test-lobby-secret-32-bytes-minimum!!',
};

// --- config ---
assert.equal(googleConfigured(env), true, 'configured with all three');
assert.equal(googleConfigured({}), false, 'not configured empty');
assert.equal(googleConfigured({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' }), false, 'needs session secret');
assert.equal(googleRedirectUri(env), 'https://lobby.getdasha.com/oauth/google/callback', 'default redirect');
assert.equal(googleRedirectUri({ ...env, GOOGLE_REDIRECT_URI: 'https://example.com/cb/' }), 'https://example.com/cb', 'custom redirect trims slash');
assert.equal(GOOGLE_START_PATH, '/oauth/google/start', 'start path');
assert.equal(GOOGLE_CALLBACK_PATH, '/oauth/google/callback', 'callback path');

// --- authorize URL ---
const authUrl = googleAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://lobby.getdasha.com/oauth/google/callback', state: 'st', challenge: 'ch' });
const u = new URL(authUrl);
assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth', 'authorize endpoint');
assert.equal(u.searchParams.get('client_id'), 'cid', 'client_id');
assert.equal(u.searchParams.get('response_type'), 'code', 'response_type');
assert.equal(u.searchParams.get('code_challenge_method'), 'S256', 'pkce method');
assert.equal(u.searchParams.get('state'), 'st', 'state');
assert.ok(u.searchParams.get('scope').includes('openid'), 'openid scope');

// --- state cookie ---
const setCookie = googleOauthStateCookie('tok123');
assert.match(setCookie, new RegExp(`^${GOOGLE_OAUTH_COOKIE}=tok123`), 'state cookie name/value');
assert.match(setCookie, /HttpOnly; Secure; SameSite=Lax/, 'state cookie flags');
assert.match(googleOauthStateCookie(), /Max-Age=0/, 'clearing state cookie');

// --- user normalization ---
const user = normalizeGoogleUser({ sub: '123456789', email: 'Test@Example.com', name: 'Test User', picture: 'https://example.com/pic.jpg' });
assert.equal(user.googleSub, '123456789', 'sub');
assert.equal(user.email, 'test@example.com', 'email lowercased');
assert.equal(user.name, 'Test User', 'name');
assert.throws(() => normalizeGoogleUser({ sub: 'abc' }), 'bad sub throws');
assert.throws(() => normalizeGoogleUser({}), 'missing sub throws');

// --- session round-trip ---
const session = await createGoogleSessionToken(env, user);
const req = new Request('https://lobby.getdasha.com/', { headers: { Cookie: `__Host-dasha_x=${encodeURIComponent(session)}` } });
const sess = await googleSessionFromRequest(env, req);
assert.equal(sess?.provider, 'google', 'session provider');
assert.equal(sess?.googleSub, '123456789', 'session sub');
assert.equal(sess?.email, 'test@example.com', 'session email');

// tampered token must not verify
const badReq = new Request('https://lobby.getdasha.com/', { headers: { Cookie: '__Host-dasha_x=tampered.token' } });
assert.equal(await googleSessionFromRequest(env, badReq), null, 'tampered token rejected');

// --- public link ---
const pub = publicGoogleLink(user);
assert.equal(pub?.provider, 'google', 'public provider');
assert.equal(publicGoogleLink({}), null, 'public link needs sub');

// --- ID token verification with a local RSA key ---
function b64url(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const { verifyGoogleIdToken } = await import('./dasha-lobby-google.mjs');
const keyPair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
// stub fetch for JWKS
const origFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  assert.equal(url, 'https://www.googleapis.com/oauth2/v3/certs', 'jwks url');
  return { ok: true, json: async () => ({ keys: [{ ...pubJwk, kid: 'test-kid', use: 'sig', alg: 'RS256' }] }) };
};
try {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    iss: 'https://accounts.google.com', sub: '123456789', aud: env.GOOGLE_CLIENT_ID,
    iat: now - 10, exp: now + 300,
  })));
  const sig = b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${payload}`)));
  const idToken = `${header}.${payload}.${sig}`;
  const claims = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID);
  assert.equal(claims.sub, '123456789', 'verified sub');
  // wrong audience must fail
  await assert.rejects(() => verifyGoogleIdToken(idToken, 'other-client'), 'wrong aud rejected');
  // tampered signature must fail
  await assert.rejects(() => verifyGoogleIdToken(`${header}.${payload}.AAAA`, env.GOOGLE_CLIENT_ID), 'bad sig rejected');
} finally {
  globalThis.fetch = origFetch;
}

console.log('dasha-google-oauth: PASS (config, authorize URL, PKCE state cookie, user normalize, session round-trip, JWKS id-token verify)');
