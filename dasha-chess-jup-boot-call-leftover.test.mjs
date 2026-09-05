#!/usr/bin/env node
/**
 * Leftover after Jupiter plugin boot function DRY (buy sheet + jup.ag stay).
 * Live /chess 200 still serializes leftover bootJup() call in the buy-chip
 * handler after hideJup / function bootJup / window.Jupiter.init were dropped.
 * Humans see it in view-source. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  stripChessJupPluginBoot,
  stripChessJupPluginBootCall,
  stripChessJupPluginMount,
} from './dasha-lobby-worker.mjs';
import { CHESS_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const chessDisk = readFileSync(join(root, 'dasha-chess-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const TG = 'https://t.me/+xB7S8mIQaKFiZjRh';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripChessJupPluginBootCall/);
assert.match(workerSrc, /out = stripChessJupPluginBootCall\(out\);/);
assert.ok(workerSrc.includes('Leftover bootJup() call after plugin boot functions were already dropped'));

const LIVE = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div id="chess-stage"></div>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><div id="buy-sheet-fallback"><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div></div>
<script id="dasha-buy-sheet-boot">(function(){var amount='0.2';var input='sol';function $(id){return document.getElementById(id)}function jup(){return input==='usdc'?JUP_USDC:JUP_SOL}function flashBought(){}function paintHref(){var a=$('buy-open');if(a)a.href=jup()}function paintUsd(){}function watchPrice(){var n=$('price-now')||$('price');if(!n||!window.MutationObserver)return}function paintChips(){}function bind(){var chipsEl=$('buy-chips');if(chipsEl)chipsEl.addEventListener('click',function(event){paintChips();paintHref();paintUsd();if(!$('buy-sheet')||$('buy-sheet').hidden)return;bootJup()});paintChips();paintHref();paintUsd();pullPrice();watchPrice()}bind();window.DashaBuySheet={open:open,close:close,jup:jup}})();</script>
<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a> · <a href="${TG}">Telegram</a></p></footer>
</body></html>`;

assert.doesNotMatch(LIVE, /function hideJup/, 'fixture plugin boot functions already dropped');
assert.doesNotMatch(LIVE, /function bootJup/, 'fixture function bootJup already dropped');
assert.doesNotMatch(LIVE, /window\.Jupiter/, 'fixture Jupiter.init already dropped');
assert.doesNotMatch(LIVE, /id=["']dasha-jup["']/, 'fixture empty mount already DOM-stripped');
assert.match(LIVE, /return;bootJup\(\)/, 'fixture leftover bootJup() call paints in view-source');
assert.match(LIVE, /function jup\(\)/, 'fixture jup.ag href helper stays');

const gone = stripChessJupPluginBootCall(LIVE);
assert.doesNotMatch(gone, /bootJup/, 'drops leftover bootJup() call');
assert.match(gone, /function jup\(\)/, 'jup.ag href helper stays');
assert.match(gone, /id=["']buy-sheet["']/, 'buy sheet stays');
assert.match(gone, /id=["']buy-chips["']/, 'buy chips stay');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.match(gone, /src="\/client\/chess-local\.js"/, 'chess-local stays');
assert.match(gone, /function watchPrice/, 'buy watchPrice stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.7, 'call drop is per-call, not eat-the-page');

assert.match(chessDisk, /return;bootJup\(\)/, 'disk source still has leftover bootJup() call (polish drops it; did not run static-gen)');
assert.match(CHESS_PAGE_HTML, /return;bootJup\(\)/, 'bundled still has leftover bootJup() call');
assert.match(chessDisk, /function bootJup\(\)/, 'disk still has leftover function bootJup (prior polish drops it)');

function polish(html) {
  return stripChessJupPluginBootCall(stripChessJupPluginBoot(stripChessJupPluginMount(html)));
}

function assertNoCall(html, label) {
  assert.doesNotMatch(html, /bootJup/, `${label} no leftover bootJup`);
  assert.doesNotMatch(html, /function hideJup/, `${label} no leftover hideJup`);
  assert.doesNotMatch(html, /window\.Jupiter/, `${label} no leftover window.Jupiter`);
  assert.doesNotMatch(html, /integratedTargetId/, `${label} no leftover plugin target`);
  assert.doesNotMatch(html, /dasha-jup/, `${label} no leftover dasha-jup`);
  assert.match(html, /function jup\(\)/, `${label} jup helper`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /id=["']buy-sheet["']/, `${label} buy sheet`);
  assert.match(html, /src="\/client\/chess-local\.js"/, `${label} chess-local`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoCall(polish(LIVE), 'polished leftover fixture');
assertNoCall(polish(chessDisk), 'polished disk');
assertNoCall(polish(CHESS_PAGE_HTML), 'polished bundled');
assert.match(polish(chessDisk), /function watchPrice/, 'chess buy watchPrice stays (not home Watch belt)');

{
  const chess = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess'), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get('x-dasha-edge'), 'chess');
  const html = await chess.text();
  assertNoCall(html, 'served chess');
  assert.match(html, new RegExp(PAIR), 'served chess pair');
  assert.match(html, /t\.me\/\+xB7S8mIQaKFiZjRh/, 'served chess official TG');
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.match(html, /Dasha versus Anna/, 'chess copy stays');
  assert.match(html, /function watchPrice/, 'served chess buy watchPrice stays');
}

{
  const embed = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess?embed=1'), {});
  assert.equal(embed.status, 200);
  const html = await embed.text();
  assertNoCall(html, 'served embed');
  assert.match(html, /src="\/client\/chess-local\.js"/, 'embed chess-local stays');
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, 'Watch chrome-hide stays');
  assert.match(html, /\.price,#price,\.ticker/, 'Watch price/ticker belt stays');
  assert.match(html, /#spark\{display:none!important\}/, 'Watch #spark hide stays');
  assert.match(html, /#dasha-home h1/, 'repair h1 stays');
  assert.doesNotMatch(html, /#dasha-home\s+#tool\s+label/, 'leftover #tool label gone');
  assert.match(html, /#dasha-home h2/, 'repair h2 stays');
  assert.match(html, /id=["']chat-door["']/, 'chat-door stays');
  assert.match(html, /id=["']simp-door["']/, 'simp-door stays');
  assert.match(html, /class=["']pill primary["']/, 'simp-door pill stays');
  assert.match(html, /id=["']dasha-home-faucet["']/, 'HOME_FAUCET_MOUNT stays');
  assert.match(html, /@view-transition/, '@view-transition stays');
  assert.match(html, />Buy</, 'Buy stays');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'home no plugin.jup.ag');
}

{
  const lobby = await edgeWorker.fetch(new Request('https://www.getdasha.com/lobby'), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /id=["']forum-play-go["']/, 'lobby Play stays');
  assert.match(html, /id=["']dasha-forum["']/, 'lobby threads stay');
  assert.match(html, /id=["']dasha-chess["']/, 'in-room chess stays');
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-chess-jup-boot-call-leftover: PASS (leftover bootJup() call dropped; buy sheet + jup.ag stay)');
