#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  hideHomeExtraChrome,
  stripHomeStudioFirstPaint,
  dashaHomeBodySafeStrip,
  stripDeadNav,
  dropScriptIf,
  unlockHomeMobileScroll,
} from './dasha-lobby-worker.mjs';

const PRICE_SCRIPT = `<script>(()=>{try{
const el=id=>document.getElementById(id);
const box=el('price');if(!box)return;
async function tick(){
  const r=await fetch('https://lobby.getdasha.com/price',{cache:'no-store'});
  if(!r.ok)return; const p=await r.json();
  el('price-now').textContent='$0.0001';
  box.hidden=false;
}
tick();
}catch(e){}})();</script>`;

const PRICE_VARIANT = `<script>(()=>{const r=await fetch('/price',{cache:'no-store'});
function priceBox(){var n=document.createElement('span');n.id='price';document.body.appendChild(n);return n}
priceBox();})()</script>`;

const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const BUY = `<a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a>`;
const PAD = 'It’s time $dasha. '.repeat(900);
const TOKEN = `<section id="token"><a href="https://www.geckoterminal.com/solana/pools/9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7">Chart ↗</a></section>`;

const doc = `<!doctype html><html><head><title>old</title>
<style id="dasha-home-chrome-hide">.price,#price{display:none}</style>
</head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a>${BUY}</header>
<h1>It’s time $dasha.</h1>
<div class="actions"></div>
<div class="price" id="price" hidden><span class="price-now" id="price-now">—</span><span class="price-chg" id="price-chg"></span><p class="price-note" id="price-note"></p></div>
<p>${PAD}</p>
${TOKEN}
${PRICE_SCRIPT}
${PRICE_VARIANT}
<script type="application/ld+json">{"@type":"WebSite","name":"$dasha"}</script>
</body></html>`;

const stripped = stripHomeStudioFirstPaint(doc);
assert.doesNotMatch(stripped, /lobby\.getdasha\.com\/price/, 'drops gecko /price script');
assert.doesNotMatch(stripped, /function priceBox/, 'drops create-#price script');
assert.doesNotMatch(stripped, /id="price"/, 'drops #price node');
assert.match(stripped, /Buy/, 'keeps Buy');
assert.match(stripped, /<body/, 'keeps body');
assert.match(stripped, /id="token"/, 'keeps #token Chart further down');
assert.match(stripped, /geckoterminal\.com\/solana\/pools/, 'Chart link stays on #token');
assert.match(stripped, /<body/, 'strip is not a studio# eater');

const hidden = hideHomeExtraChrome(doc);
assert.match(hidden, /id="dasha-home-chrome-hide"/, 'chrome hide present');
assert.match(hidden, /\.price,#price,\.ticker/, 'keeps core hide selectors');
assert.match(hidden, /#price-now,#price-chg,#price-note,#spark/, 'hides remount internals');
assert.equal((hidden.match(/id="dasha-home-chrome-hide"/g) || []).length, 1, 'replaces existing hide, no dup');

const studioSeed = `${doc}<script>(()=>{const href="/studio#"+1;document.querySelectorAll('a[href^="/studio"]').forEach(()=>{})})()</script>`;
const safeStudio = stripHomeStudioFirstPaint(studioSeed);
assert.match(safeStudio, /<body/, 'per-script drop keeps body');
assert.match(safeStudio, /Buy/, 'per-script drop keeps Buy');
assert.doesNotMatch(safeStudio, /const href="\/studio#"/, 'drops only the studio seed script');

const tiny = dashaHomeBodySafeStrip(doc, '<html></html>');
assert.match(tiny, /<body/, 'safe-strip returns upstream body');
assert.match(tiny, /Buy/, 'safe-strip keeps Buy');

const live = readFileSync('/tmp/dasha-price/b_home', 'utf8');
const liveOut = stripDeadNav(live);
assert.match(liveOut, /<body/i, 'live transform keeps body');
assert.match(liveOut, /Buy/, 'live transform keeps Buy');
assert.doesNotMatch(liveOut, /\bid=["']token["']/, 'live leftover id=token dropped');
assert.match(liveOut, /id="mint"/, 'live mint stays');
assert.match(liveOut, /geckoterminal\.com\/solana\/pools/, 'live Chart stays');
assert.match(liveOut, /id="chat-door"/, 'live has chat door');
assert.match(liveOut, /id="simp-door"/, 'live has quiz door');
assert.match(liveOut, /Take the quiz/, 'quiz door says Take the quiz');
assert.match(liveOut, /Chat in the lobby/, 'chat door says Lobby/Chat');
assert.doesNotMatch(liveOut, /id="bag-door"/, 'bag is not a major door');
assert.match(liveOut, /href="\/bag"/, 'quiet /bag link stays');
assert.doesNotMatch(liveOut, /Forum/, 'home has no Forum word');
assert.doesNotMatch(liveOut, /id="chess-door"/, 'live has no chess-door');
assert.doesNotMatch(liveOut, /<a\b[^>]*href="\/chess"/, 'live strips leftover /chess door');
assert.doesNotMatch(liveOut, /<a\b[^>]*href="\/dasha"/, 'live strips leftover /dasha desk door');
assert.doesNotMatch(liveOut, /<a\b[^>]*href="\/desk"/, 'live strips leftover /desk door');
assert.match(liveOut, /id="dasha-home-lede"/, 'first-paint lede names culture + mint');
{
  const chat = liveOut.indexOf('id="chat-door"');
  const quiz = liveOut.indexOf('id="simp-door"');
  const faucet = liveOut.indexOf('id="dasha-home-faucet"');
  const grwm = liveOut.indexOf('id="grwm"');
  assert.ok(chat >= 0 && quiz > chat && faucet > quiz && grwm > faucet, 'reel is Chat, Quiz, Faucet, then GRWM');
}
assert.doesNotMatch(liveOut, /Loading studio|Open Studio|editable Dasha Studio/i, 'no studio 200 copy');
assert.match(liveOut, /id="dasha-faucet"/, 'live keeps faucet');
assert.doesNotMatch(liveOut, /lobby\.getdasha\.com\/price/, 'live has no /price script');
assert.match(liveOut, /dasha-home-chrome-hide/, 'live hide style stays');
assert.match(liveOut, /#price-now,#price-chg,#price-note,#spark/, 'live hide includes remount selectors');
assert.ok(liveOut.length > 15000, 'live transform not tiny');
assert.doesNotMatch(liveOut, /plugin\.jup\.ag/, 'no jup plugin');
assert.doesNotMatch(liveOut, /class=["'][^"']*\bdasha-root\b/, 'live leftover dasha-root class dropped');
assert.doesNotMatch(liveOut, /querySelector\(['"]footer['"]\)/, 'live leftover remount footer querySelector dropped');
assert.doesNotMatch(liveOut, /\bid=["']content["']/, 'live leftover id=content dropped');
assert.match(liveOut, /id="dasha-home"/, 'live dasha-home id stays');
assert.match(liveOut, /id="top"/, 'live #top stays');
assert.match(liveOut, /\.dasha-root/, 'live mobile-scroll .dasha-root unlock stays');
assert.match(liveOut, /id="dasha-mobile-scroll"/, 'live unlocks mobile scroll');
assert.match(liveOut, /animation-timeline:auto/, 'kills view timelines');
assert.match(liveOut, /overflow:visible!important/, 'wrappers do not become scrollports');
assert.doesNotMatch(liveOut.split('id="dasha-mobile-scroll"')[1].slice(0,800), /overflow-y:auto/, 'unlock does not nest overflow-y auto');
assert.match(liveOut, /touch-action:pan-y/, 'GRWM swipe goes to the page');

const unlocked = unlockHomeMobileScroll('<html><head></head><body><section id="grwm"></section></body></html>');
assert.match(unlocked, /id="dasha-mobile-scroll"/, 'injects unlock style');
assert.equal((unlockHomeMobileScroll(unlocked).match(/id="dasha-mobile-scroll"/g) || []).length, 1, 'replaces unlock, no dup');

console.log('dasha-home-price-lock unit: PASS');
