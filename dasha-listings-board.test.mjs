#!/usr/bin/env node
/**
 * Live Solana board under the one $dasha listing.
 * Disk only. No Designer. Never plugin.jup.ag. Never invent a price.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  filterListingsMarket,
  listingsJsonBody,
  parseGeckoTrendingPools,
  renderListingsHtml,
  resetListingsMarketCacheForTest,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const VVAIFU = 'FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /const LISTINGS_HTML = `/);
assert.match(workerSrc, /listings-board:2026-09-08/);
assert.match(workerSrc, /api\.geckoterminal\.com\/api\/v2\/networks\/solana\/trending_pools\?page=1/);

function extractConst(name) {
  const m = workerSrc.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}

const listings = extractConst('LISTINGS_HTML');
assert.match(listings, new RegExp(MINT));
assert.match(listings, /<!-- listings-coingecko-venue:2026-09-07 -->/);
assert.match(listings, /coingecko\.com\/en\/coins\/dash_eats/);
assert.match(listings, /<!-- listings-board:2026-09-08 -->/);
assert.match(listings, /<table>/);
assert.match(listings, /<th>#<\/th><th>Coin<\/th><th>Price<\/th><th>24h<\/th><th>Volume<\/th><th>Mcap<\/th><th>Liq<\/th>/);
assert.doesNotMatch(listings, /Listed on CoinGecko/);
assert.doesNotMatch(listings, /VVAIFU|FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8/);
assert.doesNotMatch(listings, /disclaimer|not financial advice|NFA|dyor/i);
assert.doesNotMatch(listings, /plugin\.jup\.ag/);
assert.doesNotMatch(listings, /\$[0-9]/, 'template has no invented $ prices');
{
  const tbody = (listings.match(/<tbody>([\s\S]*?)<\/tbody>/) || [, '']);
  assert.doesNotMatch(tbody[1], /<tr/, 'template board has no static rows');
}

function pool(address, name, price, extra = {}) {
  return {
    type: 'pool',
    attributes: {
      address,
      name,
      base_token_price_usd: price,
      market_cap_usd: extra.mcap ?? 1_000_000,
      reserve_in_usd: extra.liq ?? 50_000,
      volume_usd: { h24: extra.vol ?? 10_000 },
      price_change_percentage: { h24: extra.chg ?? 1.25 },
    },
    relationships: extra.mint
      ? { base_token: { data: { id: `solana_${extra.mint}`, type: 'token' } } }
      : undefined,
  };
}

const STONK = 'AfrddTGYwCVEQB1gxCAhR8i48o6qtxYqksdVkeLudEhg';
const parsed = parseGeckoTrendingPools({
  data: [
    pool(STONK, 'STONK / SOL', '0.1522', { chg: 13.996, vol: 20659901.9, mcap: 132123422.57, liq: 2556352.17 }),
    pool(PAIR, 'DASHA / SOL', '0.00001234', { mint: MINT, chg: -2.5, vol: 800, mcap: 12000, liq: 4000 }),
    pool('not-an-address', 'FAKE / SOL', '1.23'),
    pool('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'NOPE / SOL', null),
    pool('8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'ZERO / SOL', '0'),
    pool('9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'VVAIFU / SOL', '4.2', { mint: VVAIFU }),
    ...Array.from({ length: 22 }, (_, i) => pool(
      `Coin${String(i).padStart(31, '1')}pump`.slice(0, 43),
      `COIN${i} / SOL`,
      String(i + 1),
    )),
  ],
});

assert.ok(parsed.length <= 20, 'board cap 20');
assert.equal(parsed[0].symbol, '$dasha');
assert.equal(parsed[0].name, 'dash_eats');
assert.equal(parsed[0].price_usd, 0.00001234);
assert.equal(parsed[0].href, `https://www.geckoterminal.com/solana/pools/${PAIR}`);
assert.equal(parsed.some((row) => row.symbol === 'STONK'), true);
assert.equal(parsed.some((row) => /VVAIFU/i.test(row.symbol) || row.href.includes(VVAIFU)), false);
assert.equal(parsed.some((row) => row.price_usd == null || row.price_usd <= 0), false, 'never invent or keep empty prices');
for (const row of parsed) {
  assert.equal(Object.hasOwn(row, 'status'), false, 'market rows are not status listed');
  assert.match(row.href, /^https:\/\/www\.geckoterminal\.com\/solana\/pools\/[1-9A-HJ-NP-Za-km-z]{32,44}$/);
}

const feed = listingsJsonBody({ market: parsed, updated_at: '2026-09-08T17:00:00.000Z' });
assert.equal(feed.schema, 'dasha.listings.v0');
assert.equal(feed.updated_at, '2026-09-08T17:00:00.000Z');
assert.equal(feed.listings.length, 1);
assert.equal(feed.listings[0].status, 'listed');
assert.equal(feed.listings[0].mint, MINT);
assert.deepEqual(feed.listings[0].venues.map((v) => v.id).includes('coingecko'), true);
assert.equal(feed.market.length, parsed.length);
for (const row of feed.market) {
  assert.notEqual(row.status, 'listed');
  assert.equal(Object.hasOwn(row, 'status'), false);
}
assert.doesNotMatch(JSON.stringify(feed), /plugin\.jup\.ag/);

const qHit = filterListingsMarket(parsed, 'stonk');
assert.equal(qHit.length, 1);
assert.equal(qHit[0].symbol, 'STONK');
assert.equal(qHit[0].status, undefined);
const qMiss = filterListingsMarket(parsed, 'zzz-no-such-coin');
assert.deepEqual(qMiss, []);
const qEmpty = filterListingsMarket(parsed, '   ');
assert.equal(qEmpty.length, parsed.length);

const html = renderListingsHtml(parsed, 'stonk');
assert.match(html, /name="q" value="stonk"/);
assert.match(html, /STONK/);
assert.match(html, new RegExp(STONK));
assert.doesNotMatch(html, /COIN3/);
assert.match(html, /<h2 id="feat-name">\$dasha \/ dash_eats<\/h2>/);
assert.match(html, /Status: <span class="status">Listed<\/span>/);
assert.match(html, /href="\/how-to-buy">Buy \$dasha →/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);

const quiet = renderListingsHtml([], '');
assert.match(quiet, /<!-- listings-board:2026-09-08 -->/);
assert.match(quiet, new RegExp(MINT));
assert.doesNotMatch(quiet.match(/<tbody>([\s\S]*?)<\/tbody>/)[1], /<tr/);

const realFetch = globalThis.fetch;
function mockTrending(payload, status = 200) {
  globalThis.fetch = async (url) => {
    assert.match(String(url), /trending_pools\?page=1/);
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

resetListingsMarketCacheForTest();
mockTrending({
  data: [
    pool(STONK, 'STONK / SOL', '0.1522', { chg: 13.996, vol: 20659901.9, mcap: 132123422.57, liq: 2556352.17 }),
    pool(PAIR, 'DASHA / SOL', '0.00001234', { mint: MINT }),
  ],
});
{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/listings'), {});
  assert.equal(page.status, 200);
  const text = await page.text();
  assert.match(text, /<!-- listings-board:2026-09-08 -->/);
  assert.match(text, /\$dasha \/ dash_eats/);
  assert.match(text, /STONK/);
  assert.match(text, new RegExp(PAIR));
  assert.match(text, /geckoterminal\.com\/solana\/pools\/AfrddTGYwCVEQB1gxCAhR8i48o6qtxYqksdVkeLudEhg/);
  assert.doesNotMatch(text, /plugin\.jup\.ag/);
  const json = await edgeWorker.fetch(new Request('https://www.getdasha.com/listings.json'), {});
  const data = await json.json();
  assert.equal(data.listings[0].status, 'listed');
  assert.equal(data.market[0].symbol, '$dasha');
  assert.equal(data.market[1].symbol, 'STONK');
  for (const row of data.market) assert.equal(row.status, undefined);
}

resetListingsMarketCacheForTest();
mockTrending({ data: [pool(STONK, 'STONK / SOL', '0.1522'), pool(PAIR, 'DASHA / SOL', '0.00001234', { mint: MINT })] });
{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/listings?q=stonk'), {});
  const text = await page.text();
  assert.match(text, /name="q" value="stonk"/);
  assert.match(text, /STONK/);
  assert.doesNotMatch(text.match(/<tbody>([\s\S]*?)<\/tbody>/)[1], /\$dasha/);
  assert.match(text, /<h2 id="feat-name">\$dasha \/ dash_eats<\/h2>/);
  const json = await edgeWorker.fetch(new Request('https://www.getdasha.com/listings.json?q=stonk'), {});
  const data = await json.json();
  assert.equal(data.listings[0].status, 'listed');
  assert.equal(data.market.length, 1);
  assert.equal(data.market[0].symbol, 'STONK');
  assert.equal(data.market[0].status, undefined);
}

resetListingsMarketCacheForTest();
globalThis.fetch = async () => new Response('nope', { status: 503 });
{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/listings'), {});
  const text = await page.text();
  assert.equal(page.status, 200);
  assert.match(text, /\$dasha \/ dash_eats/);
  assert.match(text, new RegExp(MINT));
  assert.match(text, /<!-- listings-board:2026-09-08 -->/);
  assert.doesNotMatch(text.match(/<tbody>([\s\S]*?)<\/tbody>/)[1], /<tr/);
  const json = await edgeWorker.fetch(new Request('https://www.getdasha.com/listings.json'), {});
  const data = await json.json();
  assert.equal(data.listings[0].mint, MINT);
  assert.deepEqual(data.market, []);
}

globalThis.fetch = realFetch;
resetListingsMarketCacheForTest();
console.log('dasha-listings-board: PASS ($dasha pin, live board parse, empty on fail, ?q= filter, no listed market rows, no plugin.jup.ag)');
