#!/usr/bin/env node
/**
 * Live home had <img src="https://lobby.getdasha.com/r/px.gif?ref=home">.
 * The asset 404s. Browser would fetch it. Strip the tag. First paint stays
 * $dasha + Chat + Buy. Privacy never-collects and /digest.json tape stay.
 * Disk only. No Designer. No Studio. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  dashaHomeBodySafeStrip,
  stripDeadNav,
  stripDeadTrackingPixel,
  stripHomeOtherCoinWarning,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripDeadTrackingPixel/);
assert.match(workerSrc, /out = stripDeadTrackingPixel\(out\);/);
assert.match(workerSrc, /html = stripDeadTrackingPixel\(html\);/);
assert.match(
  workerSrc,
  /Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards\./,
);
assert.match(workerSrc, /path === '\/digest\.json'/);
assert.match(workerSrc, /applyDigestTape/);

const LIVE_PIXEL =
  '<img src="https://lobby.getdasha.com/r/px.gif?ref=home" width="1" height="1" alt="" style="position:absolute;left:-9999px;width:1px;height:1px" referrerpolicy="no-referrer">';

const KEEP_ICON =
  '<img src="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/6a767a48e1dd29d210f01235_dasha-icon-32.png" alt="dasha">';

function firstPaint(html) {
  const at = String(html).indexOf('id="grwm"');
  return at >= 0 ? html.slice(0, at) : html;
}

assert.equal(stripDeadTrackingPixel(''), '');
assert.equal(stripDeadTrackingPixel(LIVE_PIXEL).trim(), '');
assert.equal(
  stripDeadTrackingPixel(`<main>${LIVE_PIXEL}</main>`),
  '<main></main>',
);
assert.equal(stripDeadTrackingPixel(KEEP_ICON), KEEP_ICON);
assert.equal(
  stripDeadTrackingPixel('<link href="https://lobby.getdasha.com/r/px.gif" rel="prefetch">'),
  '',
);
assert.match(
  stripDeadTrackingPixel(`<a href="https://lobby.getdasha.com/r/px.gif">not auto-fetched</a>`),
  /not auto-fetched/,
);

const HOME = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<section id="chat-door">Chat</section>
<section id="grwm">GRWM</section>
<footer><a href="/privacy">Privacy</a></footer>
${LIVE_PIXEL}
</main>
</body></html>`;

const stripped = stripDeadTrackingPixel(HOME);
assert.doesNotMatch(stripped, /px\.gif/);
assert.doesNotMatch(stripped, /lobby\.getdasha\.com\/r\/px/);
assert.match(stripped, /\$<b>dasha<\/b>/);
assert.match(stripped, /href="\/lobby">Chat</);
assert.match(stripped, />Buy</);
assert.doesNotMatch(stripped, /plugin\.jup\.ag/);
assert.doesNotMatch(stripped, /Designer|Studio/);

const painted = stripHomeOtherCoinWarning(stripDeadNav(HOME));
assert.doesNotMatch(painted, /px\.gif/);
const paint = firstPaint(painted);
assert.match(paint, /\$<b>dasha<\/b>/, 'first paint $dasha');
assert.match(paint, /href="\/lobby">Chat</, 'first paint Chat');
assert.match(paint, />Buy</, 'first paint Buy');
assert.doesNotMatch(paint, /Designer/);
assert.doesNotMatch(painted, /plugin\.jup\.ag/);
assert.doesNotMatch(painted, /href="\/studio/);

const safe = dashaHomeBodySafeStrip(HOME, painted);
assert.doesNotMatch(stripDeadTrackingPixel(safe), /px\.gif/);
assert.match(safe, />Buy</);

const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
assert.equal(privacy.status, 200);
assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
const privacyHtml = await privacy.text();
assert.match(privacyHtml, /<h1>Privacy<\/h1>/);
assert.match(
  privacyHtml,
  /Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards\./,
);
assert.doesNotMatch(privacyHtml, /px\.gif/);

const digest = await edgeWorker.fetch(new Request('https://www.getdasha.com/digest.json'), {});
assert.equal(digest.status, 200);
assert.equal(digest.headers.get('x-dasha-edge'), 'digest-json');
const pack = JSON.parse(await digest.text());
assert.ok(pack.at);
assert.ok(Array.isArray(pack.items));

console.log('dasha-home-px-gif: PASS (strip px.gif; first paint; privacy; digest.json)');
