#!/usr/bin/env node
/** Home share card: $dasha + Buy. Head only. First paint stays word + Chat + Buy. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOME_OG_DESC,
  HOME_OG_IMAGE,
  HOME_OG_TITLE,
  HOME_OG_URL,
  dashaHomeBodySafeStrip,
  mintHomeDescription,
  mintHomeOg,
  mintHomeTitle,
  stripDeadNav,
  stripHomeOtherCoinWarning,
} from './dasha-lobby-worker.mjs';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const CARD = 'https://lobby.getdasha.com/og/dasha-social-card.png';

assert.equal(HOME_OG_TITLE, '$dasha');
assert.equal(HOME_OG_DESC, 'Buy $dasha.');
assert.equal(HOME_OG_IMAGE, CARD);
assert.equal(HOME_OG_URL, 'https://www.getdasha.com/');

function firstPaint(html) {
  const at = String(html).indexOf('id="grwm"');
  return at >= 0 ? html.slice(0, at) : html;
}

function assertShare(html, label) {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  assert.match(head, /property="og:title" content="\$dasha"/, `${label} og:title`);
  assert.match(head, /property="og:description" content="Buy \$dasha\."/, `${label} og:desc`);
  assert.match(head, /property="og:url" content="https:\/\/www\.getdasha\.com\/"/, `${label} og:url`);
  assert.match(head, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} og:image`);
  assert.match(head, /name="twitter:card" content="summary_large_image"/, `${label} twitter:card`);
  assert.match(head, /name="twitter:title" content="\$dasha"/, `${label} twitter:title`);
  assert.match(head, /name="twitter:description" content="Buy \$dasha\."/, `${label} twitter:desc`);
  assert.match(head, /name="twitter:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} twitter:image`);
  assert.equal((head.match(/property="og:title"/g) || []).length, 1, `${label} one og:title`);
  assert.equal((head.match(/property="og:description"/g) || []).length, 1, `${label} one og:desc`);
  assert.equal((head.match(/name="twitter:title"/g) || []).length, 1, `${label} one twitter:title`);
  assert.doesNotMatch(head, /Make something\. Pass it on/, `${label} no leftover Studio copy`);
  assert.doesNotMatch(head, /not CoinGecko|VVAIFU|not advice|disclaimer/i, `${label} no lecture`);
  assert.doesNotMatch(head, /plugin\.jup\.ag/, `${label} no plugin.jup`);
}

const empty = mintHomeOg('<html><head><title>old</title></head><body><p>keep</p></body></html>');
assertShare(empty, 'inject');
assert.match(empty, /<body><p>keep<\/p><\/body>/, 'body stays');

const webfow = mintHomeOg(`<!doctype html><html><head>
<title>$dasha — make the timeline stranger</title>
<meta content="Make something. Pass it on." property="og:description"/>
<meta content="$dasha — make the timeline stranger" property="og:title"/>
<meta content="https://cdn.example/old.png" property="og:image"/>
<meta content="Make something. Pass it on." name="twitter:description"/>
<meta content="$dasha — make the timeline stranger" name="twitter:title"/>
<meta content="https://lobby.getdasha.com/og/dasha-social-card.png" name="twitter:image"/>
<meta property="og:url" content="https://www.getdasha.com/">
<script>var keep=1;</script>
</head><body><header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header></body></html>`);
assertShare(webfow, 'webfow replace');
assert.match(webfow, /<script>var keep=1;<\/script>/, 'scripts stay');
assert.match(webfow, />Buy</, 'Buy stays');
assert.match(webfow, /\$<b>dasha<\/b>/, 'wordmark stays');
assert.doesNotMatch(webfow, /cdn\.example\/old\.png/, 'old image gone');

const afterDesc = mintHomeOg(mintHomeDescription(mintHomeTitle(`<head>
<title>mood</title>
<meta name="description" content="Make something. Pass it on.">
<meta property="og:description" content="Make something. Pass it on.">
</head><body></body>`)));
assertShare(afterDesc, 'after mintHomeDescription');
assert.match(afterDesc, /<title>\$dasha<\/title>/, 'document title $dasha');
assert.doesNotMatch(afterDesc, /make the timeline stranger/, 'no Webflow title');
assert.match(afterDesc, /name="description" content="\$dasha on getdasha\.com/, 'meta desc still names mint');

const HOME = `<!doctype html><html lang="en"><head>
<title>old home</title>
<meta content="Make something. Pass it on." property="og:title"/>
</head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<nav class="dasha-nav"><a href="/compute">Compute</a><a href="/chess">chess</a></nav>
<style id="dasha-home-compute">#compute-door{display:block!important}</style>
<section id="compute-door" aria-labelledby="compute-title"><h2 id="compute-title">Compute</h2><p><a href="/compute">Try the console</a></p></section>
<section id="chess-door"><h2>Play chess.</h2></section>
<p class="mint-lede">Not CoinGecko's Dasha (VVAIFU).</p>
<section id="chat-door">Chat</section>
<section id="grwm">GRWM</section>
</body></html>`;

const painted = mintHomeOg(stripHomeOtherCoinWarning(stripDeadNav(HOME)));
const paint = firstPaint(painted);
assertShare(painted, 'home transform');
assert.match(paint, /\$<b>dasha<\/b>/, 'first paint $dasha');
assert.match(paint, /href="\/lobby">Chat</, 'first paint Chat');
assert.match(paint, />Buy</, 'first paint Buy');
assert.doesNotMatch(paint, /id=["']chess-door["']/, 'no chess-door');
assert.doesNotMatch(paint, /VVAIFU/, 'no VVAIFU');
const visible = paint.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
assert.doesNotMatch(visible, /<a\b[^>]*href=["'][^"']*\/compute[^"']*["'][^>]*>/i, 'no Compute CTA');
assert.doesNotMatch(painted, /id=["']compute-door["']/, 'no compute-door');
assert.doesNotMatch(painted, /<nav class="dasha-nav">/, 'no leftover dasha-nav');
assert.doesNotMatch(painted, /id=["']dasha-home-compute["']/, 'no force-show compute CSS');
assert.doesNotMatch(visible, /Try the console/, 'no Try the console');
assert.doesNotMatch(painted, /plugin\.jup\.ag/);

const tiny = dashaHomeBodySafeStrip(HOME, '<html></html>');
assertShare(tiny, 'safe-strip fallback');
assert.match(tiny, /<body[\s>]/, 'fallback keeps body');
assert.match(tiny, />Buy</, 'fallback keeps Buy');

assert.match(workerSrc, /if \(isHome\) html = mintHomeOg\(html\);/);
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('x-dasha-edge'), 'compute');
  const html = await page.text();
  assert.match(html, /property="og:title" content="Dasha Compute"/);
  assert.match(html, /property="og:description" content="Use\. Provide\. Night\. Build\. Sponsor\."/);
  assert.match(html, /property="og:url" content="https:\/\/www\.getdasha\.com\/compute"/);
  assert.match(html, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
  assert.match(html, /name="twitter:title" content="Dasha Compute"/);
  assert.match(html, /name="twitter:description" content="Use\. Provide\. Night\. Build\. Sponsor\."/);
  assert.match(html, /name="twitter:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

console.log('dasha-home-og: PASS ($dasha Buy card, Webflow replace, first paint intact, /compute OG)');
