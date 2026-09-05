/** Dasha Crew — five public jobs. Cache ~60s. Fail → sit. Never invent a P&L. */
export const CREW_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const CREW_PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
export const CREW_WSOL = 'So11111111111111111111111111111111111111112';
export const CREW_BUY = `https://jup.ag/swap?sell=${CREW_WSOL}&buy=${CREW_MINT}`;
export const CREW_TG = 'https://t.me/+xB7S8mIQaKFiZjRh';

export const CREW_JOB_OG = {
  scout: { title: 'Scout · Dasha Crew', description: '$dasha tape only.' },
  trace: { title: 'Trace · Dasha Crew', description: 'Public holders / flow on that mint.' },
  vibe: { title: 'Vibe · Dasha Crew', description: 'Lobby / @dash_eats.' },
  clock: { title: 'Clock · Dasha Crew', description: 'Sit if the tape is dumping.' },
  kill: { title: 'Kill · Dasha Crew', description: 'Default no. Only job is no.' },
};

/** Server-paint /crew?job=scout (hash is client-only). Unknown job keeps page OG. */
export function applyCrewShareOg(html, requestUrl) {
  const url = new URL(requestUrl, 'https://www.getdasha.com');
  const job = String(url.searchParams.get('job') || '').toLowerCase();
  const og = CREW_JOB_OG[job];
  if (!og) return html;
  const pageUrl = `https://www.getdasha.com/crew?job=${job}`;
  return String(html)
    .replace(/<title>[^<]*<\/title>/, `<title>${og.title}</title>`)
    .replace(/rel="canonical" href="[^"]*"/, `rel="canonical" href="${pageUrl}"`)
    .replace(/property="og:url" content="[^"]*"/, `property="og:url" content="${pageUrl}"`)
    .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${og.title}"`)
    .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${og.description}"`)
    .replace(/name="twitter:title" content="[^"]*"/, `name="twitter:title" content="${og.title}"`)
    .replace(/name="twitter:description" content="[^"]*"/, `name="twitter:description" content="${og.description}"`);
}

export const CREW_CACHE_MS = 60_000;
export const CREW_LOG_MAX = 20;

const PROMPTS = {
  scout: 'You are Scout. $dasha tape only. Mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. Pair 9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7. Read public price, liquidity, volume, change on that pair. Do not invent a candle. No tape → sit. You do not hold keys.',
  trace: 'You are Trace. Public holders and flow on the $dasha mint only. Mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. Read buys, sells, top holders from public HTTP/RPC. No flow → sit. You do not hold keys. You do not invent a wallet list.',
  vibe: 'You are Vibe. Read the room: lobby, @dash_eats, official TG https://t.me/+xB7S8mIQaKFiZjRh. Public pages only. Rooms down → sit. You do not post. You do not hold those keys.',
  clock: 'You are Clock. If the tape is dumping, sit. Dump = 1h ≤ −5% or 24h ≤ −15%. No tape → sit. You do not buy the dip. You sit.',
  kill: 'You are Kill. Default no. Your only job is no. You never hold keys. You never say yes. If the others get loud, you still say no.',
};

const JOBS = {
  scout: '$dasha tape only',
  trace: 'public holders / flow',
  vibe: 'lobby / @dash_eats',
  clock: 'sit if the tape is dumping',
  kill: 'default no',
};

const NAMES = { scout: 'Scout', trace: 'Trace', vibe: 'Vibe', clock: 'Clock', kill: 'Kill' };

let cache = { at: 0, card: null };
const log = [];

function agent(id, vote, note) {
  return {
    id,
    name: NAMES[id],
    job: JOBS[id],
    vote,
    note,
    prompt: PROMPTS[id],
  };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function verdictOf(agents) {
  const votes = Object.fromEntries(agents.map((row) => [row.id, row.vote]));
  if (votes.clock === 'sit') return 'sit';
  if (votes.scout === 'sit' || votes.trace === 'sit') return 'sit';
  if (votes.scout === 'yes' && votes.trace === 'yes' && votes.vibe === 'yes' && votes.clock === 'yes') return 'yes';
  return 'no';
}

function sitCard(note = 'Public reads failed. Sit.') {
  const agents = [
    agent('scout', 'sit', note),
    agent('trace', 'sit', note),
    agent('vibe', 'sit', note),
    agent('clock', 'sit', note),
    agent('kill', 'no', 'No.'),
  ];
  return {
    agents,
    verdict: 'sit',
    mint: CREW_MINT,
    pair: CREW_PAIR,
    buy: CREW_BUY,
    at: new Date().toISOString(),
  };
}

async function readJson(fetchImpl, url, timeoutMs = 6000) {
  const res = await fetchImpl(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', 'user-agent': 'dasha-lobby' },
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
}

async function readStatus(fetchImpl, url, timeoutMs = 5000) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetchImpl(url, {
        method,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'dasha-lobby' },
        redirect: 'manual',
      });
      return res.status;
    } catch {
      /* try next */
    }
  }
  return 0;
}

function tapeFromDex(pair) {
  if (!pair) return null;
  const mint = pair?.baseToken?.address || '';
  if (mint && mint !== CREW_MINT) return null;
  const priceUsd = num(pair.priceUsd);
  if (!priceUsd || priceUsd <= 0) return null;
  const h24 = pair.txns?.h24 || {};
  return {
    priceUsd,
    liquidityUsd: num(pair.liquidity?.usd),
    volume24hUsd: num(pair.volume?.h24),
    changeH1: num(pair.priceChange?.h1),
    changeH24: num(pair.priceChange?.h24),
    buys24: Number(h24.buys || 0),
    sells24: Number(h24.sells || 0),
  };
}

function tapeFromGecko(attrs) {
  const priceUsd = num(attrs?.base_token_price_usd);
  if (!priceUsd || priceUsd <= 0) return null;
  return {
    priceUsd,
    liquidityUsd: num(attrs.reserve_in_usd),
    volume24hUsd: num(attrs.volume_usd?.h24),
    changeH1: num(attrs.price_change_percentage?.h1),
    changeH24: num(attrs.price_change_percentage?.h24),
    buys24: 0,
    sells24: 0,
  };
}

async function readTape(fetchImpl) {
  try {
    const dex = await readJson(fetchImpl, `https://api.dexscreener.com/latest/dex/pairs/solana/${CREW_PAIR}`);
    const fromPair = tapeFromDex(dex?.pair || (Array.isArray(dex?.pairs) ? dex.pairs.find((row) => row?.pairAddress === CREW_PAIR) : null));
    if (fromPair) return fromPair;
  } catch { /* next public tape */ }
  try {
    const dex = await readJson(fetchImpl, `https://api.dexscreener.com/latest/dex/tokens/${CREW_MINT}`);
    const fromToken = tapeFromDex((dex?.pairs || []).find((row) => row?.pairAddress === CREW_PAIR));
    if (fromToken) return fromToken;
  } catch { /* next public tape */ }
  try {
    const gecko = await readJson(fetchImpl, `https://api.geckoterminal.com/api/v2/networks/solana/pools/${CREW_PAIR}`);
    const fromGecko = tapeFromGecko(gecko?.data?.attributes);
    if (fromGecko) return fromGecko;
  } catch { /* sit if every public tape fails */ }
  return null;
}

async function readHolders(fetchImpl, env = {}) {
  const rpc = String(env.SOLANA_RPC_URL || '').trim();
  if (!rpc.startsWith('https://')) return null;
  try {
    const res = await fetchImpl(rpc, {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
      headers: { 'content-type': 'application/json', 'user-agent': 'dasha-crew' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenLargestAccounts',
        params: [CREW_MINT, { commitment: 'confirmed' }],
      }),
    });
    const data = await res.json();
    const rows = data?.result?.value;
    return Array.isArray(rows) ? rows.length : null;
  } catch {
    return null;
  }
}

export function crewVerdict(agents) {
  return verdictOf(agents);
}

export async function runCrewOnce(env = {}, fetchImpl = globalThis.fetch, opts = {}) {
  try {
    const [snap, top, lobby, simp, tg] = await Promise.all([
      readTape(fetchImpl).catch(() => null),
      readHolders(fetchImpl, env),
      opts.served ? Promise.resolve(200) : readStatus(fetchImpl, 'https://lobby.getdasha.com/'),
      opts.served ? Promise.resolve(200) : readStatus(fetchImpl, 'https://www.getdasha.com/simp'),
      readStatus(fetchImpl, CREW_TG),
    ]);

    let scout;
    let trace;
    let clock;
    if (!snap) {
      scout = agent('scout', 'sit', 'No tape.');
      trace = agent('trace', 'sit', 'No flow without tape.');
      clock = agent('clock', 'sit', 'No tape.');
    } else {
      scout = agent(
        'scout',
        'yes',
        `price ${snap.priceUsd} · liq ${snap.liquidityUsd} · vol24 ${snap.volume24hUsd} · 1h ${snap.changeH1}% · 24h ${snap.changeH24}%`,
      );
      const liveFlow = snap.buys24 + snap.sells24 > 0 || (top || 0) > 0;
      let flow = `buys24 ${snap.buys24} · sells24 ${snap.sells24}`;
      if (top != null) flow += ` · top accounts ${top}`;
      trace = agent('trace', liveFlow ? 'yes' : 'sit', liveFlow ? flow : 'No public flow.');
      const dump = (snap.changeH1 != null && snap.changeH1 <= -5) || (snap.changeH24 != null && snap.changeH24 <= -15);
      clock = agent(
        'clock',
        dump ? 'sit' : 'yes',
        dump ? 'Dump. Sit.' : `1h ${snap.changeH1}% · 24h ${snap.changeH24}%`,
      );
    }

    const rooms = [];
    if (lobby === 200) rooms.push('lobby');
    if (tg === 200) rooms.push('tg');
    const vibe = agent(
      'vibe',
      lobby === 200 && simp === 200 ? 'yes' : 'sit',
      rooms.length ? `${rooms.join(' · ')} · @dash_eats` : 'Rooms quiet.',
    );
    const kill = agent('kill', 'no', 'No.');
    const agents = [scout, trace, vibe, clock, kill];
    return {
      agents,
      verdict: verdictOf(agents),
      mint: CREW_MINT,
      pair: CREW_PAIR,
      buy: CREW_BUY,
      at: new Date().toISOString(),
    };
  } catch {
    return sitCard();
  }
}

function remember(card) {
  cache = { at: Date.now(), card };
  log.unshift(card);
  if (log.length > CREW_LOG_MAX) log.length = CREW_LOG_MAX;
}

export async function crewOnceCached(env = {}, fetchImpl = globalThis.fetch) {
  const now = Date.now();
  if (cache.card && now - cache.at < CREW_CACHE_MS) return cache.card;
  const card = await runCrewOnce(env, fetchImpl, { served: true });
  remember(card);
  return card;
}

export function crewLog() {
  return { cards: log.slice(0, CREW_LOG_MAX) };
}

export function isCrewApiPath(pathname) {
  return pathname === '/crew/api/once' || pathname === '/crew/api/log';
}

export function isCrewPagePath(pathname) {
  return pathname === '/crew' || pathname === '/crew/' || pathname === '/crew/index.html';
}

function crewJson(body, request, extra = {}) {
  const head = request.method === 'HEAD';
  return new Response(head ? null : JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      'cache-control': 'public, max-age=60',
      'x-dasha-edge': extra.edge || 'crew-api',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function crewApi(request, env = {}, fetchImpl = globalThis.fetch) {
  const url = new URL(request.url);
  if (!isCrewApiPath(url.pathname)) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, HEAD, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
        'access-control-max-age': '86400',
        'x-dasha-edge': 'crew-api',
      },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'x-dasha-edge': 'crew-api',
      },
    });
  }
  if (url.pathname === '/crew/api/log') return crewJson(crewLog(), request, { edge: 'crew-log' });
  const card = await crewOnceCached(env, fetchImpl);
  return crewJson(card, request, { edge: 'crew-once' });
}

/** Test helper: drop isolate cache. */
export function resetCrewCache() {
  cache = { at: 0, card: null };
  log.length = 0;
}
