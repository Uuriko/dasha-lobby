#!/usr/bin/env node
/**
 * Leftover after empty #dasha-jup Jupiter plugin mount DRY (buy sheet + jup.ag stay).
 * Live /chess 200 still serializes leftover hideJup / bootJup / window.Jupiter.init
 * after the empty mount was already DOM-stripped. Humans see it in view-source.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  stripChessJupPluginBoot,
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
assert.match(workerSrc, /export function stripChessJupPluginBoot/);
assert.match(workerSrc, /out = stripChessJupPluginBoot\(out\);/);
assert.ok(workerSrc.includes('Leftover Jupiter plugin boot JS after empty #dasha-jup DOM-strip'));

const LIVE = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div id="chess-stage"></div>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><div id="buy-sheet-fallback"><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div></div>
<script>(function(){var amount='0.2';var input='sol';var booted=false;function $(id){return document.getElementById(id)}function jup(){return input==='usdc'?JUP_USDC:JUP_SOL}function flashBought(){}function hideJup(){var box=$('dasha-jup');if(box)box.hidden=true}function jupAmt(){var n=Number(amount);if(!(n>0)||!isFinite(n))return'';var d=input==='usdc'?6:9;var u=Math.round(n*Math.pow(10,d));return u>0?String(u):''}function bootJup(){var box=$('dasha-jup');if(!box)return;if(!window.Jupiter||!window.Jupiter.init){hideJup();return}var units=jupAmt();if(!units){hideJup();return}try{if(window.Jupiter.close)window.Jupiter.close();box.hidden=false;box.textContent='';window.Jupiter.init({displayMode:'integrated',integratedTargetId:'dasha-jup',formProps:{initialInputMint:input==='usdc'?USDC:WSOL,initialOutputMint:MINT,fixedMint:MINT,initialAmount:units},onSuccess:function(){flashBought()}})}catch(e){hideJup()}}function place(where){return $('buy-sheet')}function open(where){var sheet=place(where);if(!sheet)return;sheet.hidden=false;if(document.readyState==='complete')bootJup();else booted=true}function close(){var sheet=$('buy-sheet');if(sheet)sheet.hidden=true}function bind(){paintHref();if(document.readyState==='complete'){if(booted||($('buy-sheet')&&!$('buy-sheet').hidden))bootJup()}else window.addEventListener('load',function(){if(booted||($('buy-sheet')&&!$('buy-sheet').hidden))bootJup()})}})();</script>
<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a> · <a href="${TG}">Telegram</a></p></footer>
</body></html>`;

assert.doesNotMatch(LIVE, /id=["']dasha-jup["']/, 'fixture empty mount already DOM-stripped');
assert.match(LIVE, /function hideJup\(\)/, 'fixture leftover hideJup paints in view-source');
assert.match(LIVE, /function bootJup\(\)/, 'fixture leftover bootJup paints');
assert.match(LIVE, /window\.Jupiter\.init/, 'fixture leftover Jupiter.init paints');
assert.match(LIVE, /integratedTargetId:'dasha-jup'/, 'fixture leftover plugin target paints');
assert.match(LIVE, /function jup\(\)/, 'fixture jup.ag href helper stays');

const gone = stripChessJupPluginBoot(LIVE);
assert.doesNotMatch(gone, /function hideJup/, 'drops leftover hideJup');
assert.doesNotMatch(gone, /function jupAmt/, 'drops leftover jupAmt');
assert.doesNotMatch(gone, /function bootJup/, 'drops leftover bootJup');
assert.doesNotMatch(gone, /window\.Jupiter/, 'drops leftover window.Jupiter');
assert.doesNotMatch(gone, /integratedTargetId/, 'drops leftover plugin target');
assert.doesNotMatch(gone, /dasha-jup/, 'no leftover dasha-jup token');
assert.doesNotMatch(gone, /var booted=false/, 'drops leftover booted flag');
assert.match(gone, /function jup\(\)/, 'jup.ag href helper stays');
assert.match(gone, /id=["']buy-sheet["']/, 'buy sheet stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.match(gone, /src="\/client\/chess-local\.js"/, 'chess-local stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'boot drop is per-function, not eat-the-page');

assert.match(chessDisk, /function bootJup\(\)/, 'disk source still has leftover bootJup (polish drops it; did not run static-gen)');
assert.match(CHESS_PAGE_HTML, /function bootJup\(\)/, 'bundled still has leftover bootJup');
assert.match(chessDisk, /window\.Jupiter\.init/, 'disk leftover Jupiter.init');
assert.match(CHESS_PAGE_HTML, /window\.Jupiter\.init/, 'bundled leftover Jupiter.init');

function polish(html) {
  return stripChessJupPluginBoot(stripChessJupPluginMount(html));
}

function assertNoBoot(html, label) {
  assert.doesNotMatch(html, /function hideJup/, `${label} no leftover hideJup`);
  assert.doesNotMatch(html, /function bootJup/, `${label} no leftover bootJup`);
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

assertNoBoot(polish(LIVE), 'polished leftover fixture');
assertNoBoot(polish(chessDisk), 'polished disk');
assertNoBoot(polish(CHESS_PAGE_HTML), 'polished bundled');
assert.match(polish(chessDisk), /function watchPrice/, 'chess buy watchPrice stays (not home Watch belt)');

{
  const chess = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess'), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get('x-dasha-edge'), 'chess');
  const html = await chess.text();
  assertNoBoot(html, 'served chess');
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
  assertNoBoot(html, 'served embed');
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

console.log('dasha-chess-jup-boot-leftover: PASS (leftover Jupiter plugin boot JS dropped; buy sheet + jup.ag stay)');
