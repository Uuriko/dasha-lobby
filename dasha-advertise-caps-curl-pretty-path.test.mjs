#!/usr/bin/env node
/**
 * Leftover pretty path (Worker b1725bc2-a9bc-4e49-b946-38014939e7b9):
 * live /tutorials /advertise /enroll /download /spend /caps /limits /free
 * (+ /compute/* tabs, slash / Title-case) 308 → /compute.
 * live /curl /openai-compat /completions /compat
 * (+ /compute/* tabs, slash / Title-case) 308 → /compute/api.
 * /tutorial /free-credits /pay /credits peers already 308→/compute.
 * /sdk /cli /docs /endpoint peers already 308→/compute/api.
 * Exact /compute /privacy stay 200 (null dest). Bare /price stays the 200
 * JSON token-price API. Exact /compute/api stays JSON (null dest).
 * Skip /arcade /games /multichain /room /connect /faq /waitlist /blog /tos
 * /legal /discord /slack /openai /v1 /status /health /healthz /network
 * /x402 /attestation — leave 404. Disk only. No Designer.
 * Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
 * Live www HEAD dests proven first on Worker b1725bc2.
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
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_308_PATHS/, 'api-docs 308 set present');
assert.match(
  workerSrc,
  /Leftover advertise\/caps\/tutorials batch \(Worker b1725bc2\)/,
  'compute leftover comment names advertise/caps/tutorials family',
);
assert.match(
  workerSrc,
  /Leftover \/curl \/openai-compat \/completions \/compat/,
  'api leftover comment lists /curl /openai-compat /completions /compat',
);
assert.match(
  workerSrc,
  /\/tutorials\|\/advertise\|\/enroll\|\/download\|\/spend\|\/caps\|\/limits\|\/free/,
  'potterHome308Dest comment lists compute leftover family',
);
assert.match(
  workerSrc,
  /\/curl\|\/openai-compat\|\/completions\|\/compat/,
  'potterHome308Dest comment lists api leftover family',
);
assert.match(
  workerSrc,
  /Do NOT invent \/arcade \/games \/multichain/,
  'leftover comment keeps Arcade/Multichain uninvented',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apiDocs = workerSrc.match(/const POTTER_COMPUTE_API_DOCS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

const COMPUTE_LEAVES = [
  'tutorials', 'advertise', 'enroll', 'download', 'spend', 'caps', 'limits', 'free',
];
const API_LEAVES = ['curl', 'openai-compat', 'completions', 'compat'];

for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/${leaf}/'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}/'`));
  assert.doesNotMatch(apiDocs, new RegExp(`['"]/${leaf}['"]`), `${leaf} is compute-tab, not api-docs`);
}
for (const leaf of API_LEAVES) {
  assert.match(apiDocs, new RegExp(`'/${leaf}'`));
  assert.match(apiDocs, new RegExp(`'/${leaf}/'`));
  assert.match(apiDocs, new RegExp(`'/compute/${leaf}'`));
  assert.match(apiDocs, new RegExp(`'/compute/${leaf}/'`));
  assert.doesNotMatch(tab, new RegExp(`['"]/${leaf}['"]`), `${leaf} is api-docs, not compute-tab`);
}

const SKIPS = [
  '/arcade', '/games', '/multichain', '/room', '/connect', '/faq', '/waitlist',
  '/blog', '/tos', '/legal', '/discord', '/slack', '/openai', '/v1', '/status',
  '/health', '/healthz', '/network', '/x402', '/attestation', '/price', '/privacy',
];
for (const skip of SKIPS) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
  assert.doesNotMatch(apiDocs, new RegExp(`['"]${skip}['"]`), `${skip} stays out of api-docs set`);
}

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const API = `${WWW}/compute/api`;
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
const TO_API = API_LEAVES.flatMap((leaf) => [
  ...variants(leaf),
  ...variants(leaf, '/compute'),
  ...[`/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`, `/Compute/${leaf}/`],
]);
const PRIOR_COMPUTE_PEERS = [
  '/tutorial', '/tutorial/', '/Tutorial',
  '/free-credits', '/Free-credits',
  '/pay', '/credits',
];
const PRIOR_API_PEERS = [
  '/docs', '/docs/', '/Docs',
  '/sdk', '/cli', '/endpoint',
];
const STAY_200 = ['/compute', '/privacy', '/price'];
const SKIP_404 = [
  '/arcade', '/arcade/', '/Arcade',
  '/games', '/games/', '/Games',
  '/multichain', '/multichain/', '/Multichain',
  '/room', '/room/', '/Room',
  '/connect', '/connect/', '/Connect',
  '/faq', '/faq/', '/Faq',
  '/waitlist', '/waitlist/',
  '/blog', '/blog/',
  '/tos', '/tos/',
  '/legal', '/legal/',
  '/discord', '/discord/',
  '/slack', '/slack/',
  '/openai', '/openai/', '/OpenAI',
  '/v1', '/v1/',
  '/status', '/status/',
  '/health', '/health/',
  '/healthz', '/healthz/',
  '/network', '/network/',
  '/x402', '/x402/',
  '/attestation', '/attestation/',
];

for (const path of TO_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), API, `${path} is not /compute/api`);
  assert.notEqual(potterHome308Dest(path), PRIVACY, `${path} is not /privacy`);
}
for (const path of TO_API) {
  assert.equal(potterHome308Dest(path), API, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not bare /compute`);
}
for (const path of PRIOR_COMPUTE_PEERS) {
  assert.equal(potterHome308Dest(path), COMPUTE, `peer ${path}`);
}
for (const path of PRIOR_API_PEERS) {
  assert.equal(potterHome308Dest(path), API, `peer ${path}`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
assert.equal(potterHome308Dest('/compute/api/'), null, '/compute/api/ stays JSON');
for (const path of SKIP_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  const u = new URL(dest);
  if (u.pathname === '/compute/api' || u.pathname.startsWith('/compute/api/')) {
    return LOBBY + u.pathname;
  }
  return dest;
}

const FETCH_COMPUTE = [
  '/tutorials', '/tutorials/', '/Tutorials', '/ADVERTISE',
  '/enroll', '/download', '/spend', '/caps', '/limits', '/free', '/Free/',
  '/compute/advertise', '/Compute/caps/', '/compute/free',
];
const FETCH_API = [
  '/curl', '/curl/', '/Curl',
  '/openai-compat', '/completions', '/compat', '/COMPAT',
  '/compute/curl', '/Compute/compat/',
];

const env = {
  LOBBY_SESSION_SECRET: 'advertise-caps-curl-pretty-path-secret',
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
  for (const path of FETCH_COMPUTE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of FETCH_API) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, API), `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not bare /compute`);
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
  for (const method of ['GET', 'HEAD']) {
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api`, { method }), env);
    assert.equal(api.status, 200, `${host} /compute/api ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await api.text(), '');
  }
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
      assert.notEqual(res.status, 308, `${host} ${path} ${method} is not a leftover 308`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), PRIVACY, `${host} ${path} ${method} not folded to privacy`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/compute<\/loc>/);
for (const path of [
  ...COMPUTE_LEAVES.map((leaf) => `/${leaf}`),
  ...API_LEAVES.map((leaf) => `/${leaf}`),
  '/arcade', '/games', '/multichain', '/room', '/openai', '/v1',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-advertise-caps-curl-pretty-path: PASS (/tutorials+/advertise+/enroll+/download+/spend+/caps+/limits+/free + /compute/* tabs 308 /compute; /curl+/openai-compat+/completions+/compat + /compute/* tabs 308 /compute/api; Title-case+slash; www+lobby GET+HEAD; /compute+/compute/api+/privacy+/price 200; /arcade+/games+/multichain+/room+/openai+/v1+/status+/health+/x402 stay out; no plugin.jup.ag)');
