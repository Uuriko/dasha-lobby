#!/usr/bin/env node
/**
 * Leftover pretty path (Worker f881c0a7-030e-4a51-a39e-1856bacacd77):
 * live /dev /developer /developers /sdks (+ /compute/* tabs, slash /
 * Title-case) html-404 → 308 /compute/api (same dest as /sdk /cli /docs).
 * /sdk /cli /docs /openapi /gateway peers already fold /compute/api.
 * Exact /compute stays 200 (null dest). Exact /compute/api stays JSON.
 * Skip /openai /v1 /admin /blog /tos /redoc — do not invent a fold.
 * Disk only. No Designer. Never plugin.jup.ag.
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
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_308_PATHS/, 'api-docs 308 set present');
assert.match(
  workerSrc,
  /Leftover \/dev \/developer \/developers \/sdks/,
  'api leftover comment lists /dev /developer /developers /sdks',
);
assert.match(
  workerSrc,
  /\/dev\|\/developer\|\/developers\|\/sdks\|\/compute\/dev\|\/compute\/developer\|\/compute\/developers\|\/compute\/sdks/,
  'potterHome308Dest comment lists /dev /developer /developers /sdks family',
);
assert.match(
  workerSrc,
  /\/sdk\|\/cli\|\/compute\/endpoint\|\/compute\/endpoints\|\/compute\/sdk\|\/compute\/cli/,
  'potterHome308Dest comment still lists /sdk /cli peers (openapi leftover no longer skips them)',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apiDocs = workerSrc.match(/const POTTER_COMPUTE_API_DOCS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

const API_LEAVES = ['dev', 'developer', 'developers', 'sdks'];
const PRIOR_API_LEAVES = ['sdk', 'cli', 'docs', 'openapi'];

for (const leaf of API_LEAVES) {
  assert.match(apiDocs, new RegExp(`'/${leaf}'`));
  assert.match(apiDocs, new RegExp(`'/${leaf}/'`));
  assert.match(apiDocs, new RegExp(`'/compute/${leaf}'`));
  assert.match(apiDocs, new RegExp(`'/compute/${leaf}/'`));
  assert.doesNotMatch(tab, new RegExp(`['"]/${leaf}['"]`), `/${leaf} is api-docs, not compute-tab`);
}
for (const leaf of PRIOR_API_LEAVES) {
  assert.match(apiDocs, new RegExp(`'/${leaf}'`));
  assert.doesNotMatch(tab, new RegExp(`['"]/${leaf}['"]`), `/${leaf} stays api-docs, not compute-tab`);
}
assert.doesNotMatch(apiDocs, /['"]\/openai['"]/, 'do not invent /openai on api-docs set');
assert.doesNotMatch(apiDocs, /['"]\/v1['"]/, 'do not invent /v1 on api-docs set');
assert.doesNotMatch(apiDocs, /['"]\/redoc['"]/, 'do not invent /redoc on api-docs set');
assert.doesNotMatch(tab, /['"]\/dev['"]/, '/dev is api-docs, not compute-tab');
assert.doesNotMatch(tab, /['"]\/sdk['"]/, '/sdk is api-docs, not compute-tab');
assert.doesNotMatch(tab, /['"]\/cli['"]/, '/cli is api-docs, not compute-tab');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const API = `${WWW}/compute/api`;

const TO_API = API_LEAVES.flatMap((leaf) => [
  `/${leaf}`, `/${leaf}/`,
  `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
  `/${leaf.toUpperCase()}`,
  `/compute/${leaf}`, `/compute/${leaf}/`,
  `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
]);
const PRIOR_API = [
  '/sdk', '/sdk/', '/Sdk', '/SDK',
  '/cli', '/cli/', '/Cli', '/CLI',
  '/docs', '/docs/', '/Docs',
  '/openapi', '/Openapi',
  '/gateway', '/compute/gateway',
];
const STAY_200 = ['/compute', '/privacy', '/compute/api', '/compute/api/'];
const SKIP_404 = [
  '/openai', '/openai/', '/OpenAI',
  '/v1', '/v1/',
  '/admin', '/admin/', '/Admin',
  '/blog', '/blog/', '/Blog',
  '/tos', '/tos/', '/Tos',
  '/redoc', '/redoc/', '/Redoc',
];

for (const path of [...TO_API, ...PRIOR_API]) {
  assert.equal(potterHome308Dest(path), API, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not bare /compute`);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
assert.equal(potterHome308Dest('/compute/api/'), null, '/compute/api/ stays JSON');
assert.equal(potterHome308Dest('/privacy'), null, '/privacy stays 200');
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

const env = {
  LOBBY_SESSION_SECRET: 'dev-developer-sdks-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
const FETCH_FOLDS = [
  ...TO_API.map((path) => [path, API]),
  ...PRIOR_API.map((path) => [path, API]),
];

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FETCH_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const want = expectLoc(host, dest);
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
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
  for (const method of ['GET', 'HEAD']) {
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api`, { method }), env);
    assert.equal(api.status, 200, `${host} /compute/api ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await api.text(), '');
  }
  for (const path of SKIP_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(potterHome308Dest(path), null, `${host} ${path} dest stays null`);
      assert.notEqual(res.headers.get('location'), API, `${host} ${path} ${method} not folded to api`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/dev', '/developer', '/developers', '/sdks',
  '/sdk', '/cli', '/docs', '/openapi',
  '/openai', '/v1', '/admin', '/blog', '/tos', '/redoc',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-dev-developer-sdks-pretty-path: PASS (/dev+/developer+/developers+/sdks + /compute/* tabs 308 /compute/api; /sdk+/cli+/docs+/openapi peers still fold; Title-case+slash; www+lobby GET+HEAD; /compute+/compute/api 200; /openai+/v1+/admin+/blog+/tos+/redoc stay out; no plugin.jup.ag)');
