#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 8266782e-4809-453c-8cc8-66513cadc171):
 * live /ca /contract /holder /holders (+slash / Title-case) 308 → /bag;
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
assert.match(workerSrc, /POTTER_BAG_308_PATHS/, 'bag leftover 308 set present');
assert.match(workerSrc, /POTTER_SIMP_BOARD_308_PATHS/, 'simp-board leftover 308 set present');
assert.match(
  workerSrc,
  /Leftover \/ca\|\/contract\|\/holder\|\/holders → \/bag/,
  'potterHome308Dest comment lists bag leftover family',
);
assert.match(
  workerSrc,
  /Leftover \/chart → \/\. Leftover \/swap\|\/trade → \/how-to-buy\. Leftover \/leaderboard\|\/board → \/simp \(Worker 8266782e\)/,
  'potterHome308Dest comment lists chart/swap/trade/board leftover family',
);
assert.match(
  workerSrc,
  /Leftover \/chart \(Worker 8266782e\)/,
  'home leftover comment names /chart',
);
assert.match(
  workerSrc,
  /Leftover \/swap \/trade \(Worker 8266782e\)/,
  'howto leftover comment names /swap /trade',
);

const bagSet = workerSrc.match(/const POTTER_BAG_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const simpSet = workerSrc.match(/const POTTER_SIMP_BOARD_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const homeSet = workerSrc.match(/const POTTER_HOME_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const howtoSet = workerSrc.match(/const POTTER_HOWTO_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const whichSet = workerSrc.match(/const POTTER_WHICH_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(bagSet, /'\/ca'/);
assert.match(bagSet, /'\/contract'/);
assert.match(bagSet, /'\/holder'/);
assert.match(bagSet, /'\/holders'/);
assert.match(simpSet, /'\/leaderboard'/);
assert.match(simpSet, /'\/board'/);
assert.match(homeSet, /'\/chart'/);
assert.match(howtoSet, /'\/swap'/);
assert.match(howtoSet, /'\/trade'/);
assert.doesNotMatch(whichSet, /['"]\/ca['"]/, '/ca left which set');
assert.doesNotMatch(simpSet, /['"]\/simp\/board['"]/, 'do not fold /simp/board');
assert.doesNotMatch(homeSet, /['"]\/mint['"]/, 'do not fold /mint differently');
assert.doesNotMatch(homeSet, /['"]\/token['"]/, 'do not fold /token differently');
for (const skip of [
  '/terms', '/tos', '/discord', '/status', '/openai', '/price', '/privacy',
  '/legal', '/slack', '/news', '/blog', '/yc', '/v1', '/health', '/healthz', '/admin',
]) {
  assert.doesNotMatch(bagSet, new RegExp(`['"]${skip}['"]`), `${skip} stays out of bag set`);
  assert.doesNotMatch(simpSet, new RegExp(`['"]${skip}['"]`), `${skip} stays out of simp-board set`);
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

const TO_BAG = ['ca', 'contract', 'holder', 'holders'].flatMap(variants);
const TO_HOME = variants('chart');
const TO_HOWTO = ['swap', 'trade'].flatMap(variants);
const TO_SIMP = ['leaderboard', 'board'].flatMap(variants);

const STAY_200 = ['/bag', '/simp', '/how-to-buy', '/price', '/privacy'];
const SKIP = [
  '/terms', '/tos', '/discord', '/status', '/openai',
  '/legal', '/slack', '/news', '/blog', '/yc', '/v1', '/health', '/healthz', '/admin',
];
const STAY_AS_TODAY = ['/mint', '/token', '/mint/', '/token/', '/Mint', '/Token'];

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
  assert.equal(potterHome308Dest(path), null, `do not fold ${path} differently`);
}
assert.equal(potterHome308Dest('/buy'), HOWTO, '/buy already how-to-buy');
assert.equal(potterHome308Dest('/Buy'), HOWTO, '/Buy already how-to-buy');
assert.equal(potterHome308Dest('/verify'), `${WWW}/which`, '/verify still /which');
assert.equal(potterHome308Dest('/simp/board'), null, '/simp/board stays board API');

const FETCH = [
  ...['/ca', '/ca/', '/CA', '/Contract', '/holder', '/Holders/'].map((path) => [path, BAG]),
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

console.log('dasha-bag-chart-trade-board-pretty-path: PASS (/ca+/contract+/holder+/holders 308 /bag; /chart 308 /; /swap+/trade 308 /how-to-buy; /leaderboard+/board 308 /simp; Title-case+slash; www+lobby GET+HEAD; /bag+/simp+/how-to-buy+/price+/privacy 200; /terms+/tos+/discord+/status+/openai stay out; no plugin.jup.ag)');
