#!/usr/bin/env node
/**
 * Leftover after howto route disclaimer DRY (Buy on Jupiter stays).
 * Live /how-to-buy 200 still paints leftover when-lecture
 * "Read from the Solana mint account on 18 August 2026 at finalized commitment."
 * after style/script strip.
 * On-chain facts + Buy on Jupiter + mint stay. Disk only. No Designer. Never plugin.jup.ag.
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
assert.match(workerSrc, /Read from the Solana mint account on 18 August 2026 at finalized commitment/);
assert.match(
  workerSrc,
  /page = page\.replace\(\/\\s\*Read from the Solana mint account on 18 August 2026 at finalized commitment\\\./g, ''\)/,
);

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>How to buy $dasha</title>
<style>.skip-link{position:absolute;left:-9999px}.when{color:#888}</style>
</head><body>
<a class="skip-link" href="#ca">Skip to mint</a>
<main class="wrap">
  <h1>How to buy $dasha</h1>
  <p class="lede">SOL → mint → Buy.</p>
  <article class="step" data-n="03">
    <h2>Swap SOL → $dasha</h2>
    <p>Opens Jupiter with SOL selling into the exact mint above.</p>
    <div class="actions">
      <a class="btn" id="buy2" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111112&buy=${MINT}">Buy on Jupiter ↗</a>
    </div>
  </article>
  <section class="facts">
    <h2>On-chain</h2>
    <p class="when">Read from the Solana mint account on 18 August 2026 at finalized commitment. </p>
    <dl>
      <div style="display:contents"><dt>Supply</dt><dd>999,831,949 · observed 18 Aug 2026</dd></div>
      <div style="display:contents"><dt>Mint authority</dt><dd>revoked</dd></div>
      <div style="display:contents"><dt>Freeze authority</dt><dd>revoked</dd></div>
      <div style="display:contents"><dt>Top 10 wallets</dt><dd>42.5% of supply</dd></div>
    </dl>
  </section>
  <footer><p><a href="/">Home</a> · <a href="/lobby">Lobby</a> · <a href="/privacy">Privacy</a></p></footer>
</main>
</body></html>`;

assert.match(afterStyleScript(LIVE), /finalized commitment/, 'fixture leftover when-lecture paints after style/script strip');

const gone = polishHowtoHtml(LIVE);
assert.doesNotMatch(afterStyleScript(gone), /finalized commitment/, 'drops leftover when-lecture after style/script strip');
assert.doesNotMatch(afterStyleScript(gone), /Read from the Solana mint account/, 'no leftover mint-account lecture');
assert.doesNotMatch(afterStyleScript(gone), /<p class="when">/, 'empty leftover when p dropped');
assert.match(gone, />On-chain</, 'On-chain heading stays');
assert.match(gone, /Mint authority/, 'mint authority stays');
assert.match(gone, /Freeze authority/, 'freeze authority stays');
assert.match(gone, />Buy on Jupiter/, 'Buy on Jupiter stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.match(gone, /<h1>How to buy \$dasha<\/h1>/, 'H1 stays');
assert.match(gone, /SOL → mint → Buy\./, 'lede stays');
assert.match(gone, /class=["']skip-link["']/, 'howto skip-link stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'when-lecture drop is per-sentence, not eat-the-page');

function assertNoWhenLecture(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /finalized commitment/, `${label} no leftover when-lecture after style/script strip`);
  assert.doesNotMatch(afterStyleScript(html), /Read from the Solana mint account/, `${label} no leftover mint-account lecture`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, />Buy on Jupiter/, `${label} Buy on Jupiter`);
  assert.match(html, /<h1>How to buy \$dasha<\/h1>/, `${label} H1`);
  assert.match(html, />On-chain</, `${label} On-chain`);
  assert.match(html, /Mint authority/, `${label} mint authority`);
  assert.match(html, /Freeze authority/, `${label} freeze authority`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoWhenLecture(polishHowtoHtml(HOWTO_HTML), 'polished disk');
assert.match(afterStyleScript(HOWTO_HTML), /finalized commitment/, 'disk source still has leftover (polish drops it; did not run static-gen)');

{
  const howto = await edgeWorker.fetch(new Request('https://www.getdasha.com/how-to-buy'), {});
  assert.equal(howto.status, 200);
  assert.equal(howto.headers.get('x-dasha-edge'), 'howto');
  const html = await howto.text();
  assertNoWhenLecture(html, 'served howto');
  assert.match(html, /Opens Jupiter with SOL selling into the exact mint above\./, 'served Jupiter line');
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.doesNotMatch(afterStyleScript(html), /Review the route there before confirming/);
  assert.doesNotMatch(afterStyleScript(html), /never opens a wallet/);
  assert.doesNotMatch(afterStyleScript(html), /not financial advice|NFA|dyor/i);
  assert.doesNotMatch(html, /\.risk\s*\{/, 'served no leftover .risk CSS');
  assert.doesNotMatch(html, /\.facts \.when/, 'served no leftover .facts .when CSS');
  assert.doesNotMatch(html, /\.facts \.fine/, 'served no leftover .facts .fine CSS');
  assert.match(html, /class=["']skip-link["']/, 'served skip-link stays');
  assert.match(html, /class=["']actions["']/, 'served .actions stays');
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-howto-when-leftover: PASS (leftover when-lecture dropped; On-chain facts + Buy on Jupiter stay)');
