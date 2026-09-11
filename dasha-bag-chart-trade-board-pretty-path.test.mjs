#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 8266782e-4809-453c-8cc8-66513cadc171):
 * live /contract /holder /holders (+slash / Title-case) 308 → /bag;
 * /ca moved on to /which (live; see dasha-ca-which-pretty-path).
 * /chart 308 → /; /swap /trade 308 → /how-to-buy;
 * /leaderboard /board 308 → /simp.
 * Exact /bag /simp /how-to-buy /price /privacy stay 200 (null dest).
 * Do not fold /mint /token (already home on live; this tree stays as today)
 * or /buy (already how-to-buy). Do not fold /simp/board.
 * Skip /terms /tos /discord /status /openai (and /legal /slack /news /blog
 * /yc /v1 /health /healthz /admin). Disk only. No Designer. Never plugin.jup.ag.
 * PR-mirror only — no wrangler deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /(?:String\(path \|\| ''\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(
  workerSrc,
  /p === "\/contract" \|\| p === "\/contract\/" \|\| p === "\/holder"/,
  'potterHome308Dest comment lists bag leftover family',
);

for (const skip of [
  '/terms', '/tos', '/discord', '/status', '/openai', '/price', '/privacy',
  '/legal', '/slack', '/news', '/blog', '/yc', '/v1', '/health', '/healthz', '/admin',
]) {
}

const WWW = 'https://www.getdasha.com';
const BAG = `${WWW}/bag`;
const HOME = `${WWW}/`;
const HOWTO = `${WWW}/how-to-buy`;
const SIMP = `${WWW}/simp`;

function variants(leaf) {
  const title = `/${leaf[0].toUpperCase()}${leaf.slice(1)}`;
  return [`/${leaf}`, `/${leaf}/`, title, `/${leaf.toUpperCase()}`, `${title}/`];
}

const TO_BAG = ['contract', 'holder', 'holders'].flatMap(variants); // /ca now folds /which (live)
const TO_HOME = variants('chart');
const TO_HOWTO = ['swap', 'trade'].flatMap(variants);
const TO_SIMP = ['leaderboard', 'board'].flatMap(variants);

const STAY_200 = ['/bag', '/simp', '/how-to-buy', '/price', '/privacy'];
const SKIP = [
  '/terms', '/tos', '/discord', '/status', '/openai',
  '/legal', '/slack', '/news', '/blog', '/yc', '/health', '/healthz', '/admin',
];
const STAY_AS_TODAY = ['/mint', '/token', '/mint/', '/token/', '/Mint', '/Token']; // live folds all home

for (const path of TO_BAG) {
  assert.equal(potterHome308Dest(path), BAG, path);
}
for (const path of TO_HOME) {
  assert.equal(potterHome308Dest(path), HOME, path);
}
for (const path of TO_HOWTO) {
  assert.equal(potterHome308Dest(path), HOWTO, path);
}
for (const path of TO_SIMP) {
  assert.equal(potterHome308Dest(path), SIMP, path);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
for (const path of SKIP) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}
for (const path of STAY_AS_TODAY) {
  assert.equal(potterHome308Dest(path), HOME, `${path} folds home (live)`);
}
assert.equal(potterHome308Dest('/buy'), HOWTO, '/buy already how-to-buy');
assert.equal(potterHome308Dest('/Buy'), HOWTO, '/Buy already how-to-buy');
assert.equal(potterHome308Dest('/verify'), null, '/verify is the real verifier page now (992/993)');
assert.equal(potterHome308Dest('/simp/board'), null, '/simp/board stays board API');

const FETCH = [
  ...['/Contract', '/holder', '/Holders/'].map((path) => [path, BAG]),
  ...['/chart', '/chart/', '/Chart'].map((path) => [path, HOME]),
  ...['/swap', '/swap/', '/Trade'].map((path) => [path, HOWTO]),
  ...['/leaderboard', '/board', '/Board/'].map((path) => [path, SIMP]),
];

const env = {
  LOBBY_SESSION_SECRET: 'bag-chart-trade-board-pretty-path-secret',
  LOBBY: {
    idFromName() { return 'public'; },
    get() {
      return {
        async fetch() {
          return new Response(JSON.stringify({ error: 'not found' }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          });
        },
      };
    },
  },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FETCH) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/terms', '/tos', '/discord', '/status', '/openai', '/price', '/privacy']) {
    const dest = potterHome308Dest(path);
    assert.equal(dest, null, `${host} ${path} dest stays null`);
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not a leftover 308`);
  }
  const bag = await edgeWorker.fetch(new Request(`https://${host}/bag`), env);
  assert.equal(bag.status, 200, `${host} /bag stays 200`);
  const howto = await edgeWorker.fetch(new Request(`https://${host}/how-to-buy`), env);
  assert.equal(howto.status, 200, `${host} /how-to-buy stays 200`);
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/bag<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/simp<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/how-to-buy<\/loc>/);
for (const leftover of ['/ca', '/contract', '/holder', '/holders', '/chart', '/swap', '/trade', '/leaderboard', '/board']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${leftover}</loc>`), `sitemap omits leftover ${leftover}`);
}

console.log('dasha-bag-chart-trade-board-pretty-path: PASS (/contract+/holder+/holders 308 /bag (/ca now /which); /chart 308 /; /swap+/trade 308 /how-to-buy; /leaderboard+/board 308 /simp; Title-case+slash; www+lobby GET+HEAD; /bag+/simp+/how-to-buy+/price+/privacy 200; /terms+/tos+/discord+/status+/openai stay out; no plugin.jup.ag)');
