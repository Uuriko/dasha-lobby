#!/usr/bin/env node
/**
 * Mirror live Dasha List (Worker 1013067e): GET/HEAD /listings 200 HTML,
 * GET/HEAD /listings.json 200 dasha.listings.v0. Pretty 308 leftover
 * /listing /listings/ /coins /coin /listed /list /dex /dexscreener /cmc /coingecko
 * (+slash / Title-case) → /listings. /market stays → /compute. /ca stays → /which.
 * Featured only $dasha / dash_eats. Venues from buy-sheet. Quiet #list-door after #grwm.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  listingsJsonBody,
  orderHomeLongPage,
  potterHome308Dest,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const WWW = 'https://www.getdasha.com';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /const LISTINGS_HTML = `/);
assert.match(workerSrc, /POTTER_LISTINGS_308_PATHS/);
assert.match(workerSrc, /export function listingsJsonBody/);
assert.match(
  workerSrc,
  /Leftover \/listing \/listings\/ \/coins \/coin \/listed \/list \/dex \/dexscreener \/cmc \/coingecko/,
  'listings leftover comment',
);
assert.match(workerSrc, /Do not fold \/market/);
assert.match(workerSrc, /id=["']list-door["']/, 'quiet home list-door');

function extractConst(name) {
  const m = workerSrc.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}

const listings = extractConst('LISTINGS_HTML');
assert.match(listings, /<title>Dasha List · \$dasha<\/title>/);
assert.match(listings, /og:title" content="Dasha List · \$dasha"/);
assert.match(listings, /<h1>Dasha List<\/h1>/);
assert.match(listings, /\$dasha \/ dash_eats/);
assert.match(listings, new RegExp(MINT));
assert.match(listings, new RegExp(PAIR));
assert.match(listings, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112&amp;buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
assert.match(listings, /raydium\.io\/swap\/\?inputMint=sol/);
assert.match(listings, /dexscreener\.com\/solana\/9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7/);
assert.match(listings, /birdeye\.so\/token\//);
assert.match(listings, /pump\.fun\/coin\//);
assert.match(listings, /geckoterminal\.com\/solana\/pools\//);
assert.match(listings, /trade\.phantom\.com\/token\//);
assert.doesNotMatch(listings, /plugin\.jup\.ag/);
assert.doesNotMatch(listings, /VVAIFU|FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8/);
assert.doesNotMatch(listings, /disclaimer|not financial advice|NFA|dyor/i);

const body = listingsJsonBody();
assert.equal(body.schema, 'dasha.listings.v0');
assert.equal(body.listings.length, 1, 'featured only $dasha');
assert.equal(body.listings[0].mint, MINT);
assert.equal(body.listings[0].pair, PAIR);
assert.equal(body.listings[0].symbol, '$dasha');
assert.equal(body.listings[0].name, 'dash_eats');
assert.equal(body.listings[0].status, 'listed');
assert.ok(body.venues == null, 'venues live on the featured row');
const venues = body.listings[0].venues.map((v) => v.id);
assert.deepEqual(venues, [
  'getdasha',
  'jupiter',
  'raydium',
  'dexscreener',
  'birdeye',
  'pump',
  'geckoterminal',
  'phantom',
]);
for (const v of body.listings[0].venues) {
  assert.doesNotMatch(v.href, /plugin\.jup\.ag/);
}

const llms = extractConst('LLMS_TXT');
assert.ok(llms.includes('/listings'), 'llms.txt lists /listings');
assert.ok(llms.includes('/listings.json'), 'llms.txt lists /listings.json');
const full = extractConst('LLMS_FULL_TXT');
assert.match(full, /^## Dasha List/m);
assert.match(full, /https:\/\/www\.getdasha\.com\/listings\.json/);

const robots = extractConst('ROBOTS_TXT');
assert.match(robots, /^Allow:\s*\/listings\s*$/m);
assert.match(robots, /^Allow:\s*\/listings\.json\s*$/m);
const sitemap = extractConst('SITEMAP_XML');
assert.match(sitemap, /<loc>https:\/\/www\.getdasha\.com\/listings<\/loc><lastmod>2026-09-06<\/lastmod>/);
assert.match(sitemap, /<loc>https:\/\/www\.getdasha\.com\/listings\.json<\/loc><lastmod>2026-09-06<\/lastmod>/);
assert.doesNotMatch(sitemap, /getdasha\.com\/listing</);
assert.doesNotMatch(sitemap, /getdasha\.com\/coins</);
assert.doesNotMatch(sitemap, /getdasha\.com\/dex</);

const FOLDS = [
  '/listing', '/listing/', '/Listing', '/LISTING/',
  '/listings/',
  '/coins', '/coins/', '/Coins', '/COINS/',
  '/coin', '/coin/', '/Coin',
  '/listed', '/listed/', '/Listed',
  '/list', '/list/', '/List',
  '/dex', '/dex/', '/Dex',
  '/dexscreener', '/dexscreener/', '/DexScreener',
  '/cmc', '/cmc/', '/CMC',
  '/coingecko', '/coingecko/', '/CoinGecko',
];
for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), `${WWW}/listings`, path);
}
assert.equal(potterHome308Dest('/listings'), null, '/listings stays 200');
assert.equal(potterHome308Dest('/listings.json'), null, '/listings.json stays 200');
assert.equal(potterHome308Dest('/Listings'), `${WWW}/listings`, 'Title-case /Listings');
assert.equal(potterHome308Dest('/Listings.json'), `${WWW}/listings.json`, 'Title-case /Listings.json');
assert.equal(potterHome308Dest('/market'), `${WWW}/compute`, '/market stays compute');
assert.equal(potterHome308Dest('/market/'), `${WWW}/compute`, '/market/ stays compute');
assert.equal(potterHome308Dest('/ca'), `${WWW}/which`, '/ca stays /which');
assert.equal(potterHome308Dest('/verify'), `${WWW}/which`, '/verify stays /which');

{
  const html = orderHomeLongPage('<main><header id="content">hero</header><section id="grwm">GRWM</section></main>');
  const grwm = html.indexOf('id="grwm"');
  const list = html.indexOf('id="list-door"');
  const grok = html.indexOf('id="grok-door"');
  assert.ok(grwm >= 0 && list > grwm, 'list-door after #grwm');
  assert.ok(list > grok, 'quiet list-door after SIWG');
  assert.match(html, /We list \$dasha here/);
  assert.match(html, /href="\/listings"/);
  assert.doesNotMatch(html.slice(0, grwm), /id="list-door"/, 'list-door not first paint');
}

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const method of ['GET', 'HEAD']) {
    const page = await edgeWorker.fetch(new Request(`https://${host}/listings`, { method }), env);
    assert.equal(page.status, 200, `${host} /listings ${method}`);
    assert.equal(page.headers.get('x-dasha-edge'), 'listings');
    assert.match(page.headers.get('link') || '', /<\/llms\.txt>; rel="describedby"/);
    if (method === 'HEAD') {
      assert.equal(await page.text(), '');
    } else {
      const html = await page.text();
      assert.match(html, /<h1>Dasha List<\/h1>/);
      assert.match(html, new RegExp(MINT));
      assert.match(html, new RegExp(PAIR));
      assert.doesNotMatch(html, /plugin\.jup\.ag/);
    }

    const jsonRes = await edgeWorker.fetch(new Request(`https://${host}/listings.json`, { method }), env);
    assert.equal(jsonRes.status, 200, `${host} /listings.json ${method}`);
    assert.equal(jsonRes.headers.get('x-dasha-edge'), 'listings-json');
    assert.match(jsonRes.headers.get('content-type') || '', /application\/json/);
    if (method === 'HEAD') {
      assert.equal(await jsonRes.text(), '');
    } else {
      const data = await jsonRes.json();
      assert.equal(data.schema, 'dasha.listings.v0');
      assert.equal(data.listings.length, 1);
      assert.equal(data.listings[0].mint, MINT);
      assert.doesNotMatch(JSON.stringify(data), /plugin\.jup\.ag/);
    }
  }

  for (const path of ['/listing', '/coins', '/list', '/dex', '/cmc', '/coingecko', '/listings/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), `${WWW}/listings`, `${host} ${path} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }

  const market = await edgeWorker.fetch(new Request(`https://${host}/market`), env);
  assert.equal(market.status, 308, `${host} /market still 308`);
  assert.equal(market.headers.get('location'), `${WWW}/compute`, `${host} /market stays /compute`);

  const ca = await edgeWorker.fetch(new Request(`https://${host}/ca`), env);
  assert.equal(ca.status, 308, `${host} /ca still 308`);
  assert.equal(ca.headers.get('location'), `${WWW}/which`, `${host} /ca stays /which`);
}

console.log('dasha-listings-leftover: PASS (/listings + /listings.json 200, leftover 308s, /market+/ca locks, quiet list-door, no plugin.jup.ag)');
