#!/usr/bin/env node
/** Issue #104: a failing isolate serves the last GOOD listings payload (stale > absent). */
import assert from 'node:assert/strict';
import {
  loadListingsMarket,
  resetListingsMarketCacheForTest,
  expireListingsMarketMemoForTest,
} from './dasha-lobby-worker.mjs';

const POOL = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const goodPayload = () => ({
  data: [{ type: 'pool', attributes: { address: POOL, name: '$dasha / SOL', base_token_price_usd: '1.25', price_change_percentage: { h24: '2.5' }, volume_usd: { h24: '1000' }, reserve_in_usd: '5000' }, relationships: { base_token: { data: { id: 'solana:token_1' } } } }],
  included: [{ type: 'token', id: 'solana:token_1', attributes: { symbol: '$dasha', name: 'dash_eats', address: MINT } }],
});
const okRes = () => ({ ok: true, json: async () => goodPayload() });
const failRes = () => { throw new Error('timeout'); };

// 1. fresh success memoizes and reports real rows
resetListingsMarketCacheForTest();
const fresh = await loadListingsMarket(okRes);
assert.equal(fresh.market.length, 1);
assert.equal(fresh.market[0].symbol, '$dasha');
assert.equal(fresh.stale, undefined);
const freshUpdatedAt = fresh.updated_at;

// 2. upstream failure after TTL -> last GOOD payload, marked stale, age preserved
let calls = 0;
expireListingsMarketMemoForTest();
const stale = await loadListingsMarket(() => { calls++; return failRes(); });
assert.equal(calls, 2, 'retries once before falling back');
assert.equal(stale.market.length, 1, 'stale > absent: last good rows served');
assert.equal(stale.market[0].symbol, '$dasha');
assert.equal(stale.stale, true);
assert.equal(stale.updated_at, freshUpdatedAt, 'updated_at keeps the good fetch age');

// 3. stale memo serves within TTL without refetch
const cached = await loadListingsMarket(() => { calls++; return failRes(); });
assert.equal(calls, 2, 'memo TTL honored');
assert.equal(cached.stale, true);

// 4. empty-parse success counts as failure -> still last good
expireListingsMarketMemoForTest();
const emptyParse = await loadListingsMarket(async () => ({ ok: true, json: async () => ({ data: [], included: [] }) }));
assert.equal(emptyParse.market.length, 1);
assert.equal(emptyParse.stale, true);

// 5. never-had-good cold isolate: honest empty with static fallback date
resetListingsMarketCacheForTest();
const cold = await loadListingsMarket(failRes);
assert.deepEqual(cold.market, []);
assert.equal(cold.stale, undefined);
assert.match(cold.updated_at, /^\d{4}-\d{2}-\d{2}/);

// 6. recovery: next success clears the stale marker
expireListingsMarketMemoForTest();
await loadListingsMarket(failRes); // cold isolate: still empty
const recovered = await (async () => { expireListingsMarketMemoForTest(); return loadListingsMarket(okRes); })();
assert.equal(recovered.market.length, 1);
assert.equal(recovered.stale, undefined);

console.log('dasha-listings-stale-fallback.test.mjs: OK');
