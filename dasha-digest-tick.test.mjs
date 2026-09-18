#!/usr/bin/env node
/**
 * Worker-side Dexscreener tick for /digest.json. Home remount overlays GET /price.
 * Browser never hits Dexscreener. Failure stays honest (hide stale numbers).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT,
  DEX_HREF,
  DEX_PAIR_API,
  DEX_TOKEN_API,
  PAIR,
  applyLiveTick,
  digestRemountScript,
  fetchLiveTick,
  homeTapeWithTick,
  resetTickCache,
  tickFromDex,
  tickFromPrice,
} from './dasha-digest.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

const DEX = {
  pairs: [{
    pairAddress: PAIR,
    priceUsd: '0.0012345',
    priceChange: { h24: 12.3 },
    liquidity: { usd: 99000.5 },
  }],
};

const PAIR_BODY = {
  pair: {
    pairAddress: PAIR,
    priceUsd: '0.002',
    priceChange: { h24: -4.1 },
    liquidity: { usd: 88000 },
  },
};

resetTickCache();

const fromPairs = tickFromDex(DEX);
assert.ok(fromPairs, 'tickFromDex reads pairs[]');
assert.equal(fromPairs.kind, 'tape');
assert.equal(fromPairs.source, 'Dexscreener');
assert.match(fromPairs.title, /\$dasha \$0\.0012345/);
assert.match(fromPairs.title, /12\.3% 24h/);
assert.match(fromPairs.title, /liq \$99000\.50/);
assert.equal(fromPairs.href, DEX_HREF);

const fromPair = tickFromDex(PAIR_BODY);
assert.ok(fromPair, 'tickFromDex reads pair');
assert.match(fromPair.title, /\$dasha \$0\.002/);
assert.match(fromPair.title, /-4\.1% 24h/);

assert.equal(tickFromDex({ pairs: [] }), null);
assert.equal(tickFromDex({ pairs: [{ pairAddress: PAIR, priceUsd: '0' }] }), null);
assert.equal(tickFromDex(null), null);

{
  const pack = applyLiveTick({ at: DEFAULT.at, items: DEFAULT.items }, fromPairs);
  assert.equal(pack.tick.title, fromPairs.title);
  assert.equal(pack.items[0].title, fromPairs.title);
  assert.equal(pack.items[0].kind, 'tape');
  assert.ok(pack.items.length >= 2, 'news stays under the tick');
  assert.equal(pack.items[1].href, DEFAULT.items[1].href, 'seed order preserved under the tick (seed row 2 is a tape-kind tweet today)');
}

{
  const pack = applyLiveTick({ at: DEFAULT.at, items: DEFAULT.items }, null);
  assert.equal(pack.tick, null);
  assert.equal(pack.items[0].title, DEFAULT.items[0].title, 'failed tick keeps seed');
}

{
  const rows = homeTapeWithTick(DEFAULT.items, fromPairs);
  assert.equal(rows[0].title, fromPairs.title);
  assert.equal(rows.length, 5);
  assert.equal(rows.filter((r) => r.href === fromPairs.href).length, 1, 'tick not doubled');
}

{
  async function fetcher(url) {
    const href = String(url);
    if (href === DEX_PAIR_API) {
      return { ok: true, json: async () => PAIR_BODY };
    }
    throw new Error('should not hit ' + href);
  }
  resetTickCache();
  const tick = await fetchLiveTick(fetcher);
  assert.ok(tick);
  assert.match(tick.title, /\$dasha \$0\.002/);
  const again = await fetchLiveTick(async () => { throw new Error('cache should skip'); });
  assert.equal(again.title, tick.title, 'isolate cache');
}

{
  async function fetcher(url) {
    const href = String(url);
    if (href === DEX_PAIR_API) return { ok: 502, json: async () => ({}) };
    if (href === DEX_TOKEN_API) return { ok: true, json: async () => DEX };
    throw new Error(href);
  }
  resetTickCache();
  const tick = await fetchLiveTick(fetcher);
  assert.match(tick.title, /\$dasha \$0\.0012345/, 'token API fallback');
}

{
  resetTickCache();
  const tick = await fetchLiveTick(async () => { throw new Error('down'); });
  assert.equal(tick, null, 'failure is honest');
}

{
  const live = tickFromPrice({
    ok: true,
    pair: PAIR,
    priceUsd: 0.0000897,
    change: { h24: -12.4 },
    liquidityUsd: 55100.25,
  });
  assert.ok(live, 'tickFromPrice reads /price JSON');
  assert.equal(live.source, 'Dexscreener');
  assert.match(live.title, /\$dasha \$0\.0000897/);
  assert.match(live.title, /-12\.4% 24h/);
  assert.match(live.title, /liq \$55100\.25/);
  assert.equal(live.href, DEX_HREF);
  assert.equal(tickFromPrice({ ok: false, priceUsd: 0.0000897, pair: PAIR }), null, '/price ok:false is honest');
  assert.equal(tickFromPrice({ ok: true, priceUsd: 0.0000897 }), null, 'missing pair is not invented');
  assert.equal(tickFromPrice({ ok: true, pair: PAIR, priceUsd: 0 }), null, 'zero price is not invented');
}

const remount = digestRemountScript();
assert.match(remount, /\/digest\.json/);
assert.match(remount, /priceHref=['"]\/price['"]/);
assert.match(remount, /tickFromPrice/);
assert.match(remount, /hideStaleDex/);
assert.doesNotMatch(remount, /pack\.tick/);
assert.match(remount, /dasha-crew-line|crew-line/);
assert.match(remount, /\/crew/);
assert.match(remount, /You keep the keys/);
assert.doesNotMatch(remount, /api\.dexscreener\.com/);
assert.doesNotMatch(remount, /plugin\.jup\.ag/);
assert.doesNotMatch(remount, /VVAIFU/);

assert.match(workerSrc, /fetchLiveTick/);
assert.match(workerSrc, /applyLiveTick/);
assert.match(workerSrc, /tick: pack\.tick/);
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

console.log('dasha-digest-tick: PASS (worker Dex tick, remount /price overlay, cache, honest fail)');
