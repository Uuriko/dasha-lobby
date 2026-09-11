#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 1d5f3c49-0c50-42f2-84c8-6eb1a1063fea):
 * live /meme /memes /memestudio /meme-studio /meme_studio (+slash / Title-case)
 * html-404 → 308 home. Chart door also /price-chart /price_chart → home.
 * /coinmarketcap /coin_market_cap → /listings (sibling of /coingecko /cmc).
 * /peers /peer /uptime + /compute/peers /compute/uptime → /compute.
 * Docs face /readme → /compute/api (peer of /docs). Skip /roadmap.
 * Intentional skips stay null: /v1 /status /health /openai /x402 /discord
 * /roadmap /whitepaper /tokenomics /openrouter. Disk only. No Designer.
 * Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_HOME_308_PATHS/, 'home 308 set present');
assert.match(workerSrc, /POTTER_LISTINGS_308_PATHS/, 'listings 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(
  workerSrc,
  /Retired Meme Studio doors: live \/meme \/memes \/memestudio \/meme-studio \/meme_studio/,
  'home leftover comment lists meme family',
);

assert.match(
  workerSrc,
  /if \(p === ["']\/readme["'] \|\| p === ["\']\/readme\/["\']\) return ["']https:\/\/www\.getdasha\.com\/compute\/api["']/,
  'docs face leftover if folds /readme to /compute/api',
);

const homeSet = workerSrc.match(/const POTTER_HOME_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const listingsSet = workerSrc.match(/const POTTER_LISTINGS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

for (const path of [
  '/meme', '/memes', '/memestudio', '/meme-studio', '/meme_studio',
]) {
  assert.match(homeSet, new RegExp(`["\']${path}["\']`));
  assert.match(homeSet, new RegExp(`["\']${path}/["\']`));
}
// /price-chart /price_chart fold home via inline potterHome308Dest branch (same 308 dest as the set).
assert.match(workerSrc, /p === ["']\/price-chart["'] \|\| p === ["']\/price-chart\/["'] \|\| p === ["']\/price_chart["'] \|\| p === ["']\/price_chart\/["']/, 'inline /price-chart /price_chart home fold');
for (const path of ['/coinmarketcap', '/coin_market_cap']) {
  assert.match(listingsSet, new RegExp(`["\']${path}["\']`));
  assert.match(listingsSet, new RegExp(`["\']${path}/["\']`));
}
for (const path of ['/peers', '/peer', '/uptime', '/compute/peers', '/compute/uptime']) {
  assert.match(tab, new RegExp(`["\']${path}["\']`));
  assert.match(tab, new RegExp(`["\']${path}/["\']`));
}
assert.doesNotMatch(tab, /['"]\/compute\/peer['"]/, 'do not invent /compute/peer');
assert.doesNotMatch(tab, /['"]\/status['"]/, 'do not fold /status on compute-tab');
assert.doesNotMatch(tab, /['"]\/health['"]/, 'do not fold /health on compute-tab');
assert.doesNotMatch(tab, /['"]\/v1['"]/, 'do not fold /v1 on compute-tab');
assert.doesNotMatch(tab, /['"]\/openai['"]/, 'do not fold /openai on compute-tab');
assert.doesNotMatch(tab, /['"]\/x402['"]/, 'do not fold /x402 on compute-tab');
assert.doesNotMatch(homeSet, /['"]\/roadmap['"]/, 'do not invent /roadmap on home');
assert.doesNotMatch(listingsSet, /['"]\/roadmap['"]/, 'do not invent /roadmap on listings');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const HOME = `${WWW}/`;
const LISTINGS = `${WWW}/listings`;
const COMPUTE = `${WWW}/compute`;
const API = `${WWW}/compute/api`;

function variants(leaf) {
  const title = `/${leaf[0].toUpperCase()}${leaf.slice(1)}`;
  return [`/${leaf}`, `/${leaf}/`, title, `/${leaf.toUpperCase()}`, `${title}/`];
}

const TO_HOME = [
  ...['meme', 'memes', 'memestudio'].flatMap(variants),
  '/meme-studio', '/meme-studio/', '/Meme-studio', '/MEME-STUDIO', '/Meme-Studio/',
  '/meme_studio', '/meme_studio/', '/Meme_studio', '/MEME_STUDIO', '/Meme_Studio/',
  '/price-chart', '/price-chart/', '/Price-chart', '/PRICE-CHART', '/Price-Chart/',
  '/price_chart', '/price_chart/', '/Price_chart', '/PRICE_CHART', '/Price_Chart/',
];
const TO_LISTINGS = [
  '/coinmarketcap', '/coinmarketcap/', '/Coinmarketcap', '/COINMARKETCAP', '/CoinMarketCap/',
  '/coin_market_cap', '/coin_market_cap/', '/Coin_market_cap', '/COIN_MARKET_CAP', '/Coin_Market_Cap/',
];
const TO_COMPUTE = [
  ...['peers', 'peer', 'uptime'].flatMap(variants),
  '/compute/peers', '/compute/peers/', '/Compute/peers', '/COMPUTE/PEERS', '/Compute/Peers/',
  '/compute/uptime', '/compute/uptime/', '/Compute/uptime', '/COMPUTE/UPTIME', '/Compute/Uptime/',
];
const TO_API = ['/readme', '/readme/', '/Readme', '/README', '/Readme/'];
const DOCS_PEER = ['/docs', '/docs/', '/Docs'];
const STAY_NULL = [
  '/status', '/status/',
  '/health', '/health/',
  '/openai', '/openai/',
  '/x402', '/x402/',
  '/discord', '/discord/',
  '/roadmap', '/roadmap/',
  '/whitepaper', '/whitepaper/',
  '/tokenomics', '/tokenomics/',
  '/openrouter', '/openrouter/',
];

for (const path of TO_HOME) {
  assert.equal(potterHome308Dest(path), HOME, path);
}
for (const path of TO_LISTINGS) {
  assert.equal(potterHome308Dest(path), LISTINGS, path);
}
for (const path of TO_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of TO_API) {
  assert.equal(potterHome308Dest(path), API, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not bare /compute`);
}
for (const path of DOCS_PEER) {
  assert.equal(potterHome308Dest(path), API, `${path} still /compute/api`);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `stay null ${path}`);
}
assert.equal(potterHome308Dest('/studio'), HOME, '/studio still home');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays 200');
assert.equal(potterHome308Dest('/compute/peer'), null, 'do not invent /compute/peer');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  const u = new URL(dest);
  if (u.pathname === '/compute/api' || u.pathname.startsWith('/compute/api/')) {
    return LOBBY + u.pathname;
  }
  return dest;
}

const FETCH_SAMPLE = [
  ...['/meme', '/memes', '/Meme-studio', '/price-chart', '/Price_chart/'].map((path) => [path, HOME]),
  ...['/coinmarketcap', '/coin_market_cap/', '/CoinMarketCap'].map((path) => [path, LISTINGS]),
  ...['/peers', '/peer/', '/Uptime', '/compute/peers', '/Compute/uptime/'].map((path) => [path, COMPUTE]),
  ...['/readme', '/readme/', '/Readme'].map((path) => [path, API]),
];

const env = {
  LOBBY_SESSION_SECRET: 'meme-coinmarketcap-peers-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FETCH_SAMPLE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of STAY_NULL) {
    const dest = potterHome308Dest(path);
    assert.equal(dest, null, `${host} ${path} dest stays null`);
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.headers.get('location'), HOME, `${host} ${path} not folded home`);
    assert.notEqual(res.headers.get('location'), LISTINGS, `${host} ${path} not folded listings`);
    assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} not folded compute`);
    assert.notEqual(res.headers.get('location'), API, `${host} ${path} not folded api`);
    if (res.status === 308) {
      assert.notEqual(res.headers.get('location'), HOME, `${host} ${path} 308 dest is not home`);
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/meme', '/memes', '/memestudio', '/meme-studio', '/meme_studio',
  '/price-chart', '/price_chart',
  '/coinmarketcap', '/coin_market_cap',
  '/peers', '/peer', '/uptime', '/compute/peers', '/compute/uptime',
  '/readme', '/roadmap', '/v1', '/status', '/health', '/openai', '/x402',
  '/discord', '/whitepaper', '/tokenomics', '/openrouter',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-meme-coinmarketcap-peers-pretty-path: PASS (/meme+/memes+/memestudio+/meme-studio+/meme_studio+/price-chart+/price_chart 308 /; /coinmarketcap+/coin_market_cap 308 /listings; /peers+/peer+/uptime+/compute/peers+/compute/uptime 308 /compute; /readme 308 /compute/api; Title-case+slash; www+lobby GET+HEAD sample; /v1+/status+/health+/openai+/x402+/discord+/roadmap+/whitepaper+/tokenomics+/openrouter stay null; no plugin.jup.ag)');
