#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 66dadebe-5e05-4eec-9bb5-a4d22842a74e):
 * live /chatgpt /cursor /copilot (+slash / Title-case / /compute/* tabs)
 * html-404 → 308 https://www.getdasha.com/compute.
 * live /candles → 308 / (peer of live /chart).
 * live /sell → 308 /how-to-buy (peer of live /swap /trade).
 * live /sim → 308 /simp (peer of live /board /leaderboard).
 * NOT OpenAI/Microsoft product pages. Exact /compute /privacy stay 200.
 * Bare /price stays the 200 JSON token-price API. Exact /simp /how-to-buy stay 200.
 * Skip /openai /anthropic /arcade /v1 /x402 /health /status. Do not invent
 * /compute/candles /compute/sell /compute/sim. Do not fold /simp/board.
 * Disk only. No Designer. Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
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
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(workerSrc, /POTTER_HOME_308_PATHS/, 'home 308 set present');
assert.match(workerSrc, /POTTER_HOWTO_308_PATHS/, 'howto 308 set present');
assert.match(workerSrc, /POTTER_SIMP_308_PATHS/, 'simp leftover 308 set present');
assert.match(
  workerSrc,
  /Leftover chatgpt\/cursor\/copilot batch \(Worker 66dadebe\)/,
  'compute leftover comment names chatgpt/cursor/copilot family',
);
assert.match(
  workerSrc,
  /Leftover \/candles \(Worker 66dadebe\)/,
  'home leftover comment names /candles',
);
assert.match(
  workerSrc,
  /Leftover \/sell \(Worker 66dadebe\)/,
  'howto leftover comment names /sell',
);
assert.match(
  workerSrc,
  /Leftover \/sim \(Worker 66dadebe\)/,
  'simp leftover comment names /sim',
);
assert.match(
  workerSrc,
  /\/chatgpt\|\/cursor\|\/copilot\|\/compute\/chatgpt\|\/compute\/cursor\|\/compute\/copilot → \/compute/,
  'potterHome308Dest comment lists compute leftover family',
);
assert.match(
  workerSrc,
  /Leftover \/candles → \/\. Leftover \/sim → \/simp \(Worker 66dadebe\)/,
  'potterHome308Dest comment lists candles/sim leftover family',
);
assert.match(
  workerSrc,
  /NOT OpenAI\/Microsoft product pages/,
  'leftover comment keeps OpenAI/Microsoft product pages uninvented',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const homeSet = workerSrc.match(/const POTTER_HOME_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const howtoSet = workerSrc.match(/const POTTER_HOWTO_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const simpSet = workerSrc.match(/const POTTER_SIMP_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

const COMPUTE_LEAVES = ['chatgpt', 'cursor', 'copilot'];
for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/${leaf}/'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}/'`));
}
assert.match(homeSet, /'\/candles'/);
assert.match(homeSet, /'\/candles\/'/);
assert.match(howtoSet, /'\/sell'/);
assert.match(howtoSet, /'\/sell\/'/);
assert.match(simpSet, /'\/sim'/);
assert.match(simpSet, /'\/sim\/'/);
assert.doesNotMatch(tab, /['"]\/candles['"]/, '/candles is home, not compute-tab');
assert.doesNotMatch(tab, /['"]\/sell['"]/, '/sell is howto, not compute-tab');
assert.doesNotMatch(tab, /['"]\/sim['"]/, '/sim is simp leftover, not compute-tab');
assert.doesNotMatch(tab, /['"]\/compute\/candles['"]/, 'do not invent /compute/candles');
assert.doesNotMatch(tab, /['"]\/compute\/sell['"]/, 'do not invent /compute/sell');
assert.doesNotMatch(tab, /['"]\/compute\/sim['"]/, 'do not invent /compute/sim');
assert.doesNotMatch(simpSet, /['"]\/simp\/board['"]/, 'do not fold /simp/board');

const SKIPS = [
  '/openai', '/anthropic', '/arcade', '/v1', '/x402', '/health', '/status',
  '/price', '/privacy',
];
for (const skip of SKIPS) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
  assert.doesNotMatch(homeSet, new RegExp(`['"]${skip}['"]`), `${skip} stays out of home set`);
  assert.doesNotMatch(howtoSet, new RegExp(`['"]${skip}['"]`), `${skip} stays out of howto set`);
  assert.doesNotMatch(simpSet, new RegExp(`['"]${skip}['"]`), `${skip} stays out of simp set`);
}
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const HOME = `${WWW}/`;
const HOWTO = `${WWW}/how-to-buy`;
const SIMP = `${WWW}/simp`;
const PRIVACY = `${WWW}/privacy`;

function variants(leaf, prefix = '') {
  const base = `${prefix}/${leaf}`;
  const titleLeaf = `${leaf[0].toUpperCase()}${leaf.slice(1)}`;
  return [
    base, `${base}/`,
    `${prefix}/${titleLeaf}`,
    `${prefix}/${leaf.toUpperCase()}`,
    `${prefix}/${titleLeaf}/`,
  ];
}

const TO_COMPUTE = COMPUTE_LEAVES.flatMap((leaf) => [
  ...variants(leaf),
  ...variants(leaf, '/compute'),
  ...[`/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`, `/Compute/${leaf}/`],
]);
const TO_HOME = variants('candles');
const TO_HOWTO = variants('sell');
const TO_SIMP = variants('sim');
const STAY_200 = ['/compute', '/privacy', '/price', '/simp', '/how-to-buy'];
const SKIP_404 = [
  '/openai', '/openai/', '/OpenAI',
  '/anthropic', '/anthropic/', '/Anthropic',
  '/arcade', '/arcade/', '/Arcade',
  '/v1', '/v1/',
  '/x402', '/x402/',
  '/health', '/health/',
  '/status', '/status/',
];

for (const path of TO_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), PRIVACY, `${path} is not /privacy`);
  assert.notEqual(potterHome308Dest(path), HOWTO, `${path} is not /how-to-buy`);
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
for (const path of SKIP_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/buy'), HOWTO, '/buy already how-to-buy');
assert.equal(potterHome308Dest('/simp/board'), null, '/simp/board stays board API');
assert.equal(potterHome308Dest('/compute/candles'), null, 'do not invent /compute/candles');
assert.equal(potterHome308Dest('/compute/sell'), null, 'do not invent /compute/sell');
assert.equal(potterHome308Dest('/compute/sim'), null, 'do not invent /compute/sim');

const FETCH = [
  ...['/chatgpt', '/chatgpt/', '/ChatGPT', '/CURSOR', '/copilot', '/Copilot/',
    '/compute/chatgpt', '/Compute/cursor/', '/compute/copilot'].map((path) => [path, COMPUTE]),
  ...['/candles', '/candles/', '/Candles'].map((path) => [path, HOME]),
  ...['/sell', '/sell/', '/Sell'].map((path) => [path, HOWTO]),
  ...['/sim', '/sim/', '/Sim', '/SIM'].map((path) => [path, SIMP]),
];

const env = {
  LOBBY_SESSION_SECRET: 'chatgpt-cursor-copilot-leftover-pretty-path-secret',
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
  for (const [path, dest] of FETCH) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  }
  const howto = await edgeWorker.fetch(new Request(`https://${host}/how-to-buy`), env);
  assert.equal(howto.status, 200, `${host} /how-to-buy stays 200`);
  const simp = await edgeWorker.fetch(new Request(`https://${host}/simp`), env);
  assert.equal(simp.status, 200, `${host} /simp stays 200`);
  for (const path of ['/price', '/price/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
  for (const path of SKIP_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(potterHome308Dest(path), null, `${host} ${path} dest stays null`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), PRIVACY, `${host} ${path} ${method} not folded to privacy`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/compute<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/simp<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/how-to-buy<\/loc>/);
for (const path of [
  '/chatgpt', '/cursor', '/copilot', '/candles', '/sell', '/sim',
  '/openai', '/anthropic', '/arcade', '/v1',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-chatgpt-cursor-copilot-leftover-pretty-path: PASS (/chatgpt+/cursor+/copilot + /compute/* tabs 308 /compute; /candles 308 /; /sell 308 /how-to-buy; /sim 308 /simp; Title-case+slash; www+lobby GET+HEAD; /compute+/privacy+/price+/simp+/how-to-buy 200; /openai+/anthropic+/arcade+/v1+/x402+/health+/status stay out; no plugin.jup.ag)');
