/**
 * Compute guest / pairing API key.
 * POST mints a 24h opaque dgk_ key (hash at rest). GET/HEAD is the public contract.
 * Chat + models only. Rate-limited by IP + optional pairing code. No people-data.
 * Never log a full key after mint.
 */

import { randomUrlToken } from './dasha-lobby-x.mjs';
import { COMPUTE_LLMS_URL, COMPUTE_SKILL_URL } from './dasha-compute-agent.mjs';

export const COMPUTE_GUEST_KEYS_PATH = '/compute/api/guest-keys';
export const COMPUTE_GUEST_KEYS_URL = `https://lobby.getdasha.com${COMPUTE_GUEST_KEYS_PATH}`;
export const COMPUTE_GUEST_KEYS_URL_WWW = `https://www.getdasha.com${COMPUTE_GUEST_KEYS_PATH}`;

export const GUEST_KEY_KIND = 'guest';
export const GUEST_KEY_SCOPES = Object.freeze(['chat', 'models']);
export const GUEST_KEY_TTL_MS = 24 * 60 * 60_000;
export const GUEST_KEY_TTL_SECONDS = 86_400;
export const GUEST_KEY_MINT_MAX = 3;
export const GUEST_KEY_MINT_WINDOW_MS = 60 * 60_000;
export const GUEST_KEY_CHAT_MAX = 3;
export const GUEST_KEY_CHAT_WINDOW_MS = 10 * 60_000;
export const GUEST_KEY_MINT_REASON = 'guest_key_mint';
export const GUEST_KEY_RATE_LIMITED_REASON = 'guest_key_rate_limited';
export const GUEST_KEY_SCOPE_REASON = 'guest_key_scope';
export const GUEST_KEY_MINT_CURL = `curl -sS -X POST ${COMPUTE_GUEST_KEYS_URL} -H 'Content-Type: application/json' -d '{}'`;

const SECURITY = {
  'Cache-Control': 'no-store',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function guestKeyContractBody() {
  return {
    status: 'ok',
    reason: GUEST_KEY_MINT_REASON,
    hint: 'POST here for a 24h chat+models key. Copy once. 3/hour/IP.',
    next: [
      { path: '/compute/api/guest-keys' },
      { path: '/compute/api/v1/chat/completions' },
      { path: '/compute/llms.txt' },
      { path: '/compute/skill.md' },
      { path: '/compute#build' },
    ],
    mint: 'live',
    ttl_seconds: GUEST_KEY_TTL_SECONDS,
    scopes: [...GUEST_KEY_SCOPES],
    rate: {
      mint: '3/hour/IP',
      pairing: '3/hour/code',
      chat: '3/10min',
    },
    curl: GUEST_KEY_MINT_CURL,
    docs: {
      llms: COMPUTE_LLMS_URL,
      skill: COMPUTE_SKILL_URL,
    },
  };
}

export function isComputeGuestKeyPath(pathname) {
  const path = String(pathname || '');
  return path === COMPUTE_GUEST_KEYS_PATH
    || path === `${COMPUTE_GUEST_KEYS_PATH}/`
    || /^\/compute\/api\/guest-keys\/[A-Za-z0-9._-]+\/?$/.test(path);
}

export function guestKeyResponse(status, body, { head = false } = {}) {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY,
      ...CORS,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Dasha-Edge': 'compute-guest-key',
    },
  });
}

export function guestKeyAx(message, reason, hint, extra = {}) {
  const type = reason === 'invalid_api_key' ? 'authentication_error' : 'invalid_request_error';
  return {
    error: { message, type, code: null },
    status: 'action_required',
    reason,
    hint,
    next: extra.next || [
      { path: '/compute/api/guest-keys' },
      { path: '/compute#build' },
      { path: '/compute/llms.txt' },
    ],
    mint: 'live',
    ...(extra.fields || {}),
  };
}

export function parseGuestApiToken(token) {
  const match = String(token || '').match(/^dgk_([A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{20,})$/);
  if (!match) return null;
  return { id: `gkey_${match[1]}`, slug: match[1] };
}

export function isGuestApiKey(key) {
  return Boolean(key && key.kind === GUEST_KEY_KIND);
}

export function guestKeyAllows(key, scope) {
  if (!isGuestApiKey(key)) return true;
  return Array.isArray(key.scopes) && key.scopes.includes(scope);
}

export function guestKeyExpired(key, now = Date.now()) {
  return isGuestApiKey(key) && Number(key.expiresAt) > 0 && Number(key.expiresAt) <= now;
}

export function normalizePairingCode(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  if (!/^[a-z0-9]{4,32}$/.test(value)) return null;
  return value;
}

export function guestMintClientIp(request) {
  const cf = request.headers.get('CF-Connecting-IP');
  const fwd = request.headers.get('X-Forwarded-For') || request.headers.get('x-forwarded-for');
  const ip = (cf || fwd?.split(',')[0] || 'unknown').trim().slice(0, 64);
  return ip || 'unknown';
}

export function takeGuestRate(rates, key, max, windowMs = 60_000) {
  const now = Date.now();
  const recent = (rates.get(key) || []).filter((at) => now - at < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  rates.set(key, recent);
  return true;
}

async function sha256Hex(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sameSecret(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function readJsonBody(request, limit = 4096) {
  if (Number(request.headers.get('Content-Length') || 0) > limit) return {};
  const text = await request.text().catch(() => '');
  if (new TextEncoder().encode(text).length > limit) return {};
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

/** Mint a short-lived guest key into compute:api-key: (hash only). */
export async function mintGuestKey({ storage, rates, ip = 'unknown', pairing = '', name = '', now = Date.now() } = {}) {
  const pairingNorm = normalizePairingCode(pairing);
  if (pairing && pairingNorm === null) {
    return {
      status: 400,
      body: guestKeyAx(
        'invalid pairing code',
        'guest_key_invalid_pairing',
        'Pairing codes are 4–32 letters or digits.',
      ),
    };
  }
  const ipKey = `guest-mint:ip:${ip || 'unknown'}`;
  if (!takeGuestRate(rates, ipKey, GUEST_KEY_MINT_MAX, GUEST_KEY_MINT_WINDOW_MS)) {
    return {
      status: 429,
      body: guestKeyAx(
        'guest key rate limited; try again later',
        GUEST_KEY_RATE_LIMITED_REASON,
        'Wait, then POST /compute/api/guest-keys again. Or sign in at /compute#build.',
        { fields: { retry_after_seconds: 3600 } },
      ),
    };
  }
  if (pairingNorm && !takeGuestRate(rates, `guest-mint:pair:${pairingNorm}`, GUEST_KEY_MINT_MAX, GUEST_KEY_MINT_WINDOW_MS)) {
    return {
      status: 429,
      body: guestKeyAx(
        'guest key rate limited; try again later',
        GUEST_KEY_RATE_LIMITED_REASON,
        'That pairing code is hot. Wait, or mint without a code.',
        { fields: { retry_after_seconds: 3600 } },
      ),
    };
  }
  const slug = randomUrlToken(9);
  const token = `dgk_${slug}.${randomUrlToken(24)}`;
  const id = `gkey_${slug}`;
  const record = {
    id,
    owner: `guest:${slug}`,
    name: String(name || '').trim().slice(0, 64) || 'Guest key',
    kind: GUEST_KEY_KIND,
    prefix: token.slice(0, 12),
    tokenHash: await sha256Hex(token),
    createdAt: now,
    lastUsedAt: 0,
    expiresAt: now + GUEST_KEY_TTL_MS,
    scopes: [...GUEST_KEY_SCOPES],
    pairingCodeHash: pairingNorm ? await sha256Hex(pairingNorm) : null,
    limitCents: null,
    limitReset: 'none',
    spendCents: 0,
    spendWindowStart: now,
  };
  await storage.put(`compute:api-key:${id}`, record);
  return {
    status: 201,
    body: {
      status: 'ok',
      reason: GUEST_KEY_MINT_REASON,
      hint: 'Copy this key now. 24h. Chat + models only.',
      next: [
        { path: '/compute/api/v1/chat/completions' },
        { path: '/compute/api/v1/models' },
        { path: '/compute/llms.txt' },
      ],
      mint: 'live',
      id,
      name: record.name,
      api_key: token,
      prefix: record.prefix,
      expires_at: record.expiresAt,
      ttl_seconds: GUEST_KEY_TTL_SECONDS,
      scopes: [...GUEST_KEY_SCOPES],
      note: 'Copy this key now. Dasha stores only its hash. 24h. Chat + models only.',
    },
  };
}

export async function revokeGuestKey({ storage, token = '', wantId = '' } = {}) {
  const parsed = parseGuestApiToken(token);
  if (!parsed) {
    return {
      status: 401,
      body: guestKeyAx(
        'invalid API key',
        'invalid_api_key',
        'DELETE with the guest Bearer. Or mint again at /compute/api/guest-keys.',
      ),
    };
  }
  const key = await storage.get(`compute:api-key:${parsed.id}`);
  if (!key || !isGuestApiKey(key) || !sameSecret(await sha256Hex(token), key.tokenHash)) {
    return {
      status: 401,
      body: guestKeyAx(
        'invalid API key',
        'invalid_api_key',
        'DELETE with the guest Bearer. Or mint again at /compute/api/guest-keys.',
      ),
    };
  }
  if (wantId && wantId !== key.id) {
    return {
      status: 404,
      body: guestKeyAx(
        'guest key not found',
        'guest_key_not_found',
        'DELETE /compute/api/guest-keys/:id with that key’s Bearer.',
      ),
    };
  }
  await storage.delete(`compute:api-key:${key.id}`);
  return { status: 200, body: { ok: true, revoked: true, id: key.id } };
}

/** POST/DELETE door. Null when the path is not guest-keys or method is a public probe. */
export async function handleGuestKeyWrite(request, { storage, rates, now = Date.now() } = {}) {
  const path = new URL(request.url).pathname;
  if (!isComputeGuestKeyPath(path)) return null;
  const method = request.method;
  if (method === 'POST') {
    const input = await readJsonBody(request);
    const pairing = input.pairing_code ?? input.pairing ?? input.code ?? '';
    const minted = await mintGuestKey({
      storage,
      rates,
      ip: guestMintClientIp(request),
      pairing,
      name: input.name,
      now,
    });
    return guestKeyResponse(minted.status, minted.body);
  }
  if (method === 'DELETE') {
    const idMatch = path.match(/^\/compute\/api\/guest-keys\/([A-Za-z0-9._-]+)\/?$/);
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const revoked = await revokeGuestKey({ storage, token, wantId: idMatch?.[1] || '' });
    return guestKeyResponse(revoked.status, revoked.body);
  }
  return guestKeyResponse(405, {
    ...guestKeyAx('method not allowed', 'method_not_allowed', 'GET contract, POST mint, DELETE revoke.'),
    error: 'method not allowed',
  });
}

/** Shared door for ComputeNetwork + computeApi. GET/HEAD/OPTIONS only. Writes fall through to the DO. */
export function computeGuestKeyResponse(request) {
  const path = new URL(request.url).pathname;
  if (!isComputeGuestKeyPath(path)) return null;
  const method = request.method;
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        'Access-Control-Max-Age': '86400',
        'X-Dasha-Edge': 'compute-guest-key',
      },
    });
  }
  if (method === 'GET' || method === 'HEAD') {
    return guestKeyResponse(200, guestKeyContractBody(), { head: method === 'HEAD' });
  }
  return null;
}
