#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 929dd85a-406c-4f81-85f9-6f375c493b0b):
 * live /gecko /geckoterminal /gecko-terminal /gecko_terminal /dextools /solscan
 * (+slash / Title-case) html-404 → 308 /listings.
 * live /orca /meteora (+slash / Title-case) html-404 → 308 /how-to-buy.
 * Dest slash /listings/ 308 → /listings. Exact /listings + /how-to-buy stay 200.
 * Title-case /Listings product-casefolds. On-site dest only — never
 * plugin.jup.ag or external DEX hosts from Worker redirects.
 * Skip /pump /terminal /jup /pools. Disk only. No Designer.
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
for (const path of ['/gecko', '/geckoterminal', '/gecko-terminal', '/gecko_terminal', '/dextools', '/solscan']) {
  assert.match(listingsSet, new RegExp(`["\']${path}["\']`));
  assert.match(listingsSet, new RegExp(`["\']${path}/["\']`));
}
assert.match(listingsSet, /["']\/listings\/["']/);
assert.doesNotMatch(listingsSet, /['"]\/listings['"]/, 'exact /listings stays 200');
assert.doesNotMatch(listingsSet, /['"]\/pump['"]/, 'do not invent /pump');
assert.doesNotMatch(listingsSet, /['"]\/terminal['"]/, 'do not invent /terminal');
assert.doesNotMatch(listingsSet, /['"]\/jup['"]/, 'do not invent /jup');
for (const path of ['/orca', '/meteora']) {
  assert.match(howtoSet, new RegExp(`["\']${path}["\']`));
  assert.match(howtoSet, new RegExp(`["\']${path}/["\']`));
}
assert.doesNotMatch(howtoSet, /plugin\.jup\.ag/, 'howto set has no plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const LISTINGS = `${WWW}/listings`;
const HOWTO = `${WWW}/how-to-buy`;

const TO_LISTINGS = [
  '/gecko', '/gecko/', '/Gecko', '/GECKO', '/gEcKo/',
  '/geckoterminal', '/geckoterminal/', '/Geckoterminal', '/GECKOTERMINAL', '/GeckoTerminal/',
  '/gecko-terminal', '/gecko-terminal/', '/Gecko-terminal', '/GECKO-TERMINAL', '/Gecko-Terminal/',
  '/gecko_terminal', '/gecko_terminal/', '/Gecko_terminal', '/GECKO_TERMINAL', '/Gecko_Terminal/',
  '/dextools', '/dextools/', '/Dextools', '/DEXTOOLS', '/DexTools/',
  '/solscan', '/solscan/', '/Solscan', '/SOLSCAN', '/sOlScAn/',
  '/listings/',
];
const TO_HOWTO = [
  '/orca', '/orca/', '/Orca', '/ORCA', '/oRcA/',
  '/meteora', '/meteora/', '/Meteora', '/METEORA', '/MeTeOrA/',
];
const STAY_200 = [
  '/listings',
  '/how-to-buy',
  '/how-to-buy/',
];
const STAY_OUT = [
  '/terminal',
  '/pools',
];

for (const path of TO_LISTINGS) {
  assert.equal(potterHome308Dest(path), LISTINGS, path);
}
for (const path of TO_HOWTO) {
  assert.equal(potterHome308Dest(path), HOWTO, path);
  assert.doesNotMatch(potterHome308Dest(path), /plugin\.jup\.ag/, `${path} dest is not plugin.jup.ag`);
  assert.doesNotMatch(potterHome308Dest(path), /orca\.so/, `${path} dest is not orca.so`);
  assert.doesNotMatch(potterHome308Dest(path), /meteora\.ag/, `${path} dest is not meteora.ag`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of ['/pump', '/jup']) {
  assert.equal(potterHome308Dest(path), HOWTO, `${path} folds to /how-to-buy (live)`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
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

const env = { LOBBY_SESSION_SECRET: 'gecko-listings-leftover-pretty-path-secret' };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [paths, dest] of [
    [TO_LISTINGS, LISTINGS],
    [TO_HOWTO, HOWTO],
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
  '/gecko', '/geckoterminal', '/gecko-terminal', '/gecko_terminal',
  '/dextools', '/solscan', '/orca', '/meteora',
  '/pump', '/terminal', '/jup', '/pools',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-gecko-listings-leftover-pretty-path: PASS (/gecko+/geckoterminal+/gecko-terminal+/gecko_terminal+/dextools+/solscan 308 /listings; /orca+/meteora 308 /how-to-buy; Title-case+slash; dest slash /listings/; /listings+/how-to-buy 200; no plugin.jup.ag)');
