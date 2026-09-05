#!/usr/bin/env node
/**
 * Leftover after howto route disclaimer + when-lecture DRY (Buy on Jupiter stays).
 * Live /how-to-buy 200 still serializes leftover `.risk` / `.facts .when` /
 * `.facts .fine` CSS after those nodes were already DOM-stripped.
 * Humans see it in view-source. Skip-link + .actions + On-chain facts stay.
 * Disk only. No Designer. Never plugin.jup.ag.
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
assert.ok(workerSrc.includes('Leftover /how-to-buy dropped-selector CSS after .risk/.when/.fine DOM-strip'));
assert.ok(workerSrc.includes('.risk b'));
assert.ok(workerSrc.includes('.facts \\.when'));
assert.ok(workerSrc.includes('.facts \\.fine'));

const LIVE = `<!doctype html><html lang="en"><head>
<title>How to buy $dasha</title>
<style>
.skip-link{position:absolute;left:-9999px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.btn{min-height:48px}
.risk{margin:12px 0 0;padding:12px 14px;border-left:3px solid var(--hot);background:var(--panel);color:var(--paper);font-size:.95rem}
.risk b{color:var(--hot)}
.facts{border-top:1px solid var(--line);padding:18px 0 0;margin:0}
.facts h2{margin:6px 0 4px}
.facts .when{margin:0 0 12px;color:var(--muted);font-size:.9rem}
.facts dl{margin:0}
.facts .fine{margin:12px 0 0;color:var(--muted);font-size:.9rem}
</style>
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
    <dl>
      <div style="display:contents"><dt>Supply</dt><dd>999,831,949 · observed 18 Aug 2026</dd></div>
      <div style="display:contents"><dt>Mint authority</dt><dd>revoked</dd></div>
      <div style="display:contents"><dt>Freeze authority</dt><dd>revoked</dd></div>
    </dl>
  </section>
  <footer><p><a href="/">Home</a> · <a href="/lobby">Lobby</a> · <a href="/privacy">Privacy</a></p></footer>
</main>
</body></html>`;

assert.match(LIVE, /\.risk\{/, 'fixture leftover .risk CSS paints in live <style>');
assert.match(LIVE, /\.risk b\{/, 'fixture leftover .risk b CSS paints');
assert.match(LIVE, /\.facts \.when\{/, 'fixture leftover .facts .when CSS paints');
assert.match(LIVE, /\.facts \.fine\{/, 'fixture leftover .facts .fine CSS paints');
assert.doesNotMatch(LIVE, /class=["']risk["']/, 'fixture .risk already DOM-stripped');
assert.doesNotMatch(LIVE, /class=["']when["']/, 'fixture .when already DOM-stripped');
assert.doesNotMatch(LIVE, /class=["']fine["']/, 'fixture .fine already DOM-stripped');
assert.match(LIVE, /class=["']skip-link["']/, 'fixture skip-link stays in DOM');
assert.match(LIVE, /class=["']actions["']/, 'fixture .actions stays in DOM');

const gone = polishHowtoHtml(LIVE);
assert.doesNotMatch(gone, /\.risk\s*\{/, 'drops leftover .risk CSS');
assert.doesNotMatch(gone, /\.risk b/, 'drops leftover .risk b CSS');
assert.doesNotMatch(gone, /\.facts \.when/, 'drops leftover .facts .when CSS');
assert.doesNotMatch(gone, /\.facts \.fine/, 'drops leftover .facts .fine CSS');
assert.match(gone, /\.actions\{display:flex/, '.actions CSS stays');
assert.match(gone, /class=["']actions["']/, '.actions class stays');
assert.match(gone, /\.skip-link\{/, 'skip-link CSS stays');
assert.match(gone, /class=["']skip-link["']/, 'skip-link class stays');
assert.match(gone, /\.facts\{/, '.facts CSS stays');
assert.match(gone, /\.facts h2\{/, '.facts h2 CSS stays');
assert.match(gone, /\.facts dl\{/, '.facts dl CSS stays');
assert.match(gone, />On-chain</, 'On-chain heading stays');
assert.match(gone, /Mint authority/, 'mint authority stays');
assert.match(gone, />Buy on Jupiter/, 'Buy on Jupiter stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.match(gone, /<h1>How to buy \$dasha<\/h1>/, 'H1 stays');
assert.match(gone, /SOL → mint → Buy\./, 'lede stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'CSS drop is per-rule, not eat-the-page');

assert.match(HOWTO_HTML, /\.risk\{/, 'disk source still has leftover .risk CSS (polish drops it; did not run static-gen)');
assert.match(HOWTO_HTML, /\.facts \.when\{/, 'disk source still has leftover .when CSS');
assert.match(HOWTO_HTML, /\.facts \.fine\{/, 'disk source still has leftover .fine CSS');

function assertNoDroppedCss(html, label) {
  assert.doesNotMatch(html, /\.risk\s*\{/, `${label} no leftover .risk CSS`);
  assert.doesNotMatch(html, /\.facts \.when/, `${label} no leftover .facts .when CSS`);
  assert.doesNotMatch(html, /\.facts \.fine/, `${label} no leftover .facts .fine CSS`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, />Buy on Jupiter/, `${label} Buy on Jupiter`);
  assert.match(html, /<h1>How to buy \$dasha<\/h1>/, `${label} H1`);
  assert.match(html, /class=["']skip-link["']/, `${label} skip-link`);
  assert.match(html, /class=["']actions["']/, `${label} .actions`);
  assert.match(html, />On-chain</, `${label} On-chain`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoDroppedCss(polishHowtoHtml(HOWTO_HTML), 'polished disk');

{
  const howto = await edgeWorker.fetch(new Request('https://www.getdasha.com/how-to-buy'), {});
  assert.equal(howto.status, 200);
  assert.equal(howto.headers.get('x-dasha-edge'), 'howto');
  const html = await howto.text();
  assertNoDroppedCss(html, 'served howto');
  assert.match(html, /Opens Jupiter with SOL selling into the exact mint above\./, 'served Jupiter line');
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
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
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, 'privacy product skip-link stays');
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-howto-dropped-selector-css: PASS (leftover .risk/.when/.fine CSS dropped; skip-link + .actions + On-chain + Buy on Jupiter stay)');
