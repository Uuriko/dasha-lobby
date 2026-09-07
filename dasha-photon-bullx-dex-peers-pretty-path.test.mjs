#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 66440d1c-ddc7-4f6f-b6a1-bc97ec97b67d):
 * live /photon /bullx /axiom /trojan /gmgn /defined /solanafm /solana-fm
 * /solana_fm (+slash / Title-case) html-404 → 308 /listings.
 * Peers of /dexscreener /solscan. Dest slash /listings/ 308 → /listings.
 * live /phoenix /lifinity /openbook /drift /serum /pump /pumpswap /pump-swap
 * /pump_swap /jup (+slash / Title-case) html-404 → 308 /how-to-buy.
 * Peers of /orca /meteora /pumpfun /jupiter.
 * Exact /listings + /how-to-buy stay 200. Title-case /Listings product-casefolds.
 * On-site dest only — never plugin.jup.ag or external DEX hosts from Worker
 * redirects. Skip /explorer /faq /waitlist /terms /blog /careers /hiring
 * /openai /discord /roadmap /whitepaper /tokenomics /x402 /openrouter
 * /status /health /healthz /v1. Disk only. No Designer.
 * PR-mirror only — no wrangler deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest, listingsJsonBody } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_LISTINGS_308_PATHS/, 'listings 308 set present');
assert.match(workerSrc, /POTTER_HOWTO_308_PATHS/, 'howto 308 set present');

assert.match(
  workerSrc,
  /never Jupiter plugin host \/ external DEX hosts/,
  'howto leftover comment forbids external DEX hosts',
);

const listingsSet = workerSrc.match(/const POTTER_LISTINGS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const howtoSet = workerSrc.match(/const POTTER_HOWTO_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/dexscreener', '/solscan',
  '/photon', '/bullx', '/axiom', '/trojan', '/gmgn', '/defined',
  '/solanafm', '/solana-fm', '/solana_fm',
]) {
  assert.match(listingsSet, new RegExp(`["\']${path}["\']`));
  assert.match(listingsSet, new RegExp(`["\']${path}/["\']`));
}
assert.match(listingsSet, /["']\/listings\/["']/);
assert.doesNotMatch(listingsSet, /['"]\/listings['"]/, 'exact /listings stays 200');
for (const path of [
  '/explorer', '/faq', '/waitlist', '/terms', '/blog', '/careers', '/hiring',
  '/openai', '/discord', '/roadmap', '/whitepaper', '/tokenomics', '/x402',
  '/openrouter', '/status', '/health', '/healthz', '/v1',
]) {
  assert.doesNotMatch(listingsSet, new RegExp(`['"]${path}['"]`), `do not fold ${path}`);
  assert.doesNotMatch(howtoSet, new RegExp(`['"]${path}['"]`), `do not fold ${path} into howto`);
}
for (const path of [
  '/orca', '/meteora', '/pumpfun', '/jupiter',
  '/phoenix', '/lifinity', '/openbook', '/drift', '/serum',
  '/pump', '/pumpswap', '/pump-swap', '/pump_swap', '/jup',
]) {
  assert.match(howtoSet, new RegExp(`["\']${path}["\']`));
  assert.match(howtoSet, new RegExp(`["\']${path}/["\']`));
}
assert.doesNotMatch(howtoSet, /plugin\.jup\.ag/, 'howto set has no plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const LISTINGS = `${WWW}/listings`;
const HOWTO = `${WWW}/how-to-buy`;

const TO_LISTINGS = [
  '/photon', '/photon/', '/Photon', '/PHOTON', '/pHoToN/',
  '/bullx', '/bullx/', '/Bullx', '/BULLX', '/BuLlX/',
  '/axiom', '/axiom/', '/Axiom', '/AXIOM', '/AxIoM/',
  '/trojan', '/trojan/', '/Trojan', '/TROJAN', '/tRoJaN/',
  '/gmgn', '/gmgn/', '/Gmgn', '/GMGN', '/gMgN/',
  '/defined', '/defined/', '/Defined', '/DEFINED', '/DeFiNeD/',
  '/solanafm', '/solanafm/', '/Solanafm', '/SOLANAFM', '/SoLaNaFm/',
  '/solana-fm', '/solana-fm/', '/Solana-fm', '/SOLANA-FM', '/Solana-Fm/',
  '/solana_fm', '/solana_fm/', '/Solana_fm', '/SOLANA_FM', '/Solana_Fm/',
  '/listings/',
];
const LISTINGS_PEERS = [
  '/dexscreener', '/dexscreener/', '/Dexscreener', '/DEXSCREENER', '/DexScreener/',
  '/solscan', '/solscan/', '/Solscan', '/SOLSCAN', '/sOlScAn/',
];
const TO_HOWTO = [
  '/phoenix', '/phoenix/', '/Phoenix', '/PHOENIX', '/pHoEnIx/',
  '/lifinity', '/lifinity/', '/Lifinity', '/LIFINITY', '/LiFiNiTy/',
  '/openbook', '/openbook/', '/Openbook', '/OPENBOOK', '/OpEnBoOk/',
  '/drift', '/drift/', '/Drift', '/DRIFT', '/dRiFt/',
  '/serum', '/serum/', '/Serum', '/SERUM', '/sErUm/',
  '/pump', '/pump/', '/Pump', '/PUMP', '/pUmP/',
  '/pumpswap', '/pumpswap/', '/Pumpswap', '/PUMPSWAP', '/PumpSwap/',
  '/pump-swap', '/pump-swap/', '/Pump-swap', '/PUMP-SWAP', '/Pump-Swap/',
  '/pump_swap', '/pump_swap/', '/Pump_swap', '/PUMP_SWAP', '/Pump_Swap/',
  '/jup', '/jup/', '/Jup', '/JUP', '/jUp/',
];
const HOWTO_PEERS = [
  '/orca', '/orca/', '/Orca', '/ORCA', '/oRcA/',
  '/meteora', '/meteora/', '/Meteora', '/METEORA', '/MeTeOrA/',
  '/pumpfun', '/pumpfun/', '/Pumpfun', '/PUMPFUN', '/PumpFun/',
  '/jupiter', '/jupiter/', '/Jupiter', '/JUPITER', '/JuPiTeR/',
];
const STAY_200 = [
  '/listings',
  '/how-to-buy',
  '/how-to-buy/',
];
const STAY_OUT = [
  '/explorer', '/faq', '/waitlist', '/terms', '/blog', '/careers', '/hiring',
  '/openai', '/discord', '/roadmap', '/whitepaper', '/tokenomics', '/x402',
  '/openrouter', '/status', '/health', '/healthz', '/v1',
];

for (const path of TO_LISTINGS) {
  assert.equal(potterHome308Dest(path), LISTINGS, path);
}
for (const path of LISTINGS_PEERS) {
  assert.equal(potterHome308Dest(path), LISTINGS, `peer ${path}`);
}
for (const path of TO_HOWTO) {
  assert.equal(potterHome308Dest(path), HOWTO, path);
  assert.doesNotMatch(potterHome308Dest(path), /plugin\.jup\.ag/, `${path} dest is not plugin.jup.ag`);
}
for (const path of HOWTO_PEERS) {
  assert.equal(potterHome308Dest(path), HOWTO, `peer ${path}`);
  assert.doesNotMatch(potterHome308Dest(path), /plugin\.jup\.ag/, `${path} dest is not plugin.jup.ag`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
  assert.equal(potterHome308Dest(`${path}/`), null, `do not invent ${path}/`);
}
assert.equal(potterHome308Dest('/Listings'), LISTINGS, 'Title-case /Listings product-casefolds');
assert.equal(potterHome308Dest('/LISTINGS'), LISTINGS, 'UPPER /LISTINGS product-casefolds');
assert.equal(potterHome308Dest('/How-to-buy'), HOWTO, 'Title-case /How-to-buy still product-casefolds');
assert.equal(potterHome308Dest('/buy'), HOWTO, '/buy still howto');

const feed = listingsJsonBody();
assert.equal(feed.schema, 'dasha.listings.v0');
assert.equal(feed.listings[0].mint, '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump');
assert.equal(feed.listings[0].buy, HOWTO);
assert.doesNotMatch(JSON.stringify(feed), /plugin\.jup\.ag/);

const env = { LOBBY_SESSION_SECRET: 'photon-bullx-dex-peers-pretty-path-secret' };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [paths, dest] of [
    [TO_LISTINGS, LISTINGS],
    [LISTINGS_PEERS, LISTINGS],
    [TO_HOWTO, HOWTO],
    [HOWTO_PEERS, HOWTO],
  ]) {
    for (const path of paths) {
      for (const method of ['GET', 'HEAD']) {
        const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
        assert.equal(res.status, 308, `${host} ${path} ${method}`);
        assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
        assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }
  for (const [path, edge] of [
    ['/listings', 'listings'],
    ['/how-to-buy', 'howto'],
  ]) {
    const page = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(page.status, 200, `${host} ${path} stays 200`);
    if (host === 'www.getdasha.com') {
      assert.equal(page.headers.get('x-dasha-edge'), edge, `${host} ${path} edge`);
    }
    const html = await page.text();
    assert.doesNotMatch(html, /plugin\.jup\.ag/);
    if (path === '/listings') {
      assert.match(html, /<h1>Dasha List<\/h1>/);
      assert.match(html, /53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
      assert.match(html, /jup\.ag\/swap/);
      assert.match(html, /\/how-to-buy/);
    }
  }
  const json = await edgeWorker.fetch(new Request(`https://${host}/listings.json`), env);
  assert.equal(json.status, 200, `${host} /listings.json stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(json.headers.get('x-dasha-edge'), 'listings-json');
  }
  const body = await json.json();
  assert.equal(body.schema, 'dasha.listings.v0');
  assert.equal(body.listings[0].buy, HOWTO);
  assert.doesNotMatch(JSON.stringify(body), /plugin\.jup\.ag/);
  for (const path of STAY_OUT) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(potterHome308Dest(path), null, `${host} ${path} dest stays null`);
    if (host === 'www.getdasha.com') {
      assert.equal(res.status, 404, `${host} ${path} stays 404`);
      assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} html-404`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/how-to-buy<\/loc>/);
for (const path of [
  '/photon', '/bullx', '/axiom', '/trojan', '/gmgn', '/defined',
  '/solanafm', '/solana-fm', '/solana_fm', '/dexscreener', '/solscan',
  '/phoenix', '/lifinity', '/openbook', '/drift', '/serum',
  '/pump', '/pumpswap', '/pump-swap', '/pump_swap', '/jup',
  '/orca', '/meteora', '/pumpfun', '/jupiter',
  '/explorer', '/faq', '/waitlist', '/terms', '/blog', '/careers', '/hiring',
  '/openai', '/discord', '/roadmap', '/whitepaper', '/tokenomics', '/x402',
  '/openrouter', '/status', '/health', '/healthz', '/v1',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-photon-bullx-dex-peers-pretty-path: PASS (/photon+/bullx+/axiom+/trojan+/gmgn+/defined+/solanafm family + /dexscreener+/solscan 308 /listings; /phoenix+/lifinity+/openbook+/drift+/serum+/pump+/pumpswap+/jup + /orca+/meteora+/pumpfun+/jupiter 308 /how-to-buy; Title-case+slash; dest slash /listings/; /listings+/how-to-buy 200; skip /explorer+/faq+/waitlist+/terms+/blog+/careers+/hiring+/openai+/discord+/roadmap+/whitepaper+/tokenomics+/x402+/openrouter+/status+/health+/healthz+/v1; no plugin.jup.ag)');
