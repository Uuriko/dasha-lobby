/**
 * Public verified-fill tape. Same inspect as POST /faucet/donate.
 * Empty tape is honest. Do not invent fills.
 */
import { donateAmountUi, donateSigError, inspectDonateTx, FAUCET_MINT, FAUCET_TREASURY_DEFAULT } from './dasha-faucet.mjs';

export const FAUCET_TAPE_CAP = 50;
export const FAUCET_TAPE_KEEP = 64;
export const FAUCET_TAPE_SCAN_CAP = 12;
export const FAUCET_TAPE_SCAN_COOL_MS = 60_000;

export function shouldScanTape(lastScanAt, now = Date.now(), coolMs = FAUCET_TAPE_SCAN_COOL_MS) {
  const prev = Number(lastScanAt) || 0;
  return !prev || now - prev >= coolMs;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-max-age': '86400',
};

export function isFaucetTapePath(pathname) {
  return pathname === '/faucet/tape' || pathname === '/faucet/fills';
}

export function truncateFrom(addr) {
  const s = String(addr || '').trim();
  if (!s) return '';
  if (s.includes('…')) return s;
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function fillAmount(amountUi) {
  const n = Number(amountUi);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fillWhen(at) {
  const when = new Date(Number(at));
  if (Number.isNaN(when.getTime())) return '';
  return `${when.getUTCDate()} ${MONTHS[when.getUTCMonth()]}`;
}

export function fillLine(row) {
  const amt = fillAmount(row && row.amountUi);
  const when = fillWhen(row && row.at);
  const from = truncateFrom(row && row.from);
  const parts = [];
  if (amt) parts.push(amt);
  if (when) parts.push(when);
  if (from) parts.push(`from ${from}`);
  return parts.join(' ');
}

export function fillRow({ sig, amountUi, at, from } = {}) {
  const signature = String(sig || '').trim();
  if (donateSigError(signature)) return null;
  const amount = Number(amountUi);
  const when = Number(at);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isFinite(when) || when <= 0) return null;
  return {
    sig: signature,
    amountUi: amount,
    at: when,
    from: truncateFrom(from),
  };
}

export function appendFill(list, input) {
  const prev = Array.isArray(list) ? list : [];
  const row = fillRow(input);
  if (!row) return { ok: false, list: prev, replay: false };
  if (prev.some((item) => item && item.sig === row.sig)) {
    return { ok: true, list: prev, replay: true };
  }
  const next = [...prev, row];
  return {
    ok: true,
    list: next.length > FAUCET_TAPE_KEEP ? next.slice(-FAUCET_TAPE_KEEP) : next,
    replay: false,
  };
}

export function collectInboundFills(entries, {
  treasury = FAUCET_TREASURY_DEFAULT,
  mint = FAUCET_MINT,
  existing = [],
  now = Date.now(),
  faucetSigner = '',
} = {}) {
  const have = new Set((Array.isArray(existing) ? existing : []).map((row) => row && row.sig).filter(Boolean));
  const out = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const sig = String(entry?.sig || '').trim();
    if (!sig || donateSigError(sig) || have.has(sig)) continue;
    const inspected = inspectDonateTx(entry.tx, {
      treasury,
      mint,
      faucetSigner,
      now,
      minRaw: 1n,
    });
    if (!inspected.ok) continue;
    const row = fillRow({
      sig,
      amountUi: donateAmountUi(inspected.amountRaw),
      at: inspected.at,
      from: inspected.payer,
    });
    if (!row) continue;
    have.add(sig);
    out.push(row);
  }
  return out;
}

export function listFills(list, { cap = FAUCET_TAPE_CAP } = {}) {
  const limit = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : FAUCET_TAPE_CAP;
  return (Array.isArray(list) ? list : [])
    .filter((row) => row && row.sig && !donateSigError(row.sig) && Number(row.amountUi) > 0 && Number(row.at) > 0)
    .slice()
    .sort((a, b) => Number(b.at) - Number(a.at) || String(b.sig).localeCompare(String(a.sig)))
    .slice(0, limit)
    .map((row) => ({
      sig: String(row.sig),
      amountUi: Number(row.amountUi),
      at: Number(row.at),
      from: truncateFrom(row.from),
    }));
}

/** In-memory tape tests can inject. Production persists the same list on the faucet DO. */
export function createTape(seed = []) {
  let fills = Array.isArray(seed) ? seed.slice() : [];
  return {
    append(input) {
      const out = appendFill(fills, input);
      fills = out.list;
      return out;
    },
    list(opts) {
      return listFills(fills, opts);
    },
    get raw() {
      return fills;
    },
    replace(next) {
      fills = Array.isArray(next) ? next.slice() : [];
    },
  };
}

function tapeHeaders() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-dasha-edge': 'faucet-tape',
    ...CORS,
  };
}

export function tapeApi(request, fills = []) {
  const url = new URL(request.url);
  if (!isFaucetTapePath(url.pathname)) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: tapeHeaders() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: tapeHeaders() });
  }
  const body = { ok: true, fills: listFills(fills) };
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(body), {
    status: 200,
    headers: tapeHeaders(),
  });
}

export const FILL_SHARE_ORIGIN = 'https://www.getdasha.com';
export const FILL_SHARE_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const FILL_SHARE_BUY = `https://jup.ag/tokens/${FILL_SHARE_MINT}`;
export const FILL_SHARE_OG = 'https://lobby.getdasha.com/og/dasha-social-card.png';

export function isBareFaucetFillPath(pathname) {
  const p = String(pathname || '');
  return p === '/faucet/fill' || p === '/faucet/fill/';
}

export function isFaucetFillPath(pathname) {
  const m = String(pathname || '').match(/^\/faucet\/fills?\/([^/]+)\/?$/);
  if (!m) return null;
  let sig = m[1];
  try { sig = decodeURIComponent(sig); } catch { /* keep raw */ }
  sig = String(sig || '').trim();
  return sig ? { sig } : null;
}

export function fillShareUrl(sig) {
  return `${FILL_SHARE_ORIGIN}/faucet/fill/${String(sig || '').trim()}`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fillShareHeadline(row) {
  return fillAmount(row && row.amountUi) || 'in.';
}

export function fillShareHtml(row) {
  const sig = String(row && row.sig || '').trim();
  if (!sig || donateSigError(sig)) return '';
  const url = fillShareUrl(sig);
  const title = fillShareHeadline(row);
  const desc = 'Claim. Fill. Buy.';
  const t = esc(title);
  const d = esc(desc);
  const u = esc(url);
  const buy = esc(FILL_SHARE_BUY);
  const og = esc(FILL_SHARE_OG);
  const scan = esc(`https://solscan.io/tx/${sig}`);
  const short = esc(truncateFrom(sig));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<link rel="canonical" href="${u}">
<meta name="description" content="${d}">
<meta name="theme-color" content="#070608">
<meta property="og:type" content="website">
<meta property="og:site_name" content="getdasha">
<meta property="og:url" content="${u}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${og}">
<style>:root{--ink:#070608;--paper:#f4eddb;--acid:#dfff00;--hot:#ff3b81;--line:rgba(244,237,219,.32)}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--ink);color:var(--paper)}
body{font:16px/1.45 Arial,Helvetica,sans-serif;min-height:100vh}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 18px;border-bottom:1px solid var(--line)}
.word{color:var(--paper);font:900 17px/1 Arial,Helvetica,sans-serif;letter-spacing:-.03em;text-transform:uppercase;text-decoration:none;min-height:48px;display:inline-flex;align-items:center}
.word b{color:var(--acid);font:inherit}
.buy,.go{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 18px;background:var(--acid);color:var(--ink);font:900 1rem/1 "Arial Black",Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;box-shadow:4px 4px 0 var(--hot)}
.buy:focus-visible,.word:focus-visible,.go:focus-visible,.sig a:focus-visible{outline:3px solid var(--acid);outline-offset:3px}
main{display:block;width:min(24rem,calc(100% - 32px));margin:0 auto;padding:48px 0 64px;text-align:center}
h1{margin:0 0 28px;font:900 clamp(2.6rem,10vw,4.8rem)/.95 "Arial Black",Arial,Helvetica,sans-serif}
.cta{margin:0 0 36px}
.go{width:100%;min-width:min(100%,16rem)}
.sig{margin:0}
.sig a{color:rgba(244,237,219,.76);min-height:48px;display:inline-flex;align-items:center;text-decoration:underline;text-underline-offset:3px}
</style>
</head>
<body>
<header class="bar"><a class="word" href="${esc(FILL_SHARE_ORIGIN)}/">$<b>dasha</b></a><a class="buy" href="${buy}" rel="noopener noreferrer">Buy</a></header>
<main>
<h1>${t}</h1>
<p class="cta"><a class="go" href="/faucet">Get 100</a></p>
<p class="sig"><a href="${scan}" rel="noopener noreferrer">${short}</a></p>
</main>
</body>
</html>`;
}

function fillHeaders() {
  return {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-dasha-edge': 'faucet-fill',
  };
}

export function fillShareApi(request, fills = []) {
  const url = new URL(request.url);
  if (isBareFaucetFillPath(url.pathname)) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: fillHeaders() });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: fillHeaders() });
    }
    return new Response(null, {
      status: 308,
      headers: { location: `${FILL_SHARE_ORIGIN}/faucet`, 'cache-control': 'no-store', 'x-dasha-edge': 'faucet-fill' },
    });
  }
  const parsed = isFaucetFillPath(url.pathname);
  if (!parsed) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: fillHeaders() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: fillHeaders() });
  }
  if (donateSigError(parsed.sig)) {
    return new Response(null, {
      status: 308,
      headers: { location: `${FILL_SHARE_ORIGIN}/faucet`, 'cache-control': 'no-store', 'x-dasha-edge': 'faucet-fill' },
    });
  }
  const row = listFills(fills).find((item) => item && item.sig === parsed.sig);
  if (!row) {
    return new Response(null, {
      status: 308,
      headers: { location: `${FILL_SHARE_ORIGIN}/faucet`, 'cache-control': 'no-store', 'x-dasha-edge': 'faucet-fill' },
    });
  }
  return new Response(request.method === 'HEAD' ? null : fillShareHtml(row), {
    status: 200,
    headers: fillHeaders(),
  });
}
