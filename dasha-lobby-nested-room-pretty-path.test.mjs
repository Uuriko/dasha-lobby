#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 0ff8cee2): live nested lobby room doors
 * /lobby/play /lobby/game /lobby/chess (+slash / Title-case) html-404 → 308
 * https://www.getdasha.com/lobby. /lobby/forum /lobby/chat stay OUT of
 * potterHome308Dest and 308 via isForumChatAliasPath + forumToLobbyRedirect
 * (keep ?t= → /lobby?t=…#threads). Chess is in-room Play, never a leftover
 * door. /arcade /games stay 404 — Arcade is draft PR #44 only.
 * Exact /chess /lobby stay 200 (null dest). Do not fold /lobby/ /lobby/feed.xml
 * /lobby/tape /lobby/ws /lobby/card/*. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  potterHome308Dest,
  isForumChatAliasPath,
  forumToLobbyRedirect,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(
  workerSrc,
  /Nested \/lobby\/play \/lobby\/game \/lobby\/chess \(\+slash \/ Title-case\) → \/lobby/,
  'potterHome308Dest comment lists nested /lobby/play|/game|/chess → /lobby',
);
assert.match(
  workerSrc,
  /\/lobby\/forum \/lobby\/chat stay OUT of potterHome308Dest/,
  'nested /lobby/forum|/chat stay OUT of potterHome308Dest',
);
assert.match(
  workerSrc,
  /Do not fold \/lobby \/lobby\/ \/lobby\/feed\.xml \/lobby\/tape \/lobby\/ws \/lobby\/card\/\*/,
  'comment keeps lobby room handlers out of the fold',
);
assert.match(workerSrc, /\/arcade \/games stay 404/, 'comment keeps /arcade /games 404');
assert.match(
  workerSrc,
  /p === '\/lobby\/play' \|\| p === '\/lobby\/play\/'/,
  'exact nested /lobby/play (+slash) fold',
);
assert.match(
  workerSrc,
  /p === '\/lobby\/game' \|\| p === '\/lobby\/game\/'/,
  'exact nested /lobby/game (+slash) fold',
);
assert.match(
  workerSrc,
  /p === '\/lobby\/chess' \|\| p === '\/lobby\/chess\/'/,
  'exact nested /lobby/chess (+slash) fold',
);
assert.match(
  workerSrc,
  /p === '\/lobby\/forum' \|\| p === '\/lobby\/forum\/' \|\| p === '\/lobby\/chat' \|\| p === '\/lobby\/chat\/'/,
  'isForumChatAliasPath matches nested /lobby/forum|/chat (+slash)',
);

const WWW = 'https://www.getdasha.com';
const LOBBY = `${WWW}/lobby`;

const ROOM_FOLDS = [
  '/lobby/play', '/lobby/play/', '/Lobby/Play', '/LOBBY/PLAY', '/lObBy/pLaY/',
  '/lobby/game', '/lobby/game/', '/Lobby/Game', '/LOBBY/GAME', '/lObBy/gAmE/',
  '/lobby/chess', '/lobby/chess/', '/Lobby/Chess', '/LOBBY/CHESS', '/lObBy/cHeSs/',
];
const FORUM_CHAT_ALIASES = [
  '/lobby/forum', '/lobby/forum/', '/Lobby/Forum', '/LOBBY/FORUM', '/lObBy/fOrUm/',
  '/lobby/chat', '/lobby/chat/', '/Lobby/Chat', '/LOBBY/CHAT', '/lObBy/cHaT/',
];
const STAY_404 = [
  '/arcade', '/arcade/', '/Arcade', '/ARCADE',
  '/games', '/games/', '/Games', '/GAMES',
];
const ROOM_HANDLERS = [
  '/lobby', '/lobby/',
  '/lobby/feed.xml', '/lobby/tape', '/lobby/ws',
  '/lobby/card/abc.png',
];

for (const path of ROOM_FOLDS) {
  assert.equal(potterHome308Dest(path), LOBBY, path);
}
for (const path of FORUM_CHAT_ALIASES) {
  assert.equal(isForumChatAliasPath(path), true, path);
  assert.equal(potterHome308Dest(path), null, `${path} not in potterHome308Dest`);
}
assert.equal(isForumChatAliasPath('/lobby'), false);
assert.equal(isForumChatAliasPath('/lobby/play'), false);
assert.equal(isForumChatAliasPath('/forum/threads'), false);
for (const path of STAY_404) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 404 (Arcade PR #44)`);
}
for (const path of ROOM_HANDLERS) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}
assert.equal(potterHome308Dest('/chess'), null, 'bare /chess stays 200');
assert.equal(potterHome308Dest('/play'), LOBBY, 'apex /play still folds');
assert.equal(potterHome308Dest('/game'), LOBBY, 'apex /game still folds');

{
  const res = forumToLobbyRedirect(new URL('https://www.getdasha.com/lobby/forum?t=abc'));
  assert.equal(res.status, 308);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, LOBBY);
  assert.equal(loc.searchParams.get('t'), 'abc');
  assert.equal(loc.hash, '#threads');
}

const env = {
  LOBBY_SESSION_SECRET: 'nested-room-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName() { return 'public'; },
    get() {
      return {
        async fetch() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          });
        },
      };
    },
  },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ROOM_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), LOBBY, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of FORUM_CHAT_ALIASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const loc = res.headers.get('location');
      assert.ok(loc === LOBBY || loc.startsWith(`${LOBBY}?`) || loc.startsWith(`${LOBBY}#`), `${host} ${path} loc=${loc}`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const withT = await edgeWorker.fetch(new Request(`https://${host}/lobby/forum?t=testthread`), env);
  assert.equal(withT.status, 308, `${host} /lobby/forum?t=`);
  const locT = new URL(withT.headers.get('location'));
  assert.equal(locT.origin + locT.pathname, LOBBY);
  assert.equal(locT.searchParams.get('t'), 'testthread');
  assert.equal(locT.hash, '#threads');

  const chatT = await edgeWorker.fetch(new Request(`https://${host}/Lobby/Chat?t=abc`), env);
  assert.equal(chatT.status, 308, `${host} /Lobby/Chat?t=`);
  const locC = new URL(chatT.headers.get('location'));
  assert.equal(locC.searchParams.get('t'), 'abc');
  assert.equal(locC.hash, '#threads');

  for (const path of STAY_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 404, `${host} ${path} ${method} stays 404`);
      if (host === 'www.getdasha.com') {
        assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} ${method} html-404`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }

  const chess = await edgeWorker.fetch(new Request(`https://${host}/chess`), env);
  assert.equal(chess.status, 200, `${host} /chess stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(chess.headers.get('x-dasha-edge'), 'chess');
  }

  const lobby = await edgeWorker.fetch(new Request(`https://${host}/lobby`), env);
  assert.equal(lobby.status, 200, `${host} /lobby stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(lobby.headers.get('x-dasha-edge'), 'lobby-page');
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/lobby/play', '/lobby/game', '/lobby/chess', '/lobby/forum', '/lobby/chat', '/arcade', '/games']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-lobby-nested-room-pretty-path: PASS (/lobby/play|/game|/chess 308 /lobby; /lobby/forum|/chat ?t= via forum helper; Title-case+slash; /arcade+/games stay 404; /chess+/lobby+/feed+/tape+/ws+/card stay out; no plugin.jup.ag)');
