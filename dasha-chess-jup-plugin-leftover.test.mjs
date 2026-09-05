#!/usr/bin/env node
/**
 * Leftover after Forum chrome DRY (internal #dasha-forum / forum-* / /forum/tape stay).
 * Live /chess 200 still paints empty #dasha-jup Jupiter plugin mount after style/script strip.
 * Buy sheet + jup.ag stay. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { stripChessJupPluginMount } from './dasha-lobby-worker.mjs';
import { CHESS_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const chessDisk = readFileSync(join(root, 'dasha-chess-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const TG = 'https://t.me/+xB7S8mIQaKFiZjRh';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripChessJupPluginMount/);
assert.match(workerSrc, /out = stripChessJupPluginMount\(out\);/);

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
<style>#buy-sheet{position:fixed;--jupiter-plugin-primary:223,255,0;--jupiter-plugin-background:7,6,8}#dasha-jup{flex:1;min-height:520px}#dasha-jup[hidden]{display:none}</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div id="chess-stage"></div>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><div id="dasha-jup"></div><div id="buy-sheet-fallback"><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div></div>
<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a> · <a href="https://www.getdasha.com/chess">Chess</a> · <a href="${TG}">Telegram</a></p></footer>
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']dasha-jup["']/, 'fixture leftover empty mount paints after style/script strip');
assert.match(LIVE, /--jupiter-plugin-primary/, 'fixture leftover plugin theme vars');

const gone = stripChessJupPluginMount(LIVE);
assert.doesNotMatch(afterStyleScript(gone), /id=["']dasha-jup["']/, 'drops leftover empty #dasha-jup mount');
assert.doesNotMatch(gone, /#dasha-jup/, 'drops leftover #dasha-jup CSS');
assert.doesNotMatch(gone, /--jupiter-plugin/, 'drops leftover plugin theme vars');
assert.match(gone, /id=["']buy-sheet["']/, 'buy sheet stays');
assert.match(gone, /id=["']buy-mint["']/, 'mint copy stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.match(gone, /src="\/client\/chess-local\.js"/, 'chess-local stays');
assert.match(gone, /id=["']chess-stage["']/, 'chess stage stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'mount drop is per-element, not eat-the-page');

function assertNoMount(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /id=["']dasha-jup["']/, `${label} no empty #dasha-jup after style/script strip`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /id=["']buy-sheet["']/, `${label} buy sheet`);
  assert.match(html, /src="\/client\/chess-local\.js"/, `${label} chess-local`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoMount(stripChessJupPluginMount(chessDisk), 'disk source');
assertNoMount(stripChessJupPluginMount(CHESS_PAGE_HTML), 'bundled');

{
  const chess = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess'), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get('x-dasha-edge'), 'chess');
  const html = await chess.text();
  assertNoMount(html, 'served chess');
  assert.doesNotMatch(afterStyleScript(html), /#dasha-jup/, 'served chess CSS has no leftover #dasha-jup after style/script strip');
  assert.match(html, new RegExp(PAIR), 'served chess pair');
  assert.match(html, /t\.me\/\+xB7S8mIQaKFiZjRh/, 'served chess official TG');
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.match(html, /Dasha versus Anna/, 'chess copy stays');
}

{
  const embed = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess?embed=1'), {});
  assert.equal(embed.status, 200);
  const html = await embed.text();
  assert.doesNotMatch(afterStyleScript(html), /id=["']dasha-jup["']/, 'embed has no leftover empty mount');
  assert.match(html, /src="\/client\/chess-local\.js"/, 'embed chess-local stays');
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

console.log('dasha-chess-jup-plugin-leftover: PASS (empty #dasha-jup mount dropped; buy sheet + jup.ag stay)');
