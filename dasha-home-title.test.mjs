#!/usr/bin/env node
/** Home <title> is $dasha. Old Webflow / AEO line is a leftover. OG stays $dasha. First paint intact. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOME_OG_TITLE,
  dashaHomeBodySafeStrip,
  mintHomeOg,
  mintHomeTitle,
  stripDeadNav,
  stripHomeOtherCoinWarning,
} from './dasha-lobby-worker.mjs';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.equal(HOME_OG_TITLE, '$dasha');
assert.match(workerSrc, /const HOME_TITLE = '\$dasha'/);
assert.doesNotMatch(workerSrc, /const HOME_TITLE = '[^']*make the timeline stranger/);
assert.doesNotMatch(workerSrc, /description: 'make the timeline stranger'/);
assert.match(workerSrc, /description: HOME_OG_DESC/);
assert.doesNotMatch(workerSrc, /if \(\/<title>\[^<\]*\(\?:dash_eats/, 'mintHomeTitle must not keep a dash_eats leftover title');
assert.match(workerSrc, /if \(isHome\) html = mintHomeTitle\(html\);/);

function firstPaint(html) {
  const at = String(html).indexOf('id="grwm"');
  return at >= 0 ? html.slice(0, at) : html;
}

function assertTitle(html, label) {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  assert.match(head, /<title>\$dasha<\/title>/, `${label} document title`);
  assert.equal((head.match(/<title>/gi) || []).length, 1, `${label} one title`);
  assert.doesNotMatch(head, /make the timeline stranger/, `${label} no Webflow line`);
  assert.doesNotMatch(head, /<title>[^<]*dash_eats/, `${label} title is not the AEO leftover`);
  assert.doesNotMatch(head, /not CoinGecko|VVAIFU|not advice|disclaimer/i, `${label} no lecture`);
}

const missing = mintHomeTitle('<html><head></head><body><p>keep</p></body></html>');
assertTitle(missing, 'inject');
assert.match(missing, /<body><p>keep<\/p><\/body>/, 'body stays');

const already = mintHomeTitle('<html><head><title>$dasha</title></head><body></body></html>');
assertTitle(already, 'already $dasha');

for (const leftover of [
  '$dasha dash_eats — make the timeline stranger',
  '$dasha — make the timeline stranger',
  'make the timeline stranger',
  'old home',
]) {
  const out = mintHomeTitle(`<head><title>${leftover}</title></head>`);
  assertTitle(out, leftover);
}

const HOME = `<!doctype html><html lang="en"><head>
<title>$dasha dash_eats — make the timeline stranger</title>
<meta content="$dasha — make the timeline stranger" property="og:title"/>
</head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<section id="chat-door">Chat</section>
<section id="grwm">GRWM</section>
</body></html>`;

const painted = mintHomeOg(mintHomeTitle(stripHomeOtherCoinWarning(stripDeadNav(HOME))));
assertTitle(painted, 'home transform');
assert.match(painted, /property="og:title" content="\$dasha"/, 'og:title still $dasha');
assert.match(painted, /name="twitter:title" content="\$dasha"/, 'twitter:title still $dasha');
assert.match(painted, /property="og:description" content="Buy \$dasha\."/, 'og:desc');
const paint = firstPaint(painted);
assert.match(paint, /\$<b>dasha<\/b>/, 'first paint $dasha');
assert.match(paint, /href="\/lobby">Chat</, 'first paint Chat');
assert.match(paint, />Buy</, 'first paint Buy');
assert.doesNotMatch(painted, /plugin\.jup\.ag/);

const tiny = dashaHomeBodySafeStrip(HOME, '<html></html>');
assertTitle(tiny, 'safe-strip fallback');
assert.match(tiny, />Buy</, 'fallback keeps Buy');

{
  const prev = globalThis.fetch;
  globalThis.fetch = async () => new Response(HOME, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  try {
    const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
    assert.equal(home.status, 200);
    const body = await home.text();
    assertTitle(body, 'worker fetch');
    assert.match(body, /property="og:title" content="\$dasha"/);
    assert.match(body, /name="twitter:title" content="\$dasha"/);
    assert.match(firstPaint(body), />Buy</);
    assert.doesNotMatch(body, /plugin\.jup\.ag/);
  } finally {
    globalThis.fetch = prev;
  }
}

console.log('dasha-home-title: PASS (<title>$dasha, Webflow/AEO leftover rewritten, first paint + OG intact)');
