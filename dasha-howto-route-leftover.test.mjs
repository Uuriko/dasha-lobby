#!/usr/bin/env node
/**
 * Leftover after howto lecture DRY (SOL → mint → Buy. stays).
 * Live /how-to-buy 200 still paints leftover disclaimer
 * "Review the route there before confirming." after style/script strip.
 * Buy on Jupiter + mint stay. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { polishHowtoHtml } from './dasha-lobby-worker.mjs';
import { HOWTO_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /Review the route there before confirming/);
assert.match(workerSrc, /page = page\.replace\(\/\\s\*Review the route there before confirming\\\.\/g, ''\)/);

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>How to buy $dasha</title>
<style>.skip-link{position:absolute;left:-9999px}.risk{border-left:3px solid #ff3b81}</style>
</head><body>
<a class="skip-link" href="#ca">Skip to mint</a>
<main class="wrap">
  <h1>How to buy $dasha</h1>
  <p class="lede">SOL → mint → Buy.</p>
  <article class="step" data-n="03">
    <h2>Swap SOL → $dasha</h2>
    <p>Opens Jupiter with SOL selling into the exact mint above. Review the route there before confirming.</p>
    <div class="actions">
      <a class="btn" id="buy2" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111112&buy=${MINT}">Buy on Jupiter ↗</a>
    </div>
  </article>
  <footer><p><a href="/">Home</a> · <a href="/lobby">Lobby</a> · <a href="/privacy">Privacy</a></p></footer>
</main>
</body></html>`;

assert.match(afterStyleScript(LIVE), /Review the route there before confirming/, 'fixture leftover disclaimer paints after style/script strip');

const gone = polishHowtoHtml(LIVE);
assert.doesNotMatch(afterStyleScript(gone), /Review the route there before confirming/, 'drops leftover disclaimer after style/script strip');
assert.doesNotMatch(afterStyleScript(gone), /before confirming/, 'no leftover confirming lecture');
assert.match(gone, /Opens Jupiter with SOL selling into the exact mint above\./, 'Jupiter line stays');
assert.match(gone, />Buy on Jupiter/, 'Buy on Jupiter stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.match(gone, /<h1>How to buy \$dasha<\/h1>/, 'H1 stays');
assert.match(gone, /SOL → mint → Buy\./, 'lede stays');
assert.match(gone, /class=["']skip-link["']/, 'howto skip-link stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'disclaimer drop is per-sentence, not eat-the-page');

function assertNoDisclaimer(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /Review the route there before confirming/, `${label} no leftover disclaimer after style/script strip`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, />Buy on Jupiter/, `${label} Buy on Jupiter`);
  assert.match(html, /<h1>How to buy \$dasha<\/h1>/, `${label} H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoDisclaimer(polishHowtoHtml(HOWTO_HTML), 'polished disk');
assert.match(afterStyleScript(HOWTO_HTML), /Review the route there before confirming/, 'disk source still has leftover (polish drops it; did not run static-gen)');

{
  const howto = await edgeWorker.fetch(new Request('https://www.getdasha.com/how-to-buy'), {});
  assert.equal(howto.status, 200);
  assert.equal(howto.headers.get('x-dasha-edge'), 'howto');
  const html = await howto.text();
  assertNoDisclaimer(html, 'served howto');
  assert.match(html, /Opens Jupiter with SOL selling into the exact mint above\./, 'served Jupiter line');
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.doesNotMatch(afterStyleScript(html), /never opens a wallet/);
  assert.doesNotMatch(afterStyleScript(html), /not financial advice|NFA|dyor/i);
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-howto-route-leftover: PASS (leftover Review the route disclaimer dropped; Buy on Jupiter stays)');
