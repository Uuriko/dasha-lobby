/** /bag on-record mint lookup. Worker fetches Ansem. Browser never does. */

export const HERS_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const OTHER_MINT = 'FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8';
export const HERS_PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
export const HERS_LP = '8GDvsE3NbiKuo5uUFR9zgRY76mdhXuJfeDsy8hn7h3Aj';
export const HERS_BUY = `https://jup.ag/tokens/${HERS_MINT}`;
export const ANSEM_TIMEOUT_MS = 2500;
export const ANSEM_COIN_API = 'https://ansem.io/api/coins/';
export const ANSEM_COIN_PAGE = 'https://ansem.io/launch/coin/';

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, HEAD, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'access-control-max-age': '86400',
};

export function isBagRecordPath(pathname) {
  const p = String(pathname || '');
  return p === '/bag/api/record' || p === '/bag/api/record/';
}

export function normalizeMint(raw) {
  const mint = String(raw ?? '').trim();
  return MINT_RE.test(mint) ? mint : '';
}

export function ansemCoinUrl(mint) {
  return `${ANSEM_COIN_API}${mint}`;
}

export function ansemCoinPage(mint) {
  return `${ANSEM_COIN_PAGE}${mint}`;
}

function hersBody() {
  return {
    verdict: 'hers',
    mint: HERS_MINT,
    name: 'dash_eats',
    ticker: 'dasha',
    pair: HERS_PAIR,
    lp: HERS_LP,
    observed: '2026-08-18',
    mintDead: true,
    freezeDead: true,
    burnedLp: true,
    buy: HERS_BUY,
  };
}

function otherBody() {
  return {
    verdict: 'other-dasha',
    mint: OTHER_MINT,
    note: 'VVAIFU. Not this.',
  };
}

function neitherBody(mint) {
  return {
    verdict: 'neither',
    mint,
    note: 'Not hers. Not on that ledger.',
  };
}

function unknownBody(mint) {
  return {
    verdict: 'unknown',
    mint,
    error: 'Ledger quiet.',
  };
}

function onRecordBody(mint, coin) {
  const out = {
    verdict: 'on-record',
    mint: typeof coin.mint === 'string' && normalizeMint(coin.mint) ? coin.mint : mint,
    href: ansemCoinPage(typeof coin.mint === 'string' && normalizeMint(coin.mint) ? coin.mint : mint),
  };
  if (coin.name != null && coin.name !== '') out.name = coin.name;
  if (coin.ticker != null && coin.ticker !== '') out.ticker = coin.ticker;
  if (coin.tier != null && coin.tier !== '') out.tier = coin.tier;
  if (coin.status != null && coin.status !== '') out.status = coin.status;
  if (coin.airdropTotal != null && coin.airdropTotal !== '') out.airdropTotal = coin.airdropTotal;
  if (coin.airdropPct != null && coin.airdropPct !== '') out.airdropPct = coin.airdropPct;
  return out;
}

export async function lookupRecord(rawMint, fetchImpl = globalThis.fetch, timeoutMs = ANSEM_TIMEOUT_MS) {
  const mint = normalizeMint(rawMint);
  if (!mint) return { status: 400, body: { error: 'bad mint' } };
  if (mint === HERS_MINT) return { status: 200, body: hersBody() };
  if (mint === OTHER_MINT) return { status: 200, body: otherBody() };

  let res;
  let timer;
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const req = Promise.resolve(fetchImpl(ansemCoinUrl(mint), {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': 'dasha-lobby' },
      signal,
    }));
    const dead = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      const fail = () => reject(signal.reason || new Error('timeout'));
      if (signal.aborted) fail();
      else signal.addEventListener('abort', fail, { once: true });
    });
    dead.catch(() => {});
    res = await Promise.race([req, dead]);
    clearTimeout(timer);
  } catch {
    clearTimeout(timer);
    return { status: 200, body: unknownBody(mint) };
  }

  if (res.status === 404) return { status: 200, body: neitherBody(mint) };
  if (!res.ok || res.status >= 500) return { status: 200, body: unknownBody(mint) };

  let data;
  try {
    data = await res.json();
  } catch {
    return { status: 200, body: unknownBody(mint) };
  }
  const coin = data && typeof data === 'object'
    ? (data.coin && typeof data.coin === 'object' ? data.coin : data)
    : null;
  if (!coin || typeof coin !== 'object') return { status: 200, body: unknownBody(mint) };
  return { status: 200, body: onRecordBody(mint, coin) };
}

function jsonResponse(status, body, head = false) {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-dasha-edge': 'bag-record',
      ...CORS,
    },
  });
}

async function mintFromRequest(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('mint');
  if (q != null && String(q).trim()) return String(q);
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (body && typeof body.mint === 'string') return body.mint;
    } catch {
      return '';
    }
  }
  return '';
}

export async function bagRecordApi(request, env = {}, fetchImpl) {
  const url = new URL(request.url);
  if (!isBagRecordPath(url.pathname)) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        'x-dasha-edge': 'bag-record',
      },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
    return jsonResponse(405, { error: 'method' });
  }
  const fetchFn = fetchImpl || env.fetch || globalThis.fetch;
  const found = await lookupRecord(await mintFromRequest(request), fetchFn);
  return jsonResponse(found.status, found.body, request.method === 'HEAD');
}

export const BAG_SHARE_ORIGIN = 'https://www.getdasha.com';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function bagShareUrl(mint) {
  return `${BAG_SHARE_ORIGIN}/bag?mint=${mint}`;
}

export function bagCopyHtml(mint) {
  return `<p class="share"><a href="${esc(bagShareUrl(mint))}" data-copy>Copy link</a></p>`;
}

export function bagShareMeta(body, status = 200) {
  if (status === 400 || !body || !body.verdict || body.verdict === 'unknown') return null;
  if (body.verdict === 'hers') {
    return {
      title: '$dasha · hers',
      description: 'dash_eats. Mint-dead. Freeze-dead. Burned Raydium LP.',
    };
  }
  if (body.verdict === 'other-dasha') {
    return {
      title: 'Not this $dasha',
      description: 'VVAIFU. Not this.',
    };
  }
  if (body.verdict === 'on-record') {
    const bits = [];
    if (body.name != null && body.name !== '') bits.push(String(body.name));
    if (body.ticker != null && body.ticker !== '') bits.push(String(body.ticker));
    const title = bits.length ? bits.join(' · ') : 'On that ledger';
    return { title, description: title };
  }
  if (body.verdict === 'neither') {
    return {
      title: 'Not hers',
      description: 'Not hers. Not on that ledger.',
    };
  }
  return null;
}

export function bagVerdictHtml(body, status = 200) {
  if (status === 400 || (body && body.error === 'bad mint' && !body.verdict)) {
    return `<p>${esc(body?.error || 'Bad mint.')}</p>`;
  }
  const j = body || {};
  if (j.verdict === 'hers' && j.buy === HERS_BUY) {
    return `<p>Hers.</p><p>Mint-dead. Freeze-dead. Burned Raydium LP.</p><p><a href="${esc(j.buy)}" rel="noopener noreferrer">Open the associated mint on Jupiter</a></p>`;
  }
  if (j.verdict === 'other-dasha') {
    return `<p>${esc(j.note || 'Not this.')}</p><p><a href="/which">Which</a></p>`;
  }
  if (j.verdict === 'on-record') {
    const bits = [];
    if (j.name) bits.push(esc(j.name));
    if (j.ticker) bits.push(esc(j.ticker));
    let extra = bits.length ? `<p>${bits.join(' · ')}</p>` : '';
    if (j.tier) extra += `<p>${esc(j.tier)}</p>`;
    if (j.status) extra += `<p>${esc(j.status)}</p>`;
    if (j.airdropTotal != null && j.airdropTotal !== '') extra += `<p>${esc(j.airdropTotal)}</p>`;
    if (j.airdropPct != null && j.airdropPct !== '') extra += `<p>${esc(j.airdropPct)}</p>`;
    const href = typeof j.href === 'string' && j.href.indexOf(ANSEM_COIN_PAGE) === 0 ? j.href : '';
    if (href) extra += `<p><a href="${esc(href)}" rel="noopener noreferrer">On that ledger</a></p>`;
    return extra || '<p>On that ledger.</p>';
  }
  if (j.verdict === 'neither') {
    return `<p>${esc(j.note || 'Not hers. Not on that ledger.')}</p><p><a href="/bag">The bag</a></p>`;
  }
  return `<p>${esc(j.error || 'Ledger quiet.')}</p>`;
}

export function renderBagShareHtml(baseHtml, mint, found) {
  const status = found?.status ?? 200;
  const body = found?.body || {};
  const clean = normalizeMint(mint);
  const shown = clean || String(mint ?? '').trim();
  let html = String(baseHtml);
  const meta = clean ? bagShareMeta(body, status) : null;
  if (meta && clean) {
    const share = bagShareUrl(clean);
    html = html.replace('<title>$dasha · hers</title>', `<title>${esc(meta.title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(meta.description)}">`);
    html = html.replace('<link rel="canonical" href="https://www.getdasha.com/bag">', `<link rel="canonical" href="${esc(share)}">`);
    html = html.replace('<meta property="og:url" content="https://www.getdasha.com/bag">', `<meta property="og:url" content="${esc(share)}">`);
    html = html.replace('<meta property="og:title" content="$dasha · hers">', `<meta property="og:title" content="${esc(meta.title)}">`);
    html = html.replace('<meta property="og:description" content="Buy $dasha.">', `<meta property="og:description" content="${esc(meta.description)}">`);
    html = html.replace('<meta name="twitter:title" content="$dasha · hers">', `<meta name="twitter:title" content="${esc(meta.title)}">`);
    html = html.replace('<meta name="twitter:description" content="Buy $dasha.">', `<meta name="twitter:description" content="${esc(meta.description)}">`);
  }
  if (shown) {
    html = html.replace(
      '<input id="mint" name="mint" type="text" autocomplete="off" spellcheck="false" placeholder="mint" aria-label="mint">',
      `<input id="mint" name="mint" type="text" autocomplete="off" spellcheck="false" placeholder="mint" aria-label="mint" value="${esc(shown)}">`,
    );
    const inner = bagVerdictHtml(body, status) + (clean ? bagCopyHtml(clean) : '');
    html = html.replace('<div id="out" hidden></div>', `<div id="out" data-painted="1">${inner}</div>`);
  }
  return html;
}
