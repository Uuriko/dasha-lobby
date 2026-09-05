/**
 * Twice-daily crypto tape under the forum. Seed + RSS merge. No lecture.
 */
export const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
export const TG = 'https://t.me/+xB7S8mIQaKFiZjRh';
export const JUP_BUY = `https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}`;
export const DEX_HREF = `https://dexscreener.com/solana/${PAIR.toLowerCase()}`;
export const DEX_TOKEN_API = `https://api.dexscreener.com/latest/dex/tokens/${MINT}`;
export const DEX_PAIR_API = `https://api.dexscreener.com/latest/dex/pairs/solana/${PAIR}`;

export const RSS_FEEDS = [
  { source: 'CoinDesk', href: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { source: 'Decrypt', href: 'https://decrypt.co/feed' },
  { source: 'The Block', href: 'https://www.theblock.co/rss.xml' },
  { source: 'Cointelegraph', href: 'https://cointelegraph.com/rss' },
];

const SOLANA_SLOT = {
  source: 'Cointelegraph',
  kind: 'news',
  title: 'Solana cuts blockchain slot time to 350 milliseconds',
  href: 'https://cointelegraph.com/news/solana-cuts-blockchain-slot-time-350-milliseconds',
  at: 'Fri, 21 Aug 2026 13:45:13 +0000',
};

/** 5:27 PM PT 2026-09-04 scrape, curated. $dasha tick first. Real hrefs only. */
export const DEFAULT = {
  "at": "2026-09-05T00:35:46+00:00",
  "items": [
    {
      "source": "Dexscreener",
      "kind": "tape",
      "title": "$dasha $0.0003211 · -23.0% 24h · liq $68437.33",
      "href": "https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7",
      "at": "2026-09-05T00:35:46+00:00"
    },
    {
      "source": "@dash_eats",
      "kind": "tape",
      "title": "She's faking it",
      "href": "https://x.com/dash_eats/status/2095951530197135398",
      "at": "2026-09-04T19:06:00Z"
    },
    {
      "source": "@dash_eats",
      "kind": "tape",
      "title": "$dasha",
      "href": "https://x.com/dash_eats/status/2095926255942009032",
      "at": "2026-09-04T17:25:34Z"
    },
    {
      "source": "Cointelegraph",
      "kind": "news",
      "title": "BTC slips under 80K",
      "href": "https://cointelegraph.com/markets/surprise-labor-market-print-sends-bitcoin-back-below-80k",
      "at": "2026-09-04T20:30:47Z"
    },
    {
      "source": "Decrypt",
      "kind": "news",
      "title": "Polymarket launches perps",
      "href": "https://decrypt.co/377483/polymarket-crypto-perpetual-futures",
      "at": "2026-09-04T20:31:03Z"
    },
    {
      "source": "The Block",
      "kind": "news",
      "title": "Trump wants Hyperliquid in US",
      "href": "https://www.theblock.co/news/regulation/2026-09-04-trump-wants-hyperliquid-enter-us-how-it-could-happen-413594",
      "at": "2026-09-04T18:35:21Z"
    },
    {
      "source": "Decrypt",
      "kind": "news",
      "title": "ByteDance $30B AI loan",
      "href": "https://decrypt.co/377489/tiktok-bytedance-loan-ai",
      "at": "2026-09-04T21:46:03Z"
    },
    {
      "source": "CoinDesk",
      "kind": "news",
      "title": "Robinhood holds stock tokens",
      "href": "https://www.coindesk.com/business/2026/09/04/amc-ceo-tells-robinhood-to-stop-issuing-stock-token-as-industry-executives-weigh-in",
      "at": "2026-09-04T14:56:00Z"
    },
    {
      "source": "The Block",
      "kind": "news",
      "title": "Zcash tops $1k",
      "href": "https://www.theblock.co/news/markets/2026-09-04-zcash-tops-1000-etf-inflows-ramp-up-miners-pile-in-413580",
      "at": "2026-09-04T16:59:34Z"
    },
    {
      "source": "Decrypt",
      "kind": "news",
      "title": "G7 flags quantum threat",
      "href": "https://decrypt.co/377486/g7-warns-quantum-threat-crypto-fixes",
      "at": "2026-09-04T21:16:04Z"
    },
    {
      "source": "Cointelegraph",
      "kind": "news",
      "title": "FinCEN ties $13B scam compounds",
      "href": "https://cointelegraph.com/news/fincen-crypto-overseas-scam-centers-analysis",
      "at": "2026-09-04T19:22:26Z"
    },
    {
      "source": "CoinDesk",
      "kind": "news",
      "title": "UK platform opens crypto ETNs",
      "href": "https://www.coindesk.com/business/2026/09/04/from-warning-to-listing-uk-s-largest-wealth-platform-opens-access-to-crypto-etns",
      "at": "2026-09-04T14:23:11Z"
    },
    {
      "source": "CoinDesk",
      "kind": "news",
      "title": "Sheriffs go neutral on Clarity",
      "href": "https://www.coindesk.com/policy/2026/09/04/u-s-sheriff-s-association-shifts-opposition-stance-to-clarity-act-to-neutral",
      "at": "2026-09-04T14:12:34Z"
    }
  ]
};
const BUY_HREF = JUP_BUY;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(Number(n)); } catch { return ''; }
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function cleanHref(value) {
  let href = String(value || '').trim();
  if (!href) return '';
  href = decodeXml(href).replace(/&amp;/g, '&');
  if (/plugin\.jup\.ag/i.test(href)) return '';
  if (!/^https:\/\//i.test(href)) return '';
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:') return '';
    url.searchParams.delete('utm_source');
    url.searchParams.delete('utm_medium');
    url.searchParams.delete('utm_campaign');
    url.searchParams.delete('utm_content');
    url.searchParams.delete('utm_term');
    return url.toString();
  } catch {
    return '';
  }
}

export function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = String(raw.source || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const title = String(raw.title || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const href = cleanHref(raw.href || raw.link || raw.url);
  if (!source || !title || !href) return null;
  if (/plugin\.jup\.ag/i.test(href) || /plugin\.jup\.ag/i.test(title)) return null;
  const kind = raw.kind === 'tape' || /^\$dasha\b/i.test(title) ? 'tape' : 'news';
  const at = String(raw.at || raw.pubDate || raw.published || '').trim();
  return { source, kind, title, href, at };
}

export function normalizeItems(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const item = normalizeItem(raw);
    if (!item) continue;
    const key = item.href.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function itemTime(item) {
  const t = Date.parse(item?.at || '');
  return Number.isFinite(t) ? t : 0;
}

function isSolanaSlot(item) {
  return /solana-cuts-blockchain-slot-time-350-milliseconds/i.test(item?.href || '')
    || /solana cuts blockchain slot time to 350/i.test(item?.title || '');
}

/** Merge tick + RSS + seed. Tape first. Pin Solana 350ms. Cap ~10. */
export function mergeDigest(groups, { limit = 10 } = {}) {
  const lists = Array.isArray(groups) ? groups : [groups];
  const pool = [];
  for (const group of lists) {
    if (Array.isArray(group)) pool.push(...group);
    else if (group && typeof group === 'object') {
      if (Array.isArray(group.items)) pool.push(...group.items);
      if (group.tick) pool.push(group.tick);
    }
  }
  const items = normalizeItems(pool);
  const tape = items.filter((row) => row.kind === 'tape');
  const news = items.filter((row) => row.kind !== 'tape');
  news.sort((a, b) => itemTime(b) - itemTime(a));
  const slot = news.find(isSolanaSlot) || normalizeItem(SOLANA_SLOT);
  const rest = news.filter((row) => !isSolanaSlot(row));
  const ordered = [...tape, ...(slot ? [slot] : []), ...rest];
  return normalizeItems(ordered).slice(0, Math.max(1, Number(limit) || 10));
}

export function rssTag(block, name) {
  const src = String(block || '');
  const cdata = src.match(new RegExp(`<${name}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`, 'i'));
  if (cdata) return decodeXml(cdata[1]);
  const plain = src.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return plain ? decodeXml(plain[1]) : '';
}

export function parseRssItems(xml, source) {
  const items = [];
  const blocks = String(xml || '').match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = rssTag(block, 'title');
    const href = cleanHref(rssTag(block, 'link') || rssTag(block, 'guid'));
    const at = rssTag(block, 'pubDate') || rssTag(block, 'updated') || rssTag(block, 'dc:date');
    const item = normalizeItem({ source, kind: 'news', title, href, at });
    if (item) items.push(item);
  }
  return items;
}

export function parseRss(xml, source) {
  return parseRssItems(xml, source);
}

export function formatUsd(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return '';
  if (x >= 1) return x.toFixed(2);
  if (x >= 0.01) return x.toFixed(4);
  return x.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
}

export function tickFromDex(json) {
  const pairs = Array.isArray(json?.pairs) ? json.pairs
    : json?.pair ? [json.pair]
    : Array.isArray(json) ? json : [];
  const row = pairs.find((p) => String(p?.pairAddress || '') === PAIR) || pairs[0];
  if (!row) return null;
  const price = Number(row.priceUsd);
  if (!Number.isFinite(price) || price <= 0) return null;
  const ch = Number(row.priceChange?.h24);
  const liq = Number(row.liquidity?.usd);
  const bits = [`$dasha $${formatUsd(price)}`];
  if (Number.isFinite(ch)) bits.push(`${ch.toFixed(1)}% 24h`);
  if (Number.isFinite(liq)) bits.push(`liq $${liq.toFixed(2)}`);
  return normalizeItem({
    source: 'Dexscreener',
    kind: 'tape',
    title: bits.join(' · '),
    href: DEX_HREF,
    at: new Date().toISOString(),
  });
}

let tickCache = { at: 0, tick: null };
const TICK_TTL_MS = 60_000;

export function resetTickCache() {
  tickCache = { at: 0, tick: null };
}

export function hrefKey(href) {
  return String(href || '').replace(/\/$/, '').toLowerCase();
}

/** Live tick as row 1. Failed tick stays null. Never invents a number. */
export function applyLiveTick(pack, tick) {
  const base = pack && typeof pack === 'object' ? pack : DEFAULT;
  const items = normalizeItems(base.items);
  const live = normalizeItem(tick);
  if (!live || live.kind !== 'tape') {
    return { at: base.at || new Date().toISOString(), items, tick: null };
  }
  const rest = items.filter((row) => hrefKey(row.href) !== hrefKey(live.href));
  return { at: live.at || base.at || new Date().toISOString(), items: [live, ...rest], tick: live };
}

export function homeTapeWithTick(items, tick) {
  return homeTapeItems(applyLiveTick({ items }, tick).items);
}

export async function fetchLiveTick(fetcher = fetch) {
  const now = Date.now();
  if (tickCache.tick && now - tickCache.at < TICK_TTL_MS) return tickCache.tick;
  if (typeof fetcher !== 'function') return null;
  const opts = {
    signal: AbortSignal.timeout(6000),
    headers: { accept: 'application/json', 'user-agent': 'dasha-digest' },
  };
  for (const href of [DEX_PAIR_API, DEX_TOKEN_API]) {
    try {
      const res = await fetcher(href, opts);
      if (!res?.ok) continue;
      const tick = tickFromDex(await res.json());
      if (tick) {
        tickCache = { at: now, tick };
        return tick;
      }
    } catch {
      /* next source */
    }
  }
  return null;
}

const SECTION_CSS = `#dasha-digest{margin:3.25rem 0 0;padding:2.2rem 0 0;border-top:1px solid rgba(244,237,219,.18)}#dasha-digest h2{margin:0 0 1.15rem;font:900 clamp(1.35rem,3vw,2rem)/1 "Arial Black",Helvetica,Arial,sans-serif;letter-spacing:-.03em;text-transform:uppercase}#dasha-digest h2 a{margin-left:.7rem;color:var(--muted,#c8bea8);font:700 .82rem/1 Arial,Helvetica,sans-serif;letter-spacing:0;text-transform:none;text-decoration:none}#dasha-digest ol{list-style:none;margin:0;padding:0;display:grid;gap:.75rem}#dasha-digest li{margin:0;display:flex;flex-wrap:wrap;gap:.35rem .5rem;align-items:baseline}#dasha-digest .dd-src{color:var(--muted,#c8bea8);font:800 .72rem/1 Arial,Helvetica,sans-serif;letter-spacing:.07em;text-transform:uppercase}#dasha-digest a.dd-row{color:var(--acid,#dfff00);font:700 1.02rem/1.35 Arial,Helvetica,sans-serif;text-decoration:none}#dasha-digest a.dd-row:focus-visible,#dasha-digest h2 a:focus-visible{outline:3px solid var(--acid,#dfff00);outline-offset:3px}`;

export function digestSectionHtml(items, { pageHref = '/digest' } = {}) {
  const rows = normalizeItems(items);
  if (!rows.length) return '';
  const permalink = pageHref ? `<a href="${escapeHtml(pageHref)}">/digest</a>` : '';
  const lis = rows.map((row) => (
    `<li><span class="dd-src">${escapeHtml(row.source)}</span> · <a class="dd-row" href="${escapeHtml(row.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.title)}</a></li>`
  )).join('');
  return `<section id="dasha-digest"><style>${SECTION_CSS}</style><h2>Tape.${permalink}</h2><ol>${lis}</ol></section>`;
}

const PAGE_CSS = `:root{--ink:#070608;--paper:#f4eddb;--acid:#dfff00;--hot:#ff3b81;--line:rgba(244,237,219,.32)}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--ink);color:var(--paper)}
body{font:16px/1.45 Arial,Helvetica,sans-serif;min-height:100vh}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 18px;border-bottom:1px solid var(--line)}
.word{color:var(--paper);font:900 17px/1 Arial,Helvetica,sans-serif;letter-spacing:-.03em;text-transform:uppercase;text-decoration:none;min-height:48px;display:inline-flex;align-items:center}
.word b{color:var(--acid);font:inherit}
.buy{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 16px;background:var(--acid);color:var(--ink);font:900 1rem/1 "Arial Black",Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;box-shadow:4px 4px 0 var(--hot)}
.buy:focus-visible,.word:focus-visible{outline:3px solid var(--acid);outline-offset:3px}
main{display:block;width:min(40rem,calc(100% - 32px));margin:0 auto;padding:28px 0 64px}
${SECTION_CSS}
#dasha-digest{margin:0;padding:0;border-top:0}`;

/** Leftover /digest duplicate #dasha-digest section <style> after PAGE_CSS already
 * serializes the same SECTION_CSS + flush reset. Inner style fights the reset
 * (home-tape chrome on the tape page). Humans see duplicate #dasha-digest rules
 * in view-source. Home/lobby inner <style> stay. Home remount + /digest.json stay.
 * Tape h2 + .dd-src + .dd-row stay.
 */
export function isDigestLeftoverDupSectionCssPage(html) {
  const src = String(html || '');
  if (/id=["']dasha-home["']/.test(src) || /id=["']chat-door["']/.test(src) || /id=["']grwm["']/.test(src)) return false;
  if (/id=["']dasha-lobby["']/.test(src) || /id=["']forum-play-go["']/.test(src)) return false;
  return /#dasha-digest\{margin:0;padding:0;border-top:0\}/.test(src)
    && /<section id=["']dasha-digest["']><style>/i.test(src);
}

export function stripDigestLeftoverDupSectionCss(html) {
  let out = String(html || '');
  if (!isDigestLeftoverDupSectionCssPage(out)) return out;
  return out.replace(/<section id=["']dasha-digest["']><style>[\s\S]*?<\/style>/i, '<section id="dasha-digest">');
}

export const DIGEST_TITLE = '$dasha Tape';
export const DIGEST_DESC = 'Tick. Room. Buy.';
export const DIGEST_OG_IMAGE = 'https://lobby.getdasha.com/og/dasha-social-card.png';
export const DIGEST_URL = 'https://www.getdasha.com/digest';

/** Live tick title when Worker has one. Else the static few-word card. */
export function digestOgDescription(tick) {
  const live = normalizeItem(tick);
  if (live && live.kind === 'tape' && live.title) return live.title;
  return DIGEST_DESC;
}

export function digestPageHtml(items, opts = {}) {
  const rows = normalizeItems(items);
  const list = rows.length ? rows : DEFAULT.items;
  const section = digestSectionHtml(list, { pageHref: '' });
  const desc = escapeHtml(digestOgDescription(opts.tick));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${DIGEST_TITLE}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${DIGEST_URL}">
<meta name="theme-color" content="#070608">
<meta property="og:type" content="website">
<meta property="og:url" content="${DIGEST_URL}">
<meta property="og:title" content="${DIGEST_TITLE}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${DIGEST_OG_IMAGE}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${DIGEST_TITLE}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${DIGEST_OG_IMAGE}">
<style>${PAGE_CSS}</style>
</head>
<body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="buy" href="${BUY_HREF}">Buy</a></header>
<main>${section}</main>
</body>
</html>`;
}

export const HOME_TAPE_LIMIT = 5;

export function homeTapeItems(items) {
  return normalizeItems(items).slice(0, HOME_TAPE_LIMIT);
}

function insertAfterIded(html, id, insertion) {
  const src = String(html || '');
  const openRe = new RegExp(`<([a-zA-Z][\\w-]*)\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i');
  const m = openRe.exec(src);
  if (!m) return null;
  const tag = m[1];
  const closeTok = `</${tag}>`;
  const close = src.toLowerCase().indexOf(closeTok, m.index + m[0].length);
  if (close < 0) return null;
  const end = close + closeTok.length;
  return src.slice(0, end) + insertion + src.slice(end);
}

/** Home: after #grok-door, else #grwm, else </main>, else <footer, else append. Keep footer.dasha-foot. Empty items no-op. */
export function injectDigestSection(html, items, opts) {
  const src = String(html || '');
  if (/id=["']dasha-digest["']/.test(src)) return src;
  const section = digestSectionHtml(items, opts);
  if (!section) return src;
  const afterGrok = insertAfterIded(src, 'grok-door', section);
  if (afterGrok) return afterGrok;
  const afterGrwm = insertAfterIded(src, 'grwm', section);
  if (afterGrwm) return afterGrwm;
  if (/<\/div>\s*<footer class="dasha-foot">/.test(src)) {
    return src.replace(/<\/div>(\s*)<footer class="dasha-foot">/, `</div>$1${section}$1<footer class="dasha-foot">`);
  }
  if (/<\/main>/i.test(src)) return src.replace(/<\/main>/i, `${section}</main>`);
  if (/<footer\b/i.test(src)) return src.replace(/<footer\b/i, `${section}<footer`);
  return src + section;
}

const REMOUNT_CSS = SECTION_CSS.replace(/#dasha-digest/g, '#__TAPE__');

/** Client remount after server Tape. HEAD only.
 * Fetches /digest.json, puts live `tick` as row 1, then a quiet Crew line.
 * Crew stays hidden if the remount fetch fails.
 * Leftover window.Webflow.push dropped after webflow.js was already DOM-stripped.
 * Leftover remount querySelector('footer') dropped after home footer was already DOM-stripped.
 * Leftover remount on /lobby dropped after boot is home-only.
 * grok-door / grwm / main insert paths stay.
 */
export function digestRemountScript() {
  return `(function(){
    var LIMIT=${HOME_TAPE_LIMIT};
    var CSS=${JSON.stringify(REMOUNT_CSS)};
    function tapeId(){return 'dasha-'+'digest';}
    function crewId(){return 'dasha-'+'crew-line';}
    function cleanHref(h){
      h=String(h||'').trim();
      if(!h||/plugin\\.jup\\.ag/i.test(h)||!/^https:\\/\\//i.test(h))return '';
      try{var u=new URL(h);if(u.protocol!=='https:')return '';return u.toString();}catch(e){return '';}
    }
    function rows(items){
      var out=[],seen=Object.create(null);
      if(!items||!items.length)return out;
      for(var i=0;i<items.length&&out.length<LIMIT+2;i++){
        var it=items[i]||{};
        var src=String(it.source||'').replace(/\\s+/g,' ').trim().slice(0,40);
        var title=String(it.title||'').replace(/\\s+/g,' ').trim().slice(0,220);
        var href=cleanHref(it.href||it.link||it.url);
        if(!src||!title||!href)continue;
        if(/plugin\\.jup\\.ag/i.test(title))continue;
        var key=href.replace(/\\/$/,'').toLowerCase();
        if(seen[key])continue;
        seen[key]=1;
        out.push({source:src,title:title,href:href});
      }
      return out;
    }
    function firstRows(items,tick){
      var list=rows(items);
      var live=tick?rows([tick])[0]:null;
      if(live){
        list=list.filter(function(r){return r.href!==live.href});
        list.unshift(live);
      }
      return list.slice(0,LIMIT);
    }
    function fillOl(ol,list){
      while(ol.firstChild)ol.removeChild(ol.firstChild);
      for(var i=0;i<list.length;i++){
        var r=list[i];
        var li=document.createElement('li');
        var span=document.createElement('span');
        span.className='dd-src';
        span.appendChild(document.createTextNode(r.source));
        var a=document.createElement('a');
        a.className='dd-row';
        a.setAttribute('href',r.href);
        a.setAttribute('target','_blank');
        a.setAttribute('rel','noopener noreferrer');
        a.appendChild(document.createTextNode(r.title));
        li.appendChild(span);
        li.appendChild(document.createTextNode(' \u00b7 '));
        li.appendChild(a);
        ol.appendChild(li);
      }
    }
    function crewAfter(tape){
      if(!tape||!tape.parentNode)return;
      if(document.getElementById(crewId()))return;
      if(!document.getElementById('dasha-crew-line-css')){
        var cs=document.createElement('style');
        cs.id='dasha-crew-line-css';
        cs.appendChild(document.createTextNode('#'+crewId()+'{margin:.85rem 0 0;color:var(--muted,#c8bea8);font:700 .95rem/1.35 Arial,Helvetica,sans-serif}#'+crewId()+' a{color:var(--acid,#dfff00);text-decoration:none}#'+crewId()+' a:focus-visible{outline:3px solid var(--acid,#dfff00);outline-offset:3px}'));
        document.head.appendChild(cs);
      }
      var p=document.createElement('p');
      p.id=crewId();
      var a=document.createElement('a');
      a.setAttribute('href','/crew');
      a.appendChild(document.createTextNode('Crew. You keep the keys.'));
      p.appendChild(a);
      tape.parentNode.insertBefore(p,tape.nextSibling);
    }
    function paint(items,tick){
      var list=firstRows(items,tick);
      if(!list.length)return false;
      var id=tapeId();
      var sec=document.getElementById(id);
      if(sec){
        var ol=sec.querySelector('ol');
        if(!ol){ol=document.createElement('ol');sec.appendChild(ol);}
        fillOl(ol,list);
        crewAfter(sec);
        return true;
      }
      var css=CSS.replace(/#__TAPE__/g,'#'+id);
      sec=document.createElement('section');
      sec.id=id;
      var style=document.createElement('style');
      style.appendChild(document.createTextNode(css));
      var h2=document.createElement('h2');
      h2.appendChild(document.createTextNode('Tape.'));
      var perma=document.createElement('a');
      perma.setAttribute('href','/digest');
      perma.appendChild(document.createTextNode('/digest'));
      h2.appendChild(perma);
      var ol=document.createElement('ol');
      fillOl(ol,list);
      sec.appendChild(style);
      sec.appendChild(h2);
      sec.appendChild(ol);
      var grok=document.getElementById('grok-door')||document.querySelector('#grok-door');
      var grwm=document.getElementById('grwm');
      var main=document.querySelector('main');
      if(grok&&grok.parentNode)grok.parentNode.insertBefore(sec,grok.nextSibling);
      else if(grwm&&grwm.parentNode)grwm.parentNode.insertBefore(sec,grwm.nextSibling);
      else if(main)main.appendChild(sec);
      crewAfter(sec);
      return true;
    }
    function go(){
      fetch('/digest.json',{credentials:'same-origin'}).then(function(r){
        return r.ok?r.json():null;
      }).then(function(pack){
        if(!pack)return;
        paint(pack.items,pack.tick);
      }).catch(function(){});
    }
    function boot(){
      var path=location.pathname||'/';
      if(path!=='/'&&path!=='')return;
      function run(){
        requestAnimationFrame(function(){
          go();
        });
      }
      if(document.readyState==='complete')run();
      else window.addEventListener('load',run);
    }
    boot();
  })();`;
}

/** Leftover remount on /lobby after boot is home-only (`path!=='/'` return).
 * Humans see #dasha-digest-remount in lobby view-source after CSS/JS strip.
 * Home remount + /digest.json stay. #dasha-forum / #forum-play-go stay.
 */
export function isLobbyLeftoverDigestRemountPage(html) {
  const src = String(html || '');
  if (/id=["']dasha-home["']/.test(src) || /id=["']chat-door["']/.test(src)) return false;
  return /id=["']dasha-lobby["']/.test(src)
    || /id=["']forum-play-go["']/.test(src)
    || /id=["']dasha-forum["']/.test(src);
}

export function stripLobbyLeftoverDigestRemount(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverDigestRemountPage(out)) return out;
  return out.replace(/<script\b[^>]*id=["']dasha-digest-remount["'][^>]*>[\s\S]*?<\/script>/gi, '');
}

export function injectDigestRemount(html) {
  const src = stripLobbyLeftoverDigestRemount(html);
  if (isLobbyLeftoverDigestRemountPage(src)) return src;
  const tag = `<script id="dasha-digest-remount">${digestRemountScript()}</script>`;
  if (/id=["']dasha-digest-remount["']/.test(src)) {
    return src.replace(/<script\b[^>]*id=["']dasha-digest-remount["'][^>]*>[\s\S]*?<\/script>/i, tag);
  }
  if (/id=["']dasha-home-chrome-hide["']/.test(src)) {
    return src.replace(/(<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>)/i, `$1${tag}`);
  }
  if (/id=["']dasha-mobile-scroll["']/.test(src)) {
    return src.replace(/(<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>)/i, `$1${tag}`);
  }
  return /<\/head>/i.test(src) ? src.replace(/<\/head>/i, `${tag}</head>`) : tag + src;
}

export async function collectDigest(fetcher = fetch) {
  const opts = {
    signal: AbortSignal.timeout(8000),
    headers: { accept: 'application/rss+xml, application/xml, text/xml, application/json', 'user-agent': 'dasha-digest' },
  };
  const lists = await Promise.all(RSS_FEEDS.map(async (feed) => {
    try {
      const res = await fetcher(feed.href, opts);
      if (!res.ok) return [];
      return parseRssItems(await res.text(), feed.source);
    } catch {
      return [];
    }
  }));
  let tick = null;
  try {
    const res = await fetcher(DEX_TOKEN_API, opts);
    if (res.ok) tick = tickFromDex(await res.json());
  } catch {
    tick = null;
  }
  const items = mergeDigest([tick ? [tick] : [], ...lists, DEFAULT.items], { limit: 10 });
  return applyLiveTick({ at: new Date().toISOString(), items }, tick);
}
