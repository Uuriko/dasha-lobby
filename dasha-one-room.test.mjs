#!/usr/bin/env node
/** One room: chat + threads + Play. /forum is not a second product. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  asStandaloneLobbyPage,
  forumRssXml,
  forumToLobbyRedirect,
  rewriteLobbyForumChrome,
} from './dasha-lobby-worker.mjs';
import { createHash } from 'node:crypto';
import { LOBBY_CLIENT_JS, LOBBY_CLIENT_SRI, LOBBY_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(join(root, 'dasha-lobby-page.html'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

const leftoverForum = `<!doctype html><html><head>
<title>Forum — $dasha</title>
<meta name="description" content="Chat.">
<link rel="canonical" href="https://www.getdasha.com/forum">
<meta property="og:url" content="https://www.getdasha.com/forum">
<meta property="og:title" content="Forum — $dasha">
<meta property="og:description" content="Chat.">
<meta property="og:image:alt" content="Forum — $dasha">
<meta name="twitter:title" content="Forum — $dasha">
<meta name="twitter:description" content="Chat.">
</head><body>
<h1>Forum</h1>
<p class="forum-sub">Chat.</p>
<section class="forum-play"><h2>Play</h2>
<div class="forum-play-row">
<button type="button" class="forum-send" id="forum-play-go">Play</button>
<a class="forum-play-full" href="/chess">Full table</a>
</div></section>
<footer class="dasha-foot"><p><a href="https://www.getdasha.com/">$dasha</a> · <a href="https://www.getdasha.com/forum">Forum</a> · <a href="https://www.getdasha.com/bag">Bag</a> · <a href="/chess">Chess</a></p></footer>
</body></html>`;

function assertOneRoom(html, label) {
  assert.match(html, /<title>\$dasha Lobby<\/title>/, `${label} title`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} H1`);
  assert.match(html, /Chat in the lobby\./, `${label} sub`);
  assert.match(html, /property="og:title" content="\$dasha Lobby"/, `${label} og title`);
  assert.match(html, /property="og:description" content="Chat\. Play\. Fill the jar\. Buy\."/, `${label} og desc`);
  assert.match(html, /name="twitter:title" content="\$dasha Lobby"/, `${label} twitter title`);
  assert.match(html, /name="twitter:description" content="Chat\. Play\. Fill the jar\. Buy\."/, `${label} twitter desc`);
  assert.doesNotMatch(html, /<h1>Forum<\/h1>/, `${label} no Forum H1`);
  assert.doesNotMatch(html, /<title>Forum/, `${label} no Forum title`);
  assert.doesNotMatch(html, />Forum<\/a>/, `${label} no Forum footer product`);
  assert.doesNotMatch(html, /Full table/, `${label} no Full table`);
  assert.doesNotMatch(html, /href="\/chess"/, `${label} no /chess door`);
  assert.doesNotMatch(html, /href="https:\/\/www\.getdasha\.com\/chess"/, `${label} no chess chrome dest`);
}

assertOneRoom(rewriteLobbyForumChrome(leftoverForum), 'rewrite leftover');
assertOneRoom(asStandaloneLobbyPage(leftoverForum), 'standalone leftover');
assertOneRoom(asStandaloneLobbyPage(LOBBY_PAGE_HTML), 'standalone bundled');
assertOneRoom(asStandaloneLobbyPage(pageSrc), 'standalone source');
assertOneRoom(pageSrc, 'disk source');

assert.match(pageSrc, /id="forum-play-go"/, 'Play button stays');
assert.match(pageSrc, /\/chess\?embed=1/, 'Play iframe host stays');
assert.match(pageSrc, /id="dasha-forum"/, 'threads mount stays');
assert.match(pageSrc, /class="forum-now"/, 'forum-* class names stay');
assert.match(pageSrc, /<h2>Play<\/h2>/);
assert.match(pageSrc, /id="threads-title">Threads<\/h2>/);
assert.match(pageSrc, />Tape\./);
assert.doesNotMatch(pageSrc, /<h2>Forum<\/h2>/);

{
  const res = forumToLobbyRedirect(new URL('https://www.getdasha.com/forum'));
  assert.equal(res.status, 308);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/lobby');
  assert.doesNotMatch(res.headers.get('location') || '', /pane=threads/);
}

{
  const res = forumToLobbyRedirect(new URL('https://www.getdasha.com/forum?t=abc'));
  assert.equal(res.status, 308);
  const loc = res.headers.get('location') || '';
  assert.match(loc, /[?&]t=abc/);
  assert.match(loc, /^https:\/\/www\.getdasha\.com\/lobby\?t=abc/);
}

{
  const res = forumToLobbyRedirect(new URL('https://lobby.getdasha.com/forum/'));
  assert.equal(res.status, 308);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/lobby');
}

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const forum = await edgeWorker.fetch(new Request(`${origin}/forum`), {});
  assert.equal(forum.status, 308, `${origin}/forum is not a 200 Forum page`);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
  const body = await forum.text();
  assert.doesNotMatch(body, /<title>Forum — \$dasha<\/title>/);
  assert.doesNotMatch(body, /Long-form threads/);

  const withT = await edgeWorker.fetch(new Request(`${origin}/forum?t=abc`), {});
  assert.equal(withT.status, 308, `${origin}/forum?t=abc`);
  assert.match(withT.headers.get('location') || '', /[?&]t=abc/);
}

assert.match(forumRssXml([]), /<title>\$dasha Lobby<\/title>/);
assert.doesNotMatch(forumRssXml([]), /<title>\$dasha forum<\/title>/);
assert.match(workerSrc, /Lobby: public chat and lasting threads in one room/);
assert.doesNotMatch(workerSrc, /^Chess: rated games\./m);

assert.doesNotMatch(LOBBY_CLIENT_JS, /el\('h2','df-title','Forum'\)/);
assert.doesNotMatch(LOBBY_CLIENT_JS, /Forum is unreachable/);
assert.match(LOBBY_CLIENT_JS, /say\('Threads are down\.'\)/);
assert.match(LOBBY_CLIENT_JS, /aria-label','Threads'/);
assert.match(LOBBY_CLIENT_JS, /Start a thread\. · /);
assert.match(LOBBY_CLIENT_JS, /Link X to post\. · /);

const lobbySri = 'sha384-' + createHash('sha384').update(LOBBY_CLIENT_JS, 'utf8').digest('base64');
assert.equal(LOBBY_CLIENT_SRI, lobbySri);
assert.match(pageSrc, new RegExp(lobbySri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(LOBBY_PAGE_HTML, new RegExp(lobbySri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

console.log('dasha-one-room: PASS (Lobby chrome, no Forum product, no Full table, /forum 308 to /lobby)');
