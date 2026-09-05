#!/usr/bin/env node
/** Quiet Crew door after Tape remount. Hidden if remount fails. Not first-paint chrome. */
import assert from 'node:assert/strict';
import {
  DEFAULT,
  digestRemountScript,
  injectDigestRemount,
  applyLiveTick,
} from './dasha-digest.mjs';
import { applyDigestTape, stripDeadNav, stripHomeOtherCoinWarning } from './dasha-lobby-worker.mjs';

const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const HOME = `<!doctype html><html lang="en"><head>
<title>old home</title>
</head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<section id="grwm">GRWM</section>
<section id="grok-door">SIWG</section>
</body></html>`;

const remount = digestRemountScript();
assert.match(remount, /dasha-crew-line|crew-line/);
assert.match(remount, /\/crew/);
assert.match(remount, /You keep the keys/);
assert.match(remount, /if\(!pack\)return/, 'no crew if remount fetch fails');
assert.doesNotMatch(remount, /api\.dexscreener\.com/);

const taped = applyDigestTape(stripHomeOtherCoinWarning(stripDeadNav(HOME)), DEFAULT.items);
const at = taped.indexOf('id="grwm"');
const paint = taped.slice(0, at);
assert.doesNotMatch(paint, /<p[^>]*id=["']dasha-crew-line["']/, 'no crew element on first paint');
assert.match(paint, /id=["']dasha-digest-remount["']/);
assert.doesNotMatch(taped, /<p[^>]*id=["']dasha-crew-line["']/, 'server tape does not inject crew chrome');
assert.equal((injectDigestRemount(taped).match(/id=["']dasha-digest-remount["']/g) || []).length, 1);
assert.doesNotMatch(taped, /plugin\.jup\.ag/);
assert.doesNotMatch(taped, /VVAIFU/);

const live = applyLiveTick({ items: DEFAULT.items }, {
  source: 'Dexscreener',
  kind: 'tape',
  title: '$dasha $0.002 · 1.0% 24h · liq $1.00',
  href: 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7',
});
assert.equal(live.items[0].title, '$dasha $0.002 · 1.0% 24h · liq $1.00');

console.log('dasha-home-crew-line: PASS (after remount, hidden on fail, not first paint)');
