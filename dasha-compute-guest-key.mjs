/**
 * Compute guest / pairing API key — smallest vertical.
 * Mint is deferred: POST returns 501 with status/reason/hint/next.
 * GET/HEAD is the public contract. Never returns an api_key.
 * No emails or phones. Never log a full key after a future mint.
 */

import { COMPUTE_LLMS_URL, COMPUTE_SKILL_URL } from './dasha-compute-agent.mjs';

export const COMPUTE_GUEST_KEYS_PATH = '/compute/api/guest-keys';
export const COMPUTE_GUEST_KEYS_URL = `https://lobby.getdasha.com${COMPUTE_GUEST_KEYS_PATH}`;
export const COMPUTE_GUEST_KEYS_URL_WWW = `https://www.getdasha.com${COMPUTE_GUEST_KEYS_PATH}`;

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

export const GUEST_KEY_MINT_DEFERRED_REASON = 'guest_key_mint_deferred';

export function guestKeyContractBody() {
  return {
    status: 'action_required',
    reason: GUEST_KEY_MINT_DEFERRED_REASON,
    hint: 'Sign in, then create a key at /compute#build.',
    next: [
      { path: '/compute#build' },
      { path: '/compute/llms.txt' },
      { path: '/compute/skill.md' },
    ],
    mint: 'deferred',
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

function guestKeyResponse(status, body, { head = false } = {}) {
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

/** Shared door for ComputeNetwork + computeApi. Null when the path is not guest-keys. */
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
  const body = guestKeyContractBody();
  if (method === 'GET' || method === 'HEAD') {
    return guestKeyResponse(200, body, { head: method === 'HEAD' });
  }
  if (method === 'POST' || method === 'DELETE') {
    return guestKeyResponse(501, body);
  }
  return guestKeyResponse(405, {
    ...body,
    error: 'method not allowed',
  });
}
