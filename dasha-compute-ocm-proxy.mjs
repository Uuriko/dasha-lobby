/**
 * Path-prefix reverse proxy: /compute/ocm → https://ocm.getdasha.com
 * Keeps Graham's live OCM on-domain without replacing /compute chat.
 * /compute/api/* stays the Dasha coordinator (caller must check API first or use isComputeOcmPath).
 */

export const OCM_ORIGIN = 'https://ocm.getdasha.com';
export const OCM_PREFIX = '/compute/ocm';

export function isComputeOcmPath(pathname) {
  const p = String(pathname || '');
  return p === OCM_PREFIX || p.startsWith(OCM_PREFIX + '/');
}

/** Map /compute/ocm(/...) → upstream path (strip prefix). Trailing slash on non-root → bare path. */
export function ocmUpstreamPath(pathname) {
  const p = String(pathname || '');
  if (p === OCM_PREFIX || p === OCM_PREFIX + '/') return '/';
  if (p.startsWith(OCM_PREFIX + '/')) {
    let rest = p.slice(OCM_PREFIX.length);
    if (!rest.startsWith('/')) rest = '/' + rest;
    // Upstream rejects /healthz/ (and similar); keep root as /.
    if (rest.length > 1 && rest.endsWith('/')) rest = rest.slice(0, -1);
    return rest;
  }
  return null;
}

export function ocmUpstreamUrl(pathname, search = '') {
  const path = ocmUpstreamPath(pathname);
  if (path == null) return null;
  return OCM_ORIGIN + path + String(search || '');
}

/**
 * Rewrite root-absolute href/src/action (and ocm.getdasha.com absolutes) under /compute/ocm.
 * Leaves api.ocm.getdasha.com and other hosts alone.
 */
export function rewriteOcmHtml(html, prefix = OCM_PREFIX) {
  let out = String(html || '');
  // Absolute ocm host → on-domain prefix (leave api.ocm.* alone).
  out = out.replace(/https:\/\/ocm\.getdasha\.com(?=\/|"|'|\s|>|$)/gi, prefix);
  // Root-absolute attrs; skip if already under prefix.
  out = out.replace(/\b(href|src|action)=(["'])(\/[^"']*)\2/gi, (full, attr, q, path) => {
    if (path === prefix || path.startsWith(prefix + '/')) return full;
    const next = path === '/' ? prefix + '/' : prefix + path;
    return `${attr}=${q}${next}${q}`;
  });
  out = out.replace(/url\((['"]?)(\/[^)'"]*)\1\)/gi, (full, q, path) => {
    if (path === prefix || path.startsWith(prefix + '/')) return full;
    const next = path === '/' ? prefix + '/' : prefix + path;
    return `url(${q}${next}${q})`;
  });
  return out;
}

/** Location: /signin → /compute/ocm/signin; https://ocm.getdasha.com/x → /compute/ocm/x */
export function rewriteOcmLocation(location, prefix = OCM_PREFIX) {
  const loc = String(location || '');
  if (!loc) return loc;
  const abs = loc.match(/^https?:\/\/ocm\.getdasha\.com(?::\d+)?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i);
  if (abs) {
    const path = abs[1] || '/';
    return prefix + (path === '/' ? '/' : path) + (abs[2] || '') + (abs[3] || '');
  }
  if (loc.startsWith('/') && !loc.startsWith('//')) {
    return prefix + loc;
  }
  return loc;
}

/** Path=/ → Path=/compute/ocm; strip Domain so cookie binds to www/lobby host. */
export function rewriteOcmSetCookie(value, prefix = OCM_PREFIX) {
  let out = String(value || '');
  out = out.replace(/;\s*Domain=[^;]*/gi, '');
  out = out.replace(/;\s*Path=([^;]*)/i, (_, path) => {
    const p = String(path || '/').trim() || '/';
    if (p === '/') return `; Path=${prefix}`;
    if (p === prefix || p.startsWith(prefix + '/')) return `; Path=${p}`;
    if (p.startsWith('/')) return `; Path=${prefix}${p}`;
    return `; Path=${prefix}/${p}`;
  });
  if (!/;\s*Path=/i.test(out)) out += `; Path=${prefix}`;
  return out;
}

function collectSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    try {
      const list = headers.getSetCookie();
      if (Array.isArray(list) && list.length) return list;
    } catch {}
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function isHtmlContentType(ct) {
  return /text\/html/i.test(String(ct || ''));
}

/** HEAD → same status/headers, empty body (upstream OCM often 404s HEAD on JSON routes). */
function maybeHead(request, res) {
  if (request.method !== 'HEAD') return res;
  return new Response(null, { status: res.status, statusText: res.statusText, headers: res.headers });
}

/** Paths where upstream speaks GET JSON but not HEAD (healthz confirmed live). */
function ocmForceGetUpstream(pathname) {
  const up = ocmUpstreamPath(pathname);
  return up === '/healthz';
}

/**
 * Reverse-proxy request under /compute/ocm to live OCM.
 * @param {Request} request
 * @param {{ fetch?: typeof fetch }} [opts] optional fetch stub for tests
 */
export async function proxyComputeOcm(request, opts = {}) {
  const url = new URL(request.url);
  if (!isComputeOcmPath(url.pathname)) return null;

  const upstreamHref = ocmUpstreamUrl(url.pathname, url.search);
  if (!upstreamHref) return null;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('host', 'ocm.getdasha.com');
  // Avoid compressed bodies we would rewrite as text without decompressing.
  const accept = headers.get('accept-encoding') || '';
  if (/gzip|br|deflate/i.test(accept) || !headers.has('accept-encoding')) {
    headers.set('accept-encoding', 'identity');
  }

  const origMethod = request.method;
  const forceGet = origMethod === 'HEAD' && ocmForceGetUpstream(url.pathname);
  const init = {
    method: forceGet ? 'GET' : origMethod,
    headers,
    redirect: 'manual',
  };
  if (origMethod !== 'GET' && origMethod !== 'HEAD') {
    init.body = request.body;
    // Node/undici may need duplex when body is a stream.
    if (typeof ReadableStream !== 'undefined' && request.body instanceof ReadableStream) {
      init.duplex = 'half';
    }
  }

  const doFetch = opts.fetch || globalThis.fetch;
  let upstream;
  try {
    upstream = await doFetch(upstreamHref, init);
    // Known GET-OK JSON routes: if a non-forced HEAD still 404s, retry once as GET.
    if (
      origMethod === 'HEAD' &&
      !forceGet &&
      upstream.status === 404 &&
      ocmForceGetUpstream(url.pathname)
    ) {
      const retry = { method: 'GET', headers, redirect: 'manual' };
      upstream = await doFetch(upstreamHref, retry);
    }
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'ocm upstream unavailable' }), {
      status: 502,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-dasha-edge': 'compute-ocm',
      },
    });
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === 'set-cookie' || k === 'content-encoding' || k === 'content-length' || k === 'transfer-encoding') return;
    outHeaders.set(key, value);
  });
  outHeaders.set('x-dasha-edge', 'compute-ocm');

  const loc = upstream.headers.get('location');
  if (loc) outHeaders.set('location', rewriteOcmLocation(loc));

  for (const cookie of collectSetCookies(upstream.headers)) {
    outHeaders.append('set-cookie', rewriteOcmSetCookie(cookie));
  }

  // WebSocket / opaque: pass through body as-is.
  const upgrade = (request.headers.get('upgrade') || '').toLowerCase();
  if (upgrade === 'websocket' || upstream.status === 101) {
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: outHeaders, webSocket: upstream.webSocket });
  }

  const ct = upstream.headers.get('content-type') || '';
  if (origMethod === 'HEAD' || !isHtmlContentType(ct)) {
    // Drain forced-GET body so the connection can close; HEAD response stays empty.
    if (origMethod === 'HEAD' && forceGet) {
      try { await upstream.arrayBuffer(); } catch {}
    }
    const res = new Response(origMethod === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
    return maybeHead(request, res);
  }

  const html = await upstream.text();
  const rewritten = rewriteOcmHtml(html);
  outHeaders.set('content-type', 'text/html; charset=utf-8');
  return maybeHead(request, new Response(rewritten, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  }));
}
