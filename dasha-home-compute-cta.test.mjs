#!/usr/bin/env node
/** No visible homepage Compute CTA. /compute stays a real 200. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hideHomeExtraChrome,
  mountHomeChessAndFaucet,
  stripDeadNav,
  stripHomeCompute,
  stripHomeOtherCoinWarning,
} from './dasha-lobby-worker.mjs';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

const FORCE_SHOW = '<style id="dasha-home-compute">#compute-door,.compute,#compute-door a,a[href="/compute"],a[href="https://www.getdasha.com/compute"]{display:revert!important}#compute-door{display:block!important}#compute-door a[href*="github.com/Uuriko/dasha-desk"]{display:inline!important}</style>';
const DOOR = '<section id="compute-door" aria-labelledby="compute-title"><h2 id="compute-title">Compute</h2><p>Route OpenAI-shaped test prompts to participating Macs.</p><p>Open alpha · providers can read prompts · no billing yet.</p><p><a href="/compute">Try the console</a> · <a href="https://github.com/Uuriko/dasha-desk/tree/main/compute">Review source</a></p></section>';

const LEFTOVER = `<!doctype html><html lang="en"><head>
<title>$dasha dash_eats — make the timeline stranger</title>
${FORCE_SHOW}
</head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
${DOOR}
<p id="dasha-home-lede" class="dasha-home-lede">dash_eats culture. Match the mint.</p>
<section id="chat-door"><h2>Chat.</h2></section>
<section id="grwm">GRWM</section>
</body></html>`;

function firstPaint(html) {
  const at = String(html).indexOf('id="grwm"');
  return at >= 0 ? html.slice(0, at) : html;
}

function visibleText(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
}

function assertNoVisibleComputeCta(html, label) {
  const paint = firstPaint(html);
  const visible = visibleText(paint);
  assert.doesNotMatch(html, /id=["']dasha-home-compute["']/, `${label} no force-show style`);
  assert.doesNotMatch(html, /id=["']compute-door["']/, `${label} no compute-door`);
  assert.doesNotMatch(visible, /Try the console/, `${label} no Try the console`);
  assert.doesNotMatch(visible, /<a\b[^>]*href=["'][^"']*\/compute[^"']*["'][^>]*>/i, `${label} no visible /compute link`);
  assert.doesNotMatch(visible, />\s*Compute\s*</, `${label} no Compute heading`);
  assert.match(paint, /\$<b>dasha<\/b>/, `${label} first paint $dasha`);
  assert.match(paint, /href="\/lobby">Chat</, `${label} first paint Chat`);
  assert.match(paint, />Buy</, `${label} first paint Buy`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup`);
}

assert.match(LEFTOVER, /id=["']compute-door["']/, 'fixture has door');
assert.match(LEFTOVER, /Try the console/, 'fixture has CTA');
assert.match(LEFTOVER, /id=["']dasha-home-compute["']/, 'fixture has force-show');

const stripped = stripHomeCompute(LEFTOVER);
assertNoVisibleComputeCta(stripped, 'stripHomeCompute');
assert.match(stripped, /id=["']dasha-home-lede["']/, 'lede stays');
assert.match(stripped, /id=["']chat-door["']/, 'chat-door stays');

const hidden = hideHomeExtraChrome(LEFTOVER);
assert.match(hidden, /id=["']dasha-home-chrome-hide["']/, 'chrome-hide present');
{
  const hide = (hidden.match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.doesNotMatch(hide, /#compute-door/, 'chrome-hide does not lecture dropped compute-door');
  assert.match(hide, /\.price/, 'Watch price belt stays');
}

const mounted = mountHomeChessAndFaucet(LEFTOVER);
assert.doesNotMatch(mounted, /id=["']compute-door["']/, 'mount cuts leftover door');
assert.match(mounted, /id=["']dasha-home-faucet["']|id=["']dasha-faucet["']/, 'faucet still mounts');

const full = stripHomeOtherCoinWarning(stripDeadNav(LEFTOVER));
assertNoVisibleComputeCta(full, 'stripDeadNav');
assert.match(full, /id=["']dasha-home-faucet["']|id=["']dasha-faucet["']/, 'full still mounts faucet');
assert.match(full, /id=["']chat-door["']/, 'full keeps chat-door');

assert.doesNotMatch(workerSrc, /Try the console/, 'worker does not inject Try the console');
assert.doesNotMatch(workerSrc, /#compute-door\{display:block!important\}/, 'worker does not force-show the door');
assert.match(workerSrc, /dropIdedElement\(out, 'compute-door'\)/, 'worker strips the door');
assert.match(workerSrc, /dasha-home-compute/, 'worker still knows the leftover style id (to strip it)');

{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
  assert.equal(page.status, 200, '/compute stays 200');
  assert.equal(page.headers.get('x-dasha-edge'), 'compute');
  const html = await page.text();
  assert.match(html, /Start\. Ask\. Provide\. Pay\. Credits\./, "compute Start-gate copy");
  assert.doesNotMatch(html, /Use\. Provide\. Night\. Build\./, "old compute slogan retired");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

console.log('dasha-home-compute-cta: PASS (leftover door+force-show stripped, /compute 200, faucet stays)');
