#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 024cbf58): live /play /game (+slash / Title-case)
 * html-404 → 308 https://www.getdasha.com/lobby. Chess is in-room Play, never a
 * leftover door. /arcade /games stay 404 — Arcade is draft PR #44 only.
 * Exact /chess /lobby /privacy stay 200 (null dest). Bare /price stays the 200
 * JSON token-price API. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(
  workerSrc,
  /Leftover \/play \/game \(\+slash \/ Title-case\) → \/lobby/,
  'potterHome308Dest comment lists leftover /play /game → /lobby',
);
assert.match(
  workerSrc,
  /\/arcade \/games stay 404/,
  'comment keeps /arcade /games 404 (Arcade draft PR #44)',
);
assert.match(workerSrc, /Arcade is draft PR #44/, 'Arcade stays draft PR #44');
assert.match(
  workerSrc,
  /p === '\/play' \|\| p === '\/play\/' \|\| p === '\/game' \|\| p === '\/game\/'/,
  'exact leftover /play /game (+slash) fold',
);

const WWW = 'https://www.getdasha.com';
const LOBBY = `${WWW}/lobby`;
const COMPUTE = `${WWW}/compute`;

const FOLDS = [
  '/play', '/play/', '/Play', '/PLAY', '/pLaY/',
  '/game', '/game/', '/Game', '/GAME', '/gAmE/',
];
const STAY_404 = [
  '/arcade', '/arcade/', '/Arcade', '/ARCADE',
  '/games', '/games/', '/Games', '/GAMES',
];
const UNTOUCHED = ['/chess', '/lobby', '/price', '/privacy'];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), LOBBY, path);
}
for (const path of STAY_404) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 404 (Arcade PR #44)`);
}
for (const path of UNTOUCHED) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
assert.equal(potterHome308Dest('/playground'), COMPUTE, '/playground still compute-tab, not lobby');
assert.equal(potterHome308Dest('/compute/playground'), COMPUTE, '/compute/playground still compute-tab');
assert.equal(potterHome308Dest('/app'), COMPUTE, '/app → compute (shipped next hop)');

const env = {
  LOBBY_SESSION_SECRET: 'play-game-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName() { return 'public'; },
    get() {
      return {
        async fetch(req) {
          const pathname = new URL(req.url).pathname;
          if (pathname === '/price') {
            return new Response(JSON.stringify({
              ok: true,
              mint: '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump',
            }), {
              status: 200,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            });
          }
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
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), LOBBY, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of STAY_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 404, `${host} ${path} ${method} stays 404`);
      assert.equal(potterHome308Dest(path), null, `${path} dest stays null`);
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

  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  }

  for (const method of ['GET', 'HEAD']) {
    const price = await edgeWorker.fetch(new Request(`https://${host}/price`, { method }), env);
    assert.equal(price.status, 200, `${host} /price ${method} stays 200`);
    assert.notEqual(price.headers.get('x-dasha-edge'), 'html-404', `${host} /price ${method} not html-404`);
    assert.notEqual(price.headers.get('location'), LOBBY, `${host} /price ${method} not folded to lobby`);
    if (method === 'GET') {
      const body = await price.json();
      assert.equal(body.ok, true, `${host} /price JSON ok`);
      assert.equal(body.mint, '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump', `${host} /price mint`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/play', '/game', '/arcade', '/games']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-lobby-play-game-pretty-path: PASS (/play+/game 308 /lobby; Title-case+slash; /arcade+/games stay 404; /chess+/lobby+/price+/privacy untouched; no plugin.jup.ag)');
