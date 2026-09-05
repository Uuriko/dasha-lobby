#!/usr/bin/env node
/**
 * Leftover after home CSS lecture DRY.
 * Live / 200 still serializes a leftover standalone @view-transition <style>
 * after product CSS already serializes the same rules. Humans see duplicate
 * @view-transition in view-source. Product @view-transition stays.
 * Distinct leftover vs CSS lecture comments. GRWM + Watch belt stay.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  stripDeadNav,
  stripHomeLeftoverDupViewTransitionCss,
  stripHomeWebflowBoot,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const CHERRIES = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20fill%3D%22%23dfff00%22%2F%3E%3C%2Fsvg%3E">';
const DUP = `<style>
  @view-transition { navigation: auto; }
  @media (prefers-reduced-motion: reduce) {
    @view-transition { navigation: none; }
  }
  ::view-transition-old(root), ::view-transition-new(root) { animation-duration: .18s; }
</style>`;
const PRODUCT = `<style>
  @view-transition { navigation: auto; }
  @media (prefers-reduced-motion: reduce) {
    @view-transition { navigation: none; }
  }
  ::view-transition-old(root), ::view-transition-new(root) { animation-duration: .18s; }
  :root{--ink:#070608;--paper:#f4eddb;--acid:#dfff00}
  .dasha{min-height:100vh}
  .pill.primary{background:var(--acid)}
  .price{margin:22px 0 0}.ticker{position:relative}
</style>`;

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripHomeLeftoverDupViewTransitionCss/);
assert.match(workerSrc, /out = stripHomeLeftoverDupViewTransitionCss\(out\);/);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [''])[0],
  /#grwm \.grwm-phone/,
  'mobile-scroll still unlocks GRWM phone',
);
assert.match(
  (workerSrc.match(/const style = '<style id="dasha-home-chrome-hide">[\s\S]*?<\/style>';/) || [''])[0],
  /\.price,#price,\.ticker.*#spark\{display:none!important\}/,
  'Watch belt selector list stays',
);

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
${CHERRIES}
<link rel="stylesheet" href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css">
${DUP}
${PRODUCT}
<link rel="canonical" href="https://www.getdasha.com/">
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grwm"><div class="grwm-phone"></div></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main>
<script src="https://lobby.getdasha.com/client/x-connect.js"></script>
<script src="https://lobby.getdasha.com/client/faucet.js"></script>
</body></html>`;

assert.equal((LIVE.match(/@view-transition/g) || []).length, 4, 'fixture leftover duplicate @view-transition paints twice (rules+reduce) in two style tags');
assert.match(LIVE, /::view-transition-old\(root\)/, 'fixture leftover view-transition pseudo paints');
assert.match(LIVE, /\.dasha\{min-height:100vh\}/, 'fixture product CSS stays');

function viewTransitionOnlyStyleCount(html) {
  const blocks = [...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  return blocks.filter((m) => {
    const css = m[1];
    if (!/@view-transition/i.test(css)) return false;
    const rest = css
      .replace(/@media[^{]*\{\s*@view-transition\s*\{[^}]*\}\s*\}/gi, '')
      .replace(/@view-transition\s*\{[^}]*\}/gi, '')
      .replace(/::view-transition-(?:old|new)\([^)]*\)(?:\s*,\s*::view-transition-(?:old|new)\([^)]*\))*\s*\{[^}]*\}/gi, '')
      .replace(/[,;{}]/g, '')
      .replace(/\s+/g, '');
    return rest.length === 0;
  }).length;
}

assert.equal(viewTransitionOnlyStyleCount(LIVE), 1, 'fixture has leftover standalone @view-transition style');

const gone = stripHomeLeftoverDupViewTransitionCss(LIVE);
assert.equal(viewTransitionOnlyStyleCount(gone), 0, 'drops leftover standalone @view-transition style');
assert.match(gone, /@view-transition/, 'product @view-transition stays');
assert.match(gone, /::view-transition-old\(root\)/, 'product view-transition pseudo stays');
assert.match(gone, /\.dasha\{min-height:100vh\}/, 'product .dasha CSS stays');
assert.match(gone, /\.pill\.primary/, 'product .pill.primary stays');
assert.match(gone, /\.price\{/, 'Watch price CSS stays');
assert.match(gone, /\.ticker\{/, 'Watch ticker CSS stays');
assert.match(gone, /data:image\/svg\+xml/, 'cherries SVG stays');
assert.match(gone, /johns-awesome/, 'johns-awesome stays');
assert.match(gone, /id=["']chat-door["']/, 'chat-door stays');
assert.match(gone, /id=["']simp-door["']/, 'simp-door stays');
assert.match(gone, /id=["']grok-door["']/, 'grok-door stays');
assert.match(gone, /id=["']grwm["']/, 'GRWM stays');
assert.match(gone, /x-connect\.js/, 'x-connect.js stays');
assert.match(gone, /faucet\.js/, 'faucet.js stays');
assert.match(gone, />Buy</, 'Buy stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.5, 'dup drop is per-style, not eat-the-page');

const only = stripHomeLeftoverDupViewTransitionCss(`<!doctype html><html lang="en" id="dasha-home"><head>${DUP}</head><body><section id="chat-door"></section></body></html>`);
assert.match(only, /@view-transition/, 'solo @view-transition style stays when it is the only copy');

const other = stripHomeLeftoverDupViewTransitionCss(`<html><head>${DUP}${PRODUCT}</head><body><p>privacy skip</p></body></html>`);
assert.equal(viewTransitionOnlyStyleCount(other), 1, 'non-home pages keep leftover standalone @view-transition');

const booted = stripHomeWebflowBoot(LIVE);
assert.equal(viewTransitionOnlyStyleCount(booted), 0, 'boot drops leftover standalone @view-transition style');
assert.match(booted, /@view-transition/, 'boot keeps product @view-transition');
assert.match(booted, /\.dasha\{min-height:100vh\}/, 'boot keeps product .dasha');
assert.match(booted, /id=["']chat-door["']/, 'boot keeps chat-door');
assert.match(booted, /x-connect\.js/, 'boot keeps x-connect.js');
assert.match(booted, /faucet\.js/, 'boot keeps faucet.js');
assert.match(booted, /johns-awesome/, 'boot keeps johns-awesome');
assert.doesNotMatch(booted, /plugin\.jup\.ag/, 'boot no plugin.jup.ag');

const rewritten = stripDeadNav(LIVE);
assert.equal(viewTransitionOnlyStyleCount(rewritten), 0, 'stripDeadNav drops leftover standalone @view-transition style');
assert.match(rewritten, /@view-transition/, 'rewrite keeps product @view-transition');
assert.match(rewritten, /id=["']chat-door["']/, 'rewrite keeps chat-door');
assert.match(rewritten, /id=["']grok-door["']/, 'rewrite keeps grok-door');
assert.doesNotMatch(rewritten, /id=["']compute-door["']/, 'rewrite no compute-door');
assert.doesNotMatch(rewritten, /plugin\.jup\.ag/, 'rewrite no plugin.jup.ag');

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-dasha-edge'), 'html-security');
  const html = await home.text();
  assert.equal(viewTransitionOnlyStyleCount(html), 0, 'served home no leftover standalone @view-transition style');
  assert.match(html, /@view-transition/, 'served product @view-transition');
  assert.match(html, /data:image\/svg\+xml/, 'served cherries SVG');
  assert.match(html, /johns-awesome/, 'served johns-awesome');
  assert.match(html, /id=["']chat-door["']/, 'served chat-door');
  assert.match(html, /id=["']simp-door["']/, 'served simp-door');
  assert.match(html, /id=["']grok-door["']/, 'served grok-door');
  assert.match(html, /id=["']grwm["']/, 'served GRWM');
  assert.match(html, /id=["']dasha-digest-remount["']/, 'served digest remount');
  assert.match(html, /\/digest\.json/, 'served /digest.json');
  assert.match(html, /x-connect\.js/, 'served x-connect.js');
  assert.match(html, /faucet\.js/, 'served faucet.js');
  assert.match(html, /jup\.ag\/swap/, 'served jup.ag');
  assert.match(html, new RegExp(MINT), 'served mint');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'served no plugin.jup.ag');
  assert.doesNotMatch(html, /id=["']compute-door["']/, 'served no compute-door');
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-home-view-transition-dup-css: PASS (leftover standalone @view-transition style dropped; product @view-transition stays)');
