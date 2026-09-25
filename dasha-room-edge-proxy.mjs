/**
 * Project Room reverse-proxy for getdasha edge.
 * /room and /room/ → origin HTML door (Open/Join/Connect).
 * Accept: text/plain on /room (+slash) → origin /room packet (same bytes as
 * /room/llms.txt). Browsers keep the HTML door.
 * /room/llms.txt + packet/card/health stay prefix-preserving discovery docs.
 * /room/kits (+ kits.txt family) → live catalog /kits.txt on room.trydemigod.com.
 * Staging workers.dev answers Cloudflare 1042, including /kits.txt, so the
 * kits family does not use ROOM_ORIGIN. Other Room doors stay on staging.
 * Not Compute. Does NOT overwrite site-root /.well-known/agent.json.
 * Leftover skill/card/health synonyms stay 308 (not this map).
 * Never Jupiter plugin host.
 */

export const ROOM_ORIGIN = 'https://project-room-staging.getdasha.workers.dev';
/** Live Project Room catalog. www /room/kits and this host serve the same bytes. */
export const ROOM_KITS_ORIGIN = 'https://room.trydemigod.com';
const ROOM_KITS_UPSTREAM = '/kits.txt';
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

/** Exact lobby doors → upstream paths. HTML door is /room on ROOM_ORIGIN.
 *  Kits family maps to /kits.txt on ROOM_KITS_ORIGIN (live /kits matches
 *  /kits.txt; staging workers.dev is 1042). */
const ROOM_UPSTREAM = Object.freeze({
  '/room': '/room',
  '/room/': '/room',
  '/room/llms.txt': '/llms.txt',
  '/room/llms-full.txt': '/llms-full.txt',
  '/room/.well-known/agent.json': '/.well-known/agent.json',
  '/room/api/health': '/api/health',
  '/room/kits': '/kits.txt',
  '/room/kit': '/kits.txt',
  '/room/kits.txt': '/kits.txt',
  '/room/kits.md': '/kits.txt',
  '/room/kit.txt': '/kits.txt',
  '/room/kit.md': '/kits.txt',
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
  const origin = upstream === ROOM_KITS_UPSTREAM ? ROOM_KITS_ORIGIN : ROOM_ORIGIN;
  return origin + upstream;
}

/** Live www+lobby: Accept text/plain (and no text/html) on /room serves the
 *  packet. text/html anywhere in Accept keeps the HTML door. */
export function roomAcceptsPlain(request) {
  const accept = String(request?.headers?.get?.('accept') || '').toLowerCase();
  return accept.includes('text/plain') && !accept.includes('text/html');
}

function allowedUpstreamType(contentType, upstreamPath, request) {
  const ct = String(contentType || '').toLowerCase();
  if (upstreamPath === '/room') {
    if (roomAcceptsPlain(request)) return ct.includes('text/plain');
    return ct.includes('text/html');
  }
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

function outboundRequestHeaders(request, upstreamPath) {
  const headers = new Headers();
  const skip = extraHopByHop(request.headers);
  const accept = request.headers.get('accept');
  if (accept && !skip.has('accept')) headers.set('accept', accept);
  headers.set('accept-encoding', 'identity');
  // Room asks for a custom User-Agent. Kits is the live origin.
  if (upstreamPath === ROOM_KITS_UPSTREAM) headers.set('user-agent', 'dasha-lobby');
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
 * Reverse-proxy Room door + discovery. Query string is ignored for matching.
 * GET+HEAD only. Returns null when this request is not a Room door.
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
  const upstreamPath = roomUpstreamPath(pathname);
  const upstreamHref = roomUpstreamUrl(pathname);
  if (!upstreamHref) return null;

  const doFetch = opts.fetch || globalThis.fetch;
  const init = {
    method: 'GET',
    headers: outboundRequestHeaders(request, upstreamPath),
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
  if (upstream.status === 200 && !allowedUpstreamType(ct, upstreamPath, request)) {
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
