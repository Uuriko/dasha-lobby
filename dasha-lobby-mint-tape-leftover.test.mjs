#!/usr/bin/env node
/**
 * Leftover after Forum chrome DRY (internal #dasha-forum / forum-* / /forum/tape stay).
 * Live /lobby 200 still paints empty CSS-hidden #dasha-mint-tape after style/script strip.
 * Tape lives in #dasha-digest. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  asStandaloneLobbyPage,
  isQuietTapePath,
  stripLobbyMintTapeMount,
} from './dasha-lobby-worker.mjs';
import { LOBBY_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const lobbyDisk = readFileSync(join(root, 'dasha-lobby-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripLobbyMintTapeMount/);
assert.match(workerSrc, /src = stripLobbyMintTapeMount\(src\);/);
assert.match(workerSrc, /p === '\/forum\/tape'/);
assert.match(workerSrc, /p === '\/lobby\/tape'/);

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha Lobby</title>
<style>#dasha-chess iframe{display:block}#dasha-mint-tape{display:none}.dasha-forum{display:grid}</style>
</head><body>
<h1>Lobby</h1>
<p class="forum-sub">Chat in the lobby.</p>
<div id="dasha-mint-tape" hidden data-tape-api="https://lobby.getdasha.com/forum/tape"></div>
<section class="forum-now"><h2>Now</h2></section>
<section class="forum-play"><h2>Play</h2>
<button type="button" id="forum-play-go">Play</button>
<div id="dasha-chess" hidden></div>
</section>
<div id="dasha-forum"><p class="forum-empty">None yet.</p></div>
<section id="dasha-digest"><h2>Tape.<a href="/digest">/digest</a></h2></section>
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']dasha-mint-tape["']/, 'fixture leftover empty mount paints after style/script strip');
assert.match(LIVE, /#dasha-mint-tape\{display:none\}/, 'fixture leftover hide CSS');

const gone = stripLobbyMintTapeMount(LIVE);
assert.doesNotMatch(afterStyleScript(gone), /id=["']dasha-mint-tape["']/, 'drops leftover empty #dasha-mint-tape mount');
assert.doesNotMatch(gone, /#dasha-mint-tape/, 'drops leftover #dasha-mint-tape CSS');
assert.doesNotMatch(gone, /data-tape-api/, 'drops leftover tape-api attr with the mount');
assert.match(gone, /id=["']dasha-forum["']/, 'threads mount stays');
assert.match(gone, /id=["']forum-play-go["']/, 'Play stays');
assert.match(gone, /id=["']dasha-chess["']/, 'in-room chess stays');
assert.match(gone, /id=["']dasha-digest["']/, 'digest tape stays');
assert.match(gone, /<h1>Lobby<\/h1>/, 'Lobby H1 stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'mount drop is per-element, not eat-the-page');

function assertNoMount(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /id=["']dasha-mint-tape["']/, `${label} no empty #dasha-mint-tape after style/script strip`);
  assert.doesNotMatch(html, /#dasha-mint-tape/, `${label} no leftover #dasha-mint-tape CSS`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} threads mount`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} Play`);
  assert.match(html, /id=["']dasha-digest["']/, `${label} digest tape`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoMount(stripLobbyMintTapeMount(lobbyDisk), 'disk source');
assertNoMount(asStandaloneLobbyPage(lobbyDisk), 'standalone disk');
assertNoMount(asStandaloneLobbyPage(LOBBY_PAGE_HTML), 'standalone bundled');
assertNoMount(asStandaloneLobbyPage(LIVE), 'standalone leftover fixture');

assert.equal(isQuietTapePath('/forum/tape'), true, '/forum/tape stays');
assert.equal(isQuietTapePath('/lobby/tape'), true, '/lobby/tape stays');

{
  const lobby = await edgeWorker.fetch(new Request('https://www.getdasha.com/lobby'), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get('x-dasha-edge'), 'lobby-page');
  const html = await lobby.text();
  assertNoMount(html, 'served lobby');
  assert.match(html, new RegExp(MINT), 'served lobby mint');
  assert.match(html, /jup\.ag\/swap/, 'served lobby jup.ag');
  assert.match(html, /t\.me\/\+xB7S8mIQaKFiZjRh/, 'served lobby official TG');
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.doesNotMatch(afterStyleScript(html), />Forum</, 'no Forum product word after style/script strip');
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

void PAIR;
console.log('dasha-lobby-mint-tape-leftover: PASS (empty #dasha-mint-tape dropped; #dasha-forum / Play / /forum/tape stay)');
