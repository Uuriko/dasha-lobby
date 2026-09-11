#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 87cc1e0f-18eb-4c30-a3d2-08c2298af224):
 * live /devtools /devtool /developer-docs /sdk-docs /cli-docs /sdks-docs
 * /api-reference /sdk-reference /cli-reference /developer-api /dev-api
 * (+ /compute/* tabs, slash / Title-case) html-404 → 308 /compute/api
 * (same dest as /dev /sdk /cli /docs). Title-case via existing dest
 * toLowerCase — do not invent a second casefold.
 * Exact /compute stays 200 (null dest). Exact /compute/api stays JSON.
 * Skip /reference (ambiguous). Skip /openai /v1 /redoc /status /health
 * — do not invent a fold. Disk only. No Designer. Never plugin.jup.ag.
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
  /p === "\/devtools" \|\| p === "\/devtools\/"/,
  'api leftover comment lists /devtools /devtool /developer-docs /sdk-docs /cli-docs /sdks-docs',
);
assert.match(
  workerSrc,
  /\/api-reference \/sdk-reference \/cli-reference \/developer-api \/dev-api/,
  'api leftover comment lists /api-reference /sdk-reference /cli-reference /developer-api /dev-api',
);


const API_LEAVES = [
  'devtools', 'devtool', 'developer-docs', 'sdk-docs', 'cli-docs', 'sdks-docs',
  'api-reference', 'sdk-reference', 'cli-reference', 'developer-api', 'dev-api',
];
const PRIOR_API_LEAVES = ['sdk', 'cli', 'docs', 'openapi'];

for (const leaf of API_LEAVES) {
}
for (const leaf of PRIOR_API_LEAVES) {
}
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const API = `${WWW}/compute/api`;

const SKILL_COMPUTE_TABS = new Set(['sdk-docs', 'api-reference']);
const TO_API = API_LEAVES.flatMap((leaf) => {
  const apex = [
    `/${leaf}`, `/${leaf}/`,
    `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
    `/${leaf.toUpperCase()}`,
  ];
  if (SKILL_COMPUTE_TABS.has(leaf)) return apex;
  return [
    ...apex,
    `/compute/${leaf}`, `/compute/${leaf}/`,
    `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
  ];
});
const PRIOR_API = [
  '/sdk', '/sdk/', '/Sdk', '/SDK',
  '/cli', '/cli/', '/Cli', '/CLI',
  '/docs', '/docs/', '/Docs',
  '/openapi', '/Openapi',
  '/gateway', '/compute/gateway',
];
const SKIP_404 = [
  '/reference', '/reference/', '/Reference',
  '/openai', '/openai/', '/OpenAI',
  '/v1', '/v1/',
  '/redoc', '/redoc/', '/Redoc',
  '/status', '/status/', '/Status',
  '/health', '/health/', '/Health',
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
  LOBBY_SESSION_SECRET: 'devtools-sdk-docs-pretty-path-secret',
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
  '/devtools', '/devtool', '/developer-docs', '/sdk-docs', '/cli-docs', '/sdks-docs',
  '/api-reference', '/sdk-reference', '/cli-reference', '/developer-api', '/dev-api',
  '/compute/devtools', '/compute/cli-docs', '/compute/sdk-reference',
  '/reference', '/openai', '/v1', '/redoc', '/status', '/health',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-devtools-sdk-docs-pretty-path: PASS (/devtools+/devtool+/developer-docs+/sdk-docs+/cli-docs+/sdks-docs+/api-reference+/sdk-reference+/cli-reference+/developer-api+/dev-api + /compute/* tabs 308 /compute/api; /sdk+/cli+/docs+/openapi peers still fold; Title-case+slash; www+lobby GET+HEAD; /compute+/compute/api 200; /reference+/openai+/v1+/redoc+/status+/health stay out; no plugin.jup.ag)');
