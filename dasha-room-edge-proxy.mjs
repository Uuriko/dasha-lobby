/**
 * Project Room discovery reverse-proxy for getdasha edge.
 * Prefix-preserving: /room and /room/* discovery docs → origin bytes.
 * Does NOT overwrite site-root /.well-known/agent.json (Compute card).
 * Discovery only — no Room HTML UI. Never Jupiter plugin host.
 */

export const ROOM_ORIGIN = 'https://project-room-staging.getdasha.workers.dev';
export const ROOM_EDGE = 'room-discovery';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-encoding',
  'content-length',
  'set-cookie',
]);

/** KEY_ROUTES aliases from project-room deploy/agent-discovery.mjs */
const ROOM_UPSTREAM = Object.freeze({
  '/room': '/llms.txt',
  '/room/': '/llms.txt',
  '/room/llms.txt': '/llms.txt',
  '/room/llms-full.txt': '/llms-full.txt',
  '/room/.well-known/agent.json': '/.well-known/agent.json',
  '/room/api/health': '/api/health',
});

function extraHopByHop(headers) {
  const extra = new Set();
  const conn = headers?.get?.('connection');
  if (!conn) return extra;
  for (const part of String(conn).split(',')) {
    const name = part.trim().toLowerCase();
    if (name) extra.add(name);
  }
  return extra;
}

export function normalizeRoomPath(pathname) {
  let path = String(pathname || '');
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep raw */
  }
  path = path.toLowerCase();
  if (path.length > 1 && path.endsWith('/') && path !== '/room/') {
    path = path.replace(/\/+$/, '') || '/';
  }
  return path;
}

export function roomUpstreamPath(pathname) {
  return ROOM_UPSTREAM[normalizeRoomPath(pathname)] || null;
}

export function isRoomDiscoveryPath(pathname) {
  return roomUpstreamPath(pathname) != null;
}

export function roomUpstreamUrl(pathname) {
  const upstream = roomUpstreamPath(pathname);
  if (!upstream) return null;
  return ROOM_ORIGIN + upstream;
}

function allowedDiscoveryType(contentType) {
  const ct = String(contentType || '').toLowerCase();
  return ct.includes('text/plain') || ct.includes('application/json');
}

function failClosed(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-dasha-edge': ROOM_EDGE,
    },
  });
}

function outboundRequestHeaders(request) {
  const headers = new Headers();
  const skip = extraHopByHop(request.headers);
  const accept = request.headers.get('accept');
  if (accept && !skip.has('accept')) headers.set('accept', accept);
  headers.set('accept-encoding', 'identity');
  return headers;
}

function inboundResponseHeaders(upstream) {
  const out = new Headers();
  const skip = extraHopByHop(upstream.headers);
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (HOP_BY_HOP.has(name) || skip.has(name)) return;
    out.set(key, value);
  });
  out.set('cache-control', 'no-store');
  out.set('x-dasha-edge', ROOM_EDGE);
  if (!out.has('x-content-type-options')) out.set('x-content-type-options', 'nosniff');
  return out;
}

/**
 * Reverse-proxy Room discovery. Query string is ignored for matching.
 * GET+HEAD only. Returns null when this request is not a Room discovery door.
 * @param {Request} request
 * @param {{ fetch?: typeof fetch }} [opts]
 */
export async function roomDiscoveryResponse(request, opts = {}) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') return null;

  let pathname = '/';
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return null;
  }
  const upstreamHref = roomUpstreamUrl(pathname);
  if (!upstreamHref) return null;

  const doFetch = opts.fetch || globalThis.fetch;
  const init = {
    method: 'GET',
    headers: outboundRequestHeaders(request),
    redirect: 'manual',
  };
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    init.signal = AbortSignal.timeout(4000);
  }

  let upstream;
  try {
    upstream = await doFetch(upstreamHref, init);
  } catch {
    return failClosed(502, 'room origin unavailable');
  }

  const ct = upstream.headers.get('content-type') || '';
  if (upstream.status === 200 && !allowedDiscoveryType(ct)) {
    try { await upstream.arrayBuffer(); } catch { /* drain */ }
    return failClosed(502, 'room origin not discovery');
  }

  const headers = inboundResponseHeaders(upstream);
  if (method === 'HEAD') {
    try { await upstream.arrayBuffer(); } catch { /* drain forced GET */ }
    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
