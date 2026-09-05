#!/usr/bin/env node
/**
 * Leftover after htmlPage .cta CSS on Worker 404 (contribute still uses .cta).
 * Live html-404 still serializes leftover `.cta` CSS after the 404 DOM never had
 * class="cta". Humans see it in view-source. Product skip-link stays.
 * Disk htmlPage still emits .cta (polish drops it on Not this page). No Designer.
 * Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { stripNotFoundDroppedCtaCss } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.ok(workerSrc.includes('Leftover html-404 dropped-selector CSS after .cta was never in the 404 DOM'));
assert.ok(workerSrc.includes('export function stripNotFoundDroppedCtaCss'));
assert.equal(
  (workerSrc.match(/stripNotFoundDroppedCtaCss\(NOT_FOUND_HTML\)/g) || []).length,
  4,
  'all four 404 serve sites polish leftover .cta CSS',
);
assert.match(workerSrc, /\.cta\{display:inline-flex/, 'htmlPage still emits leftover .cta CSS (404 polish drops it)');
assert.match(workerSrc, /const NOT_FOUND_HTML = htmlPage\('Not found — \$dasha'/);

const LIVE = `<!doctype html><html lang="en"><head>
<title>Not found — $dasha</title>
<meta name="robots" content="noindex,follow">
<style>body{font:16px/1.45 Arial,Helvetica,sans-serif;background:#070608;color:#f4eddb;max-width:28rem;margin:3rem auto;padding:0 1rem}a,code{color:#dfff00}.cta{display:inline-flex;align-items:center;min-height:48px;padding:0 16px;background:#dfff00;color:#070608;font-weight:900;text-decoration:none;box-shadow:4px 4px 0 #ff3b81}.skip-link{position:absolute;left:-9999px;top:0;z-index:100;padding:12px 16px;background:#dfff00;color:#070608!important;font-weight:900;text-decoration:none}.skip-link:focus{left:12px;top:12px;outline:3px solid #f4eddb;outline-offset:2px}</style>
</head>
<body><a class="skip-link" href="#dasha-page">Skip to content</a><main id="dasha-page"><h1>Not this page.</h1>
<p>Simp Board, Lobby, faucet, and how to buy live on getdasha.com. This URL is not one of them.</p>
<p><code>${MINT}</code></p>
<p><a href="https://www.getdasha.com/">Home</a> · <a href="https://www.getdasha.com/simp">Simp</a> · <a href="https://www.getdasha.com/lobby">Lobby</a> · <a href="https://www.getdasha.com/faucet">Faucet</a> · <a href="https://www.getdasha.com/how-to-buy">How to buy</a> · <a href="https://www.getdasha.com/privacy">Privacy</a></p></main></body></html>`;

assert.match(LIVE, /\.cta\{/, 'fixture leftover .cta CSS paints in live <style>');
assert.doesNotMatch(LIVE, /class=["'][^"']*\bcta\b/, 'fixture 404 never had .cta class');
assert.match(LIVE, /class=["']skip-link["']/, 'fixture skip-link stays in DOM');

const gone = stripNotFoundDroppedCtaCss(LIVE);
assert.doesNotMatch(gone, /\.cta\s*\{/, 'drops leftover .cta CSS');
assert.doesNotMatch(gone, /class=["'][^"']*\bcta\b/, 'no leftover .cta class');
assert.match(gone, /class=["']skip-link["']/, 'skip-link class stays');
assert.match(gone, /\.skip-link\{/, 'skip-link CSS stays');
assert.match(gone, /\.skip-link:focus\{/, 'skip-link:focus CSS stays');
assert.match(gone, /<h1>Not this page\.<\/h1>/, '404 H1 stays');
assert.match(gone, /Simp Board, Lobby, faucet/, '404 copy stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.7, 'CSS drop is per-rule, not eat-the-page');

const keepContribute = stripNotFoundDroppedCtaCss(`<!doctype html><html><head>
<link rel="canonical" href="https://www.getdasha.com/contribute">
<style>.cta{display:inline-flex}</style></head>
<body><h1>Build Dasha.</h1><p><a class="cta" href="https://github.com/Uuriko/dasha-desk/contribute">Pick a first issue ↗</a></p></body></html>`);
assert.match(keepContribute, /\.cta\{/, 'non-404 htmlPage .cta CSS stays');
assert.match(keepContribute, /class="cta"/, 'contribute .cta class stays');

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/checkout'), {});
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('x-dasha-edge'), 'retired-commerce');
  const html = await res.text();
  assert.doesNotMatch(html, /\.cta\s*\{/, 'served 404 drops leftover .cta CSS');
  assert.doesNotMatch(html, /class=["'][^"']*\bcta\b/, 'served 404 has no .cta class');
  assert.match(html, /class=["']skip-link["']/, 'served skip-link stays');
  assert.match(html, /\.skip-link\{/, 'served skip-link CSS stays');
  assert.match(html, /<h1>Not this page\.<\/h1>/);
  assert.match(html, new RegExp(MINT));
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/client/studio.js'), {});
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('x-dasha-edge'), 'retired-studio');
  const html = await res.text();
  assert.doesNotMatch(html, /\.cta\s*\{/, 'retired-studio 404 drops leftover .cta CSS');
  assert.match(html, /class=["']skip-link["']/, 'retired-studio skip-link stays');
  assert.match(html, /<h1>Not this page\.<\/h1>/);
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/contribute'), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']cta["']/, 'contribute .cta stays');
  assert.match(html, /\.cta\{/, 'contribute .cta CSS stays');
  assert.match(html, /Pick a first issue/);
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /\.cta\s*\{/, 'privacy leftover .cta CSS stays dropped');
  assert.match(html, /class=["']skip-link["']/, 'privacy skip-link stays');
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/bounties'), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  const visible = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (!/class=["'][^"']*\bcta\b/.test(visible)) {
    assert.doesNotMatch(html, /\.cta\s*\{/, 'empty bounties leftover .cta CSS stays dropped');
  }
  assert.match(html, /class=["']skip-link["']/, 'bounties skip-link stays');
  assert.match(html, /id=["']bb-app["']/, 'bb-app stays');
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/login'), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Verify holder perks/, '/login hidden perks stay');
  assert.match(html, /class=["']skip-link["']/, 'login skip-link stays');
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/which'), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /VVAIFU/, '/which VVAIFU stays');
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Mac Studio/, 'Mac Studio stays');
  assert.match(html, /Use\. Provide\. Night\. Build\. Sponsor\./, 'compute OG stays');
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /\$dasha/);
  assert.match(html, /Chat/);
  assert.match(html, /Buy/);
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
  assert.match(html, /johns-awesome/, 'johns-awesome stays');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'home no plugin.jup.ag');
}

{
  const lobby = await edgeWorker.fetch(new Request('https://www.getdasha.com/lobby'), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /id=["']forum-play-go["']/, 'Play stays');
  assert.match(html, /id=["']dasha-forum["']/, 'forum mount stays');
  assert.match(html, /id=["']dasha-chess["']/, 'chess mount stays');
  assert.match(html, /class=["']forum-play["']/, '.forum-play stays');
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

{
  const chess = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess'), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /function jup\(/, 'chess jup() stays');
  assert.match(html, /jup\.ag/, 'chess jup.ag stays');
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /bootJup/);
}

void MINT;
console.log('dasha-notfound-cta-leftover: PASS (html-404 leftover .cta CSS gone; skip-link + contribute .cta stay)');
