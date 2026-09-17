/**
 * Optional Google sign-in for Dasha lobby — OAuth 2.0 with PKCE.
 * Sign-in is optional. Never required to chat.
 *
 * Secrets (wrangler secret put -c dasha-lobby-wrangler.jsonc):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, LOBBY_SESSION_SECRET
 * Optional var: GOOGLE_REDIRECT_URI
 *   default https://lobby.getdasha.com/oauth/google/callback
 *
 * Google OAuth client (console.cloud.google.com → APIs & Services → Credentials):
 *   Application type: Web application
 *   Authorized redirect URI: https://lobby.getdasha.com/oauth/google/callback
 */
import {
  signPayload,
  verifyPayload,
  readCookie,
  randomUrlToken,
  pkceChallengeS256,
  cookieHeader,
  clearLegacyCookieHeader,
  SESSION_TTL_MS,
} from './dasha-lobby-x.mjs';

export const GOOGLE_START_PATH = '/oauth/google/start';
export const GOOGLE_CALLBACK_PATH = '/oauth/google/callback';
export const GOOGLE_OAUTH_COOKIE = '__Host-dasha_google_oauth';
export const DEFAULT_GOOGLE_REDIRECT = 'https://lobby.getdasha.com/oauth/google/callback';
export const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_ISSUER = 'https://accounts.google.com';
export const GOOGLE_SCOPE = 'openid email profile';
const GOOGLE_SUB_RE = /^[1-9][0-9]{0,254}$/;

export function googleConfigured(env) {
  return Boolean(env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET && env?.LOBBY_SESSION_SECRET);
}

export function googleRedirectUri(env) {
  return String(env?.GOOGLE_REDIRECT_URI || DEFAULT_GOOGLE_REDIRECT).replace(/\/$/, '');
}

export function googleOauthStateCookie(token = '') {
  return `${GOOGLE_OAUTH_COOKIE}=${token}; Path=/; Max-Age=${token ? 900 : 0}; HttpOnly; Secure; SameSite=Lax`;
}

export function googleAuthorizeUrl({ clientId, redirectUri, state, challenge, scope = GOOGLE_SCOPE }) {
  const u = new URL(GOOGLE_AUTHORIZE);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', scope);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('access_type', 'online');
  u.searchParams.set('prompt', 'select_account');
  return u.href;
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJwtPart(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('bad jwt part');
  const bytes = b64urlDecode(part);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

let jwksCache = null;
let jwksFetchedAt = 0;

async function googleKey(kid) {
  if (typeof kid !== 'string' || !kid || kid.length > 256) throw new Error('bad kid');
  const now = Date.now();
  if (!jwksCache || now - jwksFetchedAt > 60 * 60 * 1000) {
    const res = await fetch(GOOGLE_JWKS);
    const doc = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(doc?.keys) || doc.keys.length > 32) throw new Error('jwks fetch failed');
    const keys = new Map();
    for (const jwk of doc.keys) {
      if (jwk?.kty !== 'RSA' || (jwk.use && jwk.use !== 'sig') || (jwk.alg && jwk.alg !== 'RS256')) continue;
      if (typeof jwk.kid !== 'string' || !jwk.kid) continue;
      try {
        const key = await crypto.subtle.importKey(
          'jwk',
          { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        );
        keys.set(jwk.kid, key);
      } catch { /* skip unusable keys */ }
    }
    jwksCache = keys;
    jwksFetchedAt = now;
  }
  const key = jwksCache.get(kid);
  if (!key) throw new Error('unknown kid');
  return key;
}

/** Verify a Google ID token (RS256, JWKS). Returns the verified claims. */
export async function verifyGoogleIdToken(idToken, clientId) {
  if (typeof idToken !== 'string' || idToken.length > 16384) throw new Error('bad id token');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('bad id token');
  const header = decodeJwtPart(parts[0]);
  if (header?.alg !== 'RS256' || (header.typ && header.typ !== 'JWT')) throw new Error('bad id token alg');
  const key = await googleKey(header.kid);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw new Error('bad id token signature');
  const claims = decodeJwtPart(parts[1]);
  const seconds = Math.floor(Date.now() / 1000);
  const iss = claims?.iss === 'accounts.google.com' ? GOOGLE_ISSUER : claims?.iss;
  const aud = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (
    iss !== GOOGLE_ISSUER
    || !aud.includes(clientId)
    || !GOOGLE_SUB_RE.test(claims?.sub || '')
    || !Number.isSafeInteger(claims?.exp)
    || !Number.isSafeInteger(claims?.iat)
    || claims.exp <= seconds
    || claims.iat > seconds
    || claims.exp <= claims.iat
    || claims.exp - claims.iat > 3600
  ) {
    throw new Error('bad id token claims');
  }
  return claims;
}

export async function exchangeGoogleCode(env, { code, verifier }) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: googleRedirectUri(env),
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.id_token) {
    const err = new Error(data.error_description || data.error || 'google token exchange failed');
    err.status = res.status;
    throw err;
  }
  const scopes = typeof data.scope === 'string' ? data.scope.trim().split(/\s+/) : [];
  if (!scopes.includes('openid')) throw new Error('google scope mismatch');
  return data;
}

export function normalizeGoogleUser(claims) {
  const sub = String(claims?.sub || '');
  if (!GOOGLE_SUB_RE.test(sub)) throw new Error('bad google subject');
  const email = typeof claims?.email === 'string' ? claims.email.trim().toLowerCase().slice(0, 254) : '';
  return {
    googleSub: sub,
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
    name: typeof claims?.name === 'string' ? claims.name.slice(0, 80) : '',
    avatar: typeof claims?.picture === 'string' ? claims.picture.slice(0, 300) : null,
  };
}

/** Google sign-in proves control of one Google account. It does not imply an X identity or wallet. */
export async function createGoogleSessionToken(env, user) {
  if (!GOOGLE_SUB_RE.test(user?.googleSub || '')) throw new Error('bad google subject');
  const now = Date.now();
  return signPayload(env.LOBBY_SESSION_SECRET, {
    v: 1,
    provider: 'google',
    googleSub: user.googleSub,
    email: user.email || null,
    name: user.name || '',
    avatar: user.avatar || null,
    iat: now,
    exp: now + SESSION_TTL_MS,
  });
}

/** Read a Google session from the main Dasha session cookie. */
export async function googleSessionFromRequest(env, request) {
  if (!env?.LOBBY_SESSION_SECRET) return null;
  const raw = readCookie(request.headers.get('Cookie'));
  if (!raw) return null;
  const payload = await verifyPayload(env.LOBBY_SESSION_SECRET, raw);
  if (payload?.v !== 1 || payload?.provider !== 'google' || !GOOGLE_SUB_RE.test(payload?.googleSub || '')) return null;
  if (!Number.isFinite(payload.exp)) return null;
  return {
    provider: 'google',
    googleSub: payload.googleSub,
    email: typeof payload.email === 'string' ? payload.email : null,
    name: payload.name || '',
    avatar: typeof payload.avatar === 'string' ? payload.avatar.slice(0, 300) : null,
  };
}

/** Public fields safe to show clients. */
export function publicGoogleLink(user) {
  if (!user?.googleSub) return null;
  return {
    provider: 'google',
    name: user.name || '',
    avatar: user.avatar || null,
  };
}

export { cookieHeader, clearLegacyCookieHeader, randomUrlToken, pkceChallengeS256, SESSION_TTL_MS };
