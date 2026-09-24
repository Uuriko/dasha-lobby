/**
 * Optional X (Twitter) link for Dasha lobby — pure helpers + OAuth pieces.
 * Linking is optional. Never required to chat.
 *
 * Secrets (wrangler secret put):
 *   X_CLIENT_ID, X_CLIENT_SECRET, LOBBY_SESSION_SECRET
 * Optional var: X_REDIRECT_URI (default https://lobby.getdasha.com/oauth/x/callback)
 */

export const COOKIE = '__Host-dasha_x';
export const LEGACY_COOKIE = 'dasha_x';
export const GROK_START_COOKIE = '__Host-dasha_grok_start';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
export const MAX_TEXT_LINKED = 280;
export const MAX_TEXT_HOLDER = 500;
export const RATE_MS_LINKED = 1200;
export const MAX_PER_MIN_LINKED = 20;
/** When room is this full, only X-linked users may join (until hard MAX_SOCKETS). */
export const ANON_SOFT_CAP = 75;

const te = new TextEncoder();

export function xConfigured(env) {
  return Boolean(env?.X_CLIENT_ID && env?.X_CLIENT_SECRET && env?.LOBBY_SESSION_SECRET);
}

export function redirectUri(env) {
  return (env?.X_REDIRECT_URI || 'https://lobby.getdasha.com/oauth/x/callback').replace(/\/$/, '');
}

function b64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomUrlToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

export async function pkceChallengeS256(verifier) {
  const dig = await crypto.subtle.digest('SHA-256', te.encode(verifier));
  return b64url(dig);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', te.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signPayload(secret, payload) {
  const body = b64url(te.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = b64url(await crypto.subtle.sign('HMAC', key, te.encode(body)));
  return `${body}.${sig}`;
}

export async function verifyPayload(secret, token) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    if (!body || !sig) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), te.encode(body));
    if (!ok) return null;
    const json = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!json || typeof json !== 'object') return null;
    if (typeof json.exp === 'number' && Date.now() > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}

export function cookieHeader(token, { maxAgeSec = SESSION_TTL_MS / 1000, clear = false } = {}) {
  if (clear) {
    return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  }
  return `${COOKIE}=${token}; Path=/; Max-Age=${Math.floor(maxAgeSec)}; HttpOnly; Secure; SameSite=Lax`;
}

export function grokStartCookieHeader(token, { maxAgeSec = 300, clear = false } = {}) {
  if (clear) {
    return `${GROK_START_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  }
  return `${GROK_START_COOKIE}=${token}; Path=/; Max-Age=${Math.floor(maxAgeSec)}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearLegacyCookieHeader = () => `${LEGACY_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export function readCookie(cookieHeader, name = COOKIE) {
  if (!cookieHeader) return null;
  const parts = String(cookieHeader).split(';');
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i < 0) continue;
    const k = p.slice(0, i).trim();
    if (k === name) {
      try { return decodeURIComponent(p.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export function normalizeHandle(raw) {
  const h = String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(h)) return null;
  return h;
}

export function displayNickFromLink(link) {
  if (!link?.handle) return null;
  return `@${link.handle}`;
}

/** Linked perks applied when validating chat / rate. */
export function linkedLimits(linked, holder = false) {
  if (!linked) {
    return { maxText: 200, rateMs: 2500, maxPerMin: 12, linked: false };
  }
  return {
    maxText: holder ? MAX_TEXT_HOLDER : MAX_TEXT_LINKED,
    rateMs: RATE_MS_LINKED,
    maxPerMin: MAX_PER_MIN_LINKED,
    linked: true,
    holder: Boolean(holder),
  };
}

/**
 * Soft seat reserve: when count >= ANON_SOFT_CAP, only linked may join (until hard max).
 */
export function mayJoinRoom({ count, maxSockets, linked, softCap = ANON_SOFT_CAP }) {
  if (count >= maxSockets) return { ok: false, reason: 'lobby full' };
  if (!linked && count >= softCap) {
    return { ok: false, reason: 'lobby busy — link X for a reserved seat, or try later' };
  }
  return { ok: true };
}

export function authorizeUrl({ clientId, redirectUri, state, challenge }) {
  const u = new URL('https://x.com/i/oauth2/authorize');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', 'tweet.read users.read');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.href;
}

export async function exchangeCode(env, { code, verifier }) {
  const redirect = redirectUri(env);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect,
    code_verifier: verifier,
    client_id: env.X_CLIENT_ID,
  });
  const basic = btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`);
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'token exchange failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchXUser(accessToken) {
  const res = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url,verified,verified_type,created_at', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.detail || data?.title || 'users/me failed');
    err.status = res.status;
    throw err;
  }
  const u = data.data;
  if (!u?.id || !u?.username) throw new Error('invalid user payload');
  const avatar =
    typeof u.profile_image_url === 'string'
      ? u.profile_image_url.replace('_normal.', '_mini.').slice(0, 300)
      : null;
  const xCreatedAt = Date.parse(u.created_at);
  return {
    xId: String(u.id),
    handle: normalizeHandle(u.username),
    name: typeof u.name === 'string' ? u.name.slice(0, 80) : '',
    verifiedType: u.verified_type || null,
    avatar,
    ...(Number.isFinite(xCreatedAt) ? { xCreatedAt } : {}),
  };
}

export async function createSessionToken(env, user) {
  const handle = normalizeHandle(user.handle);
  if (!handle) throw new Error('bad handle');
  const now = Date.now();
  const xCreatedAt = Number(user.xCreatedAt);
  return signPayload(env.LOBBY_SESSION_SECRET, {
    v: 1,
    xId: String(user.xId),
    handle,
    name: user.name || '',
    verifiedType: user.verifiedType || null,
    avatar: user.avatar || null,
    ...(Number.isFinite(xCreatedAt) ? { xCreatedAt } : {}),
    iat: now,
    exp: now + SESSION_TTL_MS,
  });
}

/** Wallet login proves control of one address. It does not imply holdings or an X identity. */
export async function createWalletSessionToken(env, publicKey) {
  const wallet = String(publicKey || '');
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) throw new Error('bad wallet');
  const now = Date.now();
  return signPayload(env.LOBBY_SESSION_SECRET, {
    v: 1,
    wallet,
    // Step-up auth claims (task 18; design PR #291): which method proved the
    // identity, and when. auth_time is set here at the authentication moment
    // and is never refreshed by rotation — a stolen-then-rotated token stays stale.
    auth_method: 'wallet',
    auth_time: now,
    iat: now,
    exp: now + SESSION_TTL_MS,
  });
}

/** Email code login proves control of one inbox. It does not imply an X identity or wallet. */
export async function createEmailSessionToken(env, email) {
  const normalized = String(email || '').trim().toLowerCase().slice(0, 254);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new Error('bad email');
  const now = Date.now();
  return signPayload(env.LOBBY_SESSION_SECRET, {
    v: 1,
    provider: 'email',
    email: normalized,
    iat: now,
    exp: now + SESSION_TTL_MS,
  });
}

/** Grok Bot device-code login. displayName is optional and public. */
export async function createGrokSessionToken(env, displayName) {
  const now = Date.now();
  const name = String(displayName || '').trim().slice(0, 48);
  return signPayload(env.LOBBY_SESSION_SECRET, {
    v: 1,
    provider: 'grok',
    displayName: name,
    iat: now,
    exp: now + SESSION_TTL_MS,
  });
}

/** Read either supported login without granting provider-specific perks. */
export async function authSessionFromRequest(env, request) {
  if (!env?.LOBBY_SESSION_SECRET) return null;
  const raw = readCookie(request.headers.get('Cookie'));
  if (!raw) return null;
  const payload = await verifyPayload(env.LOBBY_SESSION_SECRET, raw);
  if (payload?.v !== 1 || !Number.isFinite(payload.exp)) return null;
  if (payload.provider === 'grok') {
    const displayName = String(payload.displayName || '').trim().slice(0, 48);
    return { provider: 'grok', displayName };
  }
  if (payload.provider === 'email') {
    const email = String(payload.email || '').trim().toLowerCase().slice(0, 254);
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { provider: 'email', email };
    return null;
  }
  if (payload.provider === 'google') {
    const googleSub = String(payload.googleSub || '');
    if (!/^[1-9][0-9]{0,254}$/.test(googleSub)) return null;
    return {
      provider: 'google',
      googleSub,
      email: typeof payload.email === 'string' ? payload.email.slice(0, 254) : null,
      name: payload.name || '',
      avatar: typeof payload.avatar === 'string' ? payload.avatar.slice(0, 300) : null,
    };
  }
  const handle = normalizeHandle(payload.handle);
  if (payload.xId && handle) {
    const xCreatedAt = Number(payload.xCreatedAt);
    return {
      provider: 'x',
      xId: String(payload.xId),
      handle,
      name: payload.name || '',
      verifiedType: payload.verifiedType || null,
      avatar: typeof payload.avatar === 'string' ? payload.avatar.slice(0, 300) : null,
      ...(Number.isFinite(xCreatedAt) ? { xCreatedAt } : {}),
    };
  }
  const wallet = String(payload.wallet || '');
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) return { provider: 'wallet', wallet };
  return null;
}

export async function sessionFromRequest(env, request) {
  const payload = await authSessionFromRequest(env, request);
  if (payload?.provider !== 'x') return null;
  const xCreatedAt = Number(payload.xCreatedAt);
  return {
    xId: payload.xId,
    handle: payload.handle,
    name: payload.name || '',
    verifiedType: payload.verifiedType || null,
    avatar: typeof payload.avatar === 'string' ? payload.avatar.slice(0, 300) : null,
    linked: true,
    ...(Number.isFinite(xCreatedAt) ? { xCreatedAt } : {}),
  };
}

/** Public fields safe to show clients. */
export function publicLink(link) {
  if (!link?.handle) return null;
  return {
    handle: link.handle,
    display: `@${link.handle}`,
    href: `https://x.com/${link.handle}`,
    avatar: link.avatar || null,
    verifiedType: link.verifiedType || null,
  };
}

/* ------------------------------------------------------------------------ *
 * Step-up authentication for sensitive actions (task 18; design PR #291).  *
 * Reference implementation for the wallet SIWS path.                      *
 *                                                                          *
 * Session hijack turns a stolen cookie into full control of payout-wallet   *
 * and API-key actions until the 30-day TTL expires. Step-up demands a fresh *
 * interactive proof (for wallets: a re-signature of a fresh challenge)     *
 * before those money-adjacent actions, then grants a short window.         *
 * ------------------------------------------------------------------------ */

/** How long a fresh proof satisfies the gate (design §5). */
export const STEP_UP_WINDOW_MS = 10 * 60_000;
/**
 * Single-use step-up challenge TTL — tighter than the 5-minute login
 * challenge (§6 tightened for sensitive actions).
 */
export const STEP_UP_CHALLENGE_TTL_MS = 2 * 60_000;
/** Actions that may request a step-up challenge; bound into the signed challenge. */
export const STEP_UP_SCOPES = ['payout-wallet', 'payout-request', 'api-key-create'];
/** Failed step-up attempts before the challenge is invalidated (design §7). */
export const STEP_UP_MAX_ATTEMPTS = 3;
/** Which step-up methods an account may use, per the method that authenticated it. */
export const STEP_UP_METHODS_BY_AUTH_METHOD = {
  wallet: ['wallet'],
  email: ['email'],
  x: ['x'],
  google: ['google'],
  github: ['github'],
  grok: ['grok'],
};

function backfillAuthMethod(payload) {
  if (payload && typeof payload.auth_method === 'string' && payload.auth_method) return payload.auth_method;
  const provider = String(payload?.provider || '');
  if (provider) return provider;
  if (payload?.xId && payload?.handle) return 'x';
  if (payload?.wallet) return 'wallet';
  return null;
}

/**
 * Raw verified session payload with step-up claims normalized.
 *
 * Legacy (pre-claim) tokens backfill `auth_method` from provider/xId/wallet
 * and `auth_time` from `iat` — step-up treats a backfilled `auth_time` the
 * same as a real one, so there is no migration cliff (design §2).
 */
export async function sessionClaims(env, request) {
  if (!env?.LOBBY_SESSION_SECRET) return null;
  const raw = readCookie(request.headers.get('Cookie'));
  if (!raw) return null;
  const payload = await verifyPayload(env.LOBBY_SESSION_SECRET, raw);
  if (payload?.v !== 1 || !Number.isFinite(payload.exp)) return null;
  const iat = Number.isFinite(payload.iat) ? payload.iat : null;
  return {
    raw: payload,
    auth_method: backfillAuthMethod(payload),
    auth_time: Number.isFinite(payload.auth_time) ? payload.auth_time : iat,
    step_up_at: Number.isFinite(payload.step_up_at) ? payload.step_up_at : null,
    step_up_method: typeof payload.step_up_method === 'string' ? payload.step_up_method : null,
  };
}

/**
 * Does this session satisfy the step-up gate for a sensitive action?
 *
 * A grant from a completed step-up (`step_up_at` within the window) counts,
 * and so does a fresh login (`auth_time` within the window — one
 * authentication, not two). Rotation never re-arms `auth_time`, so a
 * freshly-rotated stolen token does not satisfy the gate.
 */
export function requireStepUp(claims, windowMs = STEP_UP_WINDOW_MS, now = Date.now()) {
  if (!claims) return { ok: false, reason: 'no session' };
  if (Number.isFinite(claims.step_up_at) && now - claims.step_up_at < windowMs) {
    return { ok: true, via: 'grant', method: claims.step_up_method || null };
  }
  if (Number.isFinite(claims.auth_time) && now - claims.auth_time < windowMs) {
    return { ok: true, via: 'fresh-login', method: claims.auth_method || null };
  }
  return { ok: false, reason: 'stale' };
}

/**
 * Re-issue the session token with a fresh step-up grant. Only step-up may
 * write `step_up_at` (design §5); `auth_time` and the original `iat`/`exp`
 * are preserved untouched — rotation can never buy freshness.
 */
export async function mintStepUpGrantToken(secret, claims, step_up_method) {
  if (!claims?.raw || typeof claims.raw !== 'object') throw new Error('no claims');
  return signPayload(secret, { ...claims.raw, step_up_at: Date.now(), step_up_method: String(step_up_method || '') });
}

/**
 * The 403 contract gated endpoints return (machine-readable so the page and
 * API clients behave the same — design §6).
 */
export function stepUpRequiredBody(claims) {
  const methods = STEP_UP_METHODS_BY_AUTH_METHOD[claims?.auth_method] || [];
  return {
    error: 'step_up_required',
    step_up_methods: methods,
    expires: Math.floor(STEP_UP_CHALLENGE_TTL_MS / 1000),
    copy: 'Confirm it\u2019s you to continue \u2014 this action needs a fresh sign-in proof.',
  };
}
