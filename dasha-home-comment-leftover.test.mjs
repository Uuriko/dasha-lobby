#!/usr/bin/env node
/**
 * Leftover after RETIRED product-mark comment DRY.
 * Live / 200 still paints leftover HTML comments after style/script strip:
 *   cherries-lecture, view-transition lecture ("another agent is mid-rewrite"),
 *   Dasha canonical URL.
 * Cherries SVG + @view-transition + canonical link stay. Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { stripHomeWebflowBoot } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /slot-machine cherries/);
assert.match(workerSrc, /Cross-document view transitions/);
assert.match(workerSrc, /Dasha canonical URL/);

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

const CHERRIES = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20fill%3D%22%23dfff00%22%2F%3E%3C%2Fsvg%3E">';
const ICON_NOTE = '<!-- Dasha site icon: slot-machine cherries. Canonical source is dasha-favicon.svg in the project repo; regenerate the PNGs from it rather than editing them. -->';
const VIEW_TRANS = `<!-- Cross-document view transitions. Site-wide on purpose: a navigation transition needs the rule
     on BOTH the page being left and the page being entered, and this is the one place that covers
     every surface without editing a generated embed another agent is mid-rewrite on. -->`;
const CANON = '<!-- Dasha canonical URL -->';
const VIEW_CSS = '<style>@view-transition{navigation:auto}</style>';

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
${ICON_NOTE}
${CHERRIES}
${VIEW_TRANS}
${VIEW_CSS}
${CANON}
<link rel="canonical" href="https://www.getdasha.com/">
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main>
<script src="https://lobby.getdasha.com/client/x-connect.js"></script>
<script src="https://lobby.getdasha.com/client/faucet.js"></script>
</body></html>`;

assert.match(afterStyleScript(LIVE), /Dasha site icon: slot-machine cherries/, 'fixture leftover cherries lecture paints after style/script strip');
assert.match(afterStyleScript(LIVE), /another agent is mid-rewrite/, 'fixture leftover view-transition lecture paints after style/script strip');
assert.match(afterStyleScript(LIVE), /Dasha canonical URL/, 'fixture leftover canonical comment paints after style/script strip');

const gone = stripHomeWebflowBoot(LIVE);
assert.doesNotMatch(afterStyleScript(gone), /Dasha site icon: slot-machine cherries/, 'drops leftover cherries lecture after style/script strip');
assert.doesNotMatch(afterStyleScript(gone), /regenerate the PNGs/, 'drops leftover PNG lecture');
assert.doesNotMatch(afterStyleScript(gone), /Cross-document view transitions/, 'drops leftover view-transition lecture');
assert.doesNotMatch(afterStyleScript(gone), /another agent is mid-rewrite/, 'drops leftover agent-process lecture');
assert.doesNotMatch(afterStyleScript(gone), /Dasha canonical URL/, 'drops leftover canonical comment');
assert.match(gone, /data:image\/svg\+xml/, 'cherries SVG stays');
assert.match(gone, /@view-transition/, '@view-transition stays');
assert.match(gone, /rel="canonical"/, 'canonical link stays');
assert.match(gone, /id=["']chat-door["']/, 'chat-door stays');
assert.match(gone, /id=["']simp-door["']/, 'simp-door stays');
assert.match(gone, /id=["']grok-door["']/, 'grok-door stays');
assert.match(gone, /x-connect\.js/, 'x-connect.js stays');
assert.match(gone, /faucet\.js/, 'faucet.js stays');
assert.match(gone, /<header class="bar">/, 'header.bar stays');
assert.match(gone, />Buy</, 'Buy stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'comment drop is per-comment, not eat-the-page');

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-dasha-edge'), 'html-security');
  const html = await home.text();
  const stripped = afterStyleScript(html);
  assert.doesNotMatch(stripped, /Dasha site icon: slot-machine cherries/, 'served home no leftover cherries lecture after style/script strip');
  assert.doesNotMatch(stripped, /Cross-document view transitions/, 'served home no leftover view-transition lecture after style/script strip');
  assert.doesNotMatch(stripped, /another agent is mid-rewrite/, 'served home no leftover agent-process lecture');
  assert.doesNotMatch(stripped, /Dasha canonical URL/, 'served home no leftover canonical comment');
  assert.match(html, /data:image\/svg\+xml/, 'served cherries SVG');
  assert.match(html, /@view-transition/, 'served @view-transition');
  assert.match(html, /rel="canonical"/, 'served canonical link');
  assert.match(html, /id=["']chat-door["']/, 'served chat-door');
  assert.match(html, /id=["']simp-door["']/, 'served simp-door');
  assert.match(html, /id=["']grok-door["']/, 'served grok-door');
  assert.match(html, /x-connect\.js/, 'served x-connect.js');
  assert.match(html, /faucet\.js/, 'served faucet.js');
  assert.match(html, /johns-awesome/, 'served johns-awesome');
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

console.log('dasha-home-comment-leftover: PASS (leftover home HTML comments dropped; cherries SVG + @view-transition stay)');
