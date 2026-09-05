#!/usr/bin/env node
/**
 * Leftover after Full table DOM-strip (chess is Play in the room).
 * Live /lobby 200 still serializes leftover `.forum-play-full` CSS after
 * `<a class="forum-play-full">Full table</a>` was already DOM-stripped.
 * Humans see it in view-source. #forum-play-go + #dasha-forum + /forum/tape stay.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
} from './dasha-lobby-worker.mjs';
import { LOBBY_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const lobbyDisk = readFileSync(join(root, 'dasha-lobby-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.ok(workerSrc.includes('Leftover /lobby dropped-selector CSS after Full table DOM-strip'));
assert.ok(workerSrc.includes('.forum-play-full'));

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha Lobby</title>
<style>
.forum-play{margin:4.5rem 0 0}
.forum-play-row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center}
.forum-play-full{display:inline-flex;align-items:center;min-height:48px;color:var(--muted);font:800 .95rem/1 Arial,Helvetica,sans-serif;text-decoration:none}
#dasha-chess{margin-top:1.2rem}
.forum-send{min-height:48px}
</style>
</head><body>
<h1>Lobby</h1>
<section class="forum-play" aria-label="Play">
<h2>Play</h2>
<div class="forum-play-row">
<button type="button" class="forum-send" id="forum-play-go">Play</button>
</div>
<div id="dasha-chess" hidden></div>
</section>
<div id="dasha-forum"><p class="forum-empty">None yet.</p></div>
</body></html>`;

assert.match(LIVE, /\.forum-play-full\{/, 'fixture leftover .forum-play-full CSS paints in live <style>');
assert.doesNotMatch(LIVE, /class=["']forum-play-full["']/, 'fixture Full table already DOM-stripped');
assert.match(LIVE, /id=["']forum-play-go["']/, 'fixture Play stays in DOM');
assert.match(LIVE, /id=["']dasha-forum["']/, 'fixture threads mount stays in DOM');

const gone = rewriteLobbyForumChrome(LIVE);
assert.doesNotMatch(gone, /\.forum-play-full/, 'drops leftover .forum-play-full CSS');
assert.doesNotMatch(gone, /forum-play-full/, 'no leftover forum-play-full token');
assert.match(gone, /\.forum-play\{/, '.forum-play CSS stays');
assert.match(gone, /\.forum-play-row\{/, '.forum-play-row CSS stays');
assert.match(gone, /id=["']forum-play-go["']/, 'Play stays');
assert.match(gone, /id=["']dasha-forum["']/, 'threads mount stays');
assert.match(gone, /id=["']dasha-chess["']/, 'in-room chess stays');
assert.match(gone, /<h1>Lobby<\/h1>/, 'Lobby H1 stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'CSS drop is per-rule, not eat-the-page');

assert.match(lobbyDisk, /\.forum-play-full\{/, 'disk source still has leftover .forum-play-full CSS (polish drops it; did not run static-gen)');
assert.match(LOBBY_PAGE_HTML, /\.forum-play-full\{/, 'bundled still has leftover .forum-play-full CSS');

function assertNoDroppedCss(html, label) {
  assert.doesNotMatch(html, /\.forum-play-full/, `${label} no leftover .forum-play-full CSS`);
  assert.doesNotMatch(html, /class=["']forum-play-full["']/, `${label} no Full table class`);
  assert.doesNotMatch(html, />Full table</, `${label} no Full table`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} Play`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} threads mount`);
  assert.match(html, /id=["']dasha-chess["']/, `${label} in-room chess`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.match(html, /\.forum-play\{/, `${label} .forum-play CSS stays`);
  assert.match(html, /\.forum-play-row\{/, `${label} .forum-play-row CSS stays`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoDroppedCss(asStandaloneLobbyPage(LIVE), 'standalone leftover fixture');
assertNoDroppedCss(asStandaloneLobbyPage(lobbyDisk), 'standalone disk');
assertNoDroppedCss(asStandaloneLobbyPage(LOBBY_PAGE_HTML), 'standalone bundled');
assert.match(asStandaloneLobbyPage(lobbyDisk), new RegExp(MINT), 'standalone disk mint');

{
  const lobby = await edgeWorker.fetch(new Request('https://www.getdasha.com/lobby'), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get('x-dasha-edge'), 'lobby-page');
  const html = await lobby.text();
  assertNoDroppedCss(html, 'served lobby');
  assert.match(html, new RegExp(MINT), 'served lobby mint');
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

console.log('dasha-lobby-play-full-css: PASS (leftover .forum-play-full CSS dropped; Play + threads + in-room chess stay)');
