#!/usr/bin/env node
/**
 * PRODUCT-200 HD-06 (human door): the getdasha.com home tape led with a live
 * Dexscreener price quote ("$dasha $0.0001043 · -7.5% 24h · liq $40878.41"),
 * refreshed every 60s. A stranger reads that as live cash value for earnings —
 * it undercuts the honest message: "today this pays in reputation receipts;
 * cash comes later." The home tape now shows news rows only, with the honest
 * sentence under the tape. /digest keeps its tape (that page IS the market
 * tape); /price stays for the buy sheet's hidden USD math.
 *
 * FAIL-FIRST: written red before the fix (dropPriceTick did not exist, the
 * remount fetched /price and overlaid the tick).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT,
  digestRemountScript,
  digestSectionHtml,
  dropPriceTick,
  homeTapeItems,
  injectDigestSection,
} from './dasha-digest.mjs';
import { applyDigestTape } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

const HONEST = 'today this pays in reputation receipts; cash comes later.';
const DEX_HREF = 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7';

const liveTick = {
  source: 'Dexscreener',
  kind: 'tape',
  title: '$dasha $0.0001043 · -7.5% 24h · liq $40878.41',
  href: DEX_HREF,
  at: '2026-10-09T00:59:56.416Z',
};
const news = {
  source: 'CoinDesk',
  kind: 'news',
  title: 'Vitalik · ETH beyond chain',
  href: 'https://www.coindesk.com/tech/2026/09/27/vitalik-buterin-maps-ethereum-s-shift-beyond-a-blockchain-in-sweeping-2030-vision',
  at: '2026-09-27T00:00:00Z',
};

// 1. dropPriceTick removes the live tick row, keeps news.
{
  const out = dropPriceTick([liveTick, news]);
  assert.equal(out.length, 1, 'tick dropped, news kept');
  assert.equal(out[0].source, 'CoinDesk');
}
// 2. dropPriceTick also removes the stale seeded quote in DEFAULT (2026-09-07).
{
  const out = dropPriceTick(DEFAULT.items);
  assert.ok(
    !out.some((r) => /dexscreener\.com\/solana\//i.test(String(r.href || ''))),
    'no dexscreener quote rows remain in home set',
  );
  assert.ok(out.length < DEFAULT.items.length, 'something was dropped');
  assert.ok(out.some((r) => r.kind === 'news'), 'news rows survive');
}
// 3. No-op when no tick present.
{
  const only = [news];
  assert.equal(dropPriceTick(only).length, 1);
  assert.equal(dropPriceTick([]).length, 0);
}
// 4. Honest caption lands on the home tape only when asked.
{
  const html = digestSectionHtml([news], { pageHref: '/digest', honestCaption: true });
  assert.match(html, /dd-honest/, 'caption class present');
  assert.ok(html.includes(HONEST), 'honest sentence verbatim');
  const plain = digestSectionHtml([news], { pageHref: '/digest' });
  assert.doesNotMatch(plain, /reputation receipts/, 'opt-in only');
}
// 5. Home remount no longer fetches /price or overlays a price tick.
{
  const remount = digestRemountScript();
  assert.match(remount, /\/digest\.json/, 'still refreshes news');
  assert.doesNotMatch(remount, /\/price/, 'no /price fetch');
  assert.doesNotMatch(remount, /tickFromPrice/, 'no price tick builder');
  assert.doesNotMatch(remount, /p\.priceUsd/, 'no priceUsd read');
  assert.match(remount, /hideStaleDex/, 'stale dex rows still collapsed, no numbers');
  assert.match(remount, /isDexRow/, 'remount drops Dexscreener quote rows client-side too');
  assert.match(remount, /Crew\. You keep the keys\./, 'crew line stays');
  assert.match(remount, /setInterval\(go,60000\)/, 'news refresh ~60s stays');
  assert.ok(remount.includes(HONEST), 'client-built section carries the honest sentence');
  assert.doesNotMatch(remount, /api\.dexscreener\.com/, 'browser never hits Dexscreener');
}
// 6. Worker home path composes dropPriceTick + honest caption.
{
  assert.match(workerSrc, /dropPriceTick/, 'worker imports dropPriceTick');
  assert.match(workerSrc, /honestCaption:\s*true/, 'home tape passes honestCaption');
}
// 7. End to end: home tape HTML has news, no price quote, honest sentence.
{
  const packItems = [liveTick, ...DEFAULT.items];
  const home = '<main><section id="grwm">GRWM</section></main>';
  const out = applyDigestTape(home, homeTapeItems(dropPriceTick(packItems)), { honestCaption: true });
  assert.ok(out.includes('id="dasha-digest"'), 'tape section painted');
  assert.doesNotMatch(out, /\$dasha \$\d/, 'no price quote on the home tape');
  assert.ok(out.includes(HONEST), 'honest sentence on the home tape');
  assert.match(out, /Vitalik|CoinDesk|Decrypt/, 'news rows render');
}

console.log('dasha-digest-home-honesty: OK');
