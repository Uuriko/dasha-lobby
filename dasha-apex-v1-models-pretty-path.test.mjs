#!/usr/bin/env node
/**
 * Leftover pretty path: live Mozilla GET /v1 /v1/models (+slash)
 * html-404s on www while /docs|/swagger peers already 308→/compute/api.
 * Agents and OpenAI-compat clients often hit apex /v1 and /v1/models.
 * Fold exact leftovers to the compute API face — never a fake /v1 JSON
 * proxy. Title-case via existing dest toLowerCase. Exact /compute/api/v1*
 * stays JSON handler. /compute/v1* still folds to /compute/api/v1*.
 * Do not claim OpenAI affiliation. Disk only. No Designer.
 * Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
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
  /p === "\/v1" \|\| p === "\/v1\/" \|\| p === "\/v1\/models" \|\| p === "\/v1\/models\/"/,
  'potterHome308Dest lists exact /v1 /v1/ /v1/models /v1/models/',
);
assert.match(
  workerSrc,
  /never a fake \/v1 JSON proxy/,
  'comment refuses a fake /v1 JSON proxy',
);

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const API = `${WWW}/compute/api`;
const LOBBY_API = `${LOBBY}/compute/api`;
const COMPUTE = `${WWW}/compute`;
const V1 = `${WWW}/compute/api/v1`;
const V1_MODELS = `${WWW}/compute/api/v1/models`;

const FOLDS = [
  '/v1', '/v1/',
  '/V1', '/V1/',
  '/v1/models', '/v1/models/',
  '/V1/models', '/V1/Models', '/V1/MODELS/',
];
const COMPUTE_V1_PEERS = [
  '/compute/v1', '/compute/v1/', '/Compute/v1',
];
const COMPUTE_V1_MODELS_PEERS = [
  '/compute/v1/models', '/compute/v1/models/', '/Compute/v1/models',
];
const DOCS_PEERS = ['/docs', '/docs/', '/Docs', '/swagger', '/swagger/', '/Swagger'];
const STAY_NULL = [
  '/compute/api', '/compute/api/',
  '/compute/api/v1', '/compute/api/v1/',
  '/compute/api/v1/models', '/compute/api/v1/models/',
  '/compute',
  '/privacy',
];
const STAY_OUT = [
  '/v1/chat/completions', '/v1/chat/completions/',
  '/api/v1', '/api/v1/',
  '/openai', '/openai/', '/OpenAI',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), API, path);
  assert.notEqual(potterHome308Dest(path), V1, `${path} is not a fake /v1 JSON proxy`);
  assert.notEqual(potterHome308Dest(path), V1_MODELS, `${path} is not /compute/api/v1/models`);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not bare /compute`);
}
for (const path of COMPUTE_V1_PEERS) {
  assert.equal(potterHome308Dest(path), V1, `peer ${path}`);
}
for (const path of COMPUTE_V1_MODELS_PEERS) {
  assert.equal(potterHome308Dest(path), V1_MODELS, `peer ${path}`);
}
for (const path of DOCS_PEERS) {
  assert.equal(potterHome308Dest(path), API, `peer ${path}`);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `${path} stays handler`);
}
for (const path of STAY_OUT) {
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
  LOBBY_SESSION_SECRET: 'apex-v1-models-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const want = expectLoc(host, API);
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), expectLoc(host, V1), `${host} ${path} ${method} not fake /v1 proxy`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api/v1`, { method }), env);
    assert.equal(api.status, 200, `${host} /compute/api/v1 ${method} stays handler`);
    if (method === 'GET') {
      const body = await api.json();
      assert.equal(body.object, 'gateway', `${host} v1 gateway object`);
      assert.equal(body.service, 'dasha-compute', `${host} v1 service`);
      assert.equal(body.models, '/compute/api/v1/models', `${host} v1 models dest`);
    } else {
      assert.equal(await api.text(), '');
    }
    const models = await edgeWorker.fetch(new Request(`https://${host}/compute/api/v1/models`, { method }), env);
    assert.notEqual(models.status, 308, `${host} /compute/api/v1/models ${method} stays handler`);
    assert.notEqual(models.headers.get('location'), expectLoc(host, API), `${host} /compute/api/v1/models ${method} not leftover`);
    const face = await edgeWorker.fetch(new Request(`https://${host}/compute/api`, { method }), env);
    assert.equal(face.status, 200, `${host} /compute/api ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await face.text(), '');
  }
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/v1', '/v1/models']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-v1-models-pretty-path: PASS (/v1+/v1/+/v1/models+/v1/models/ 308 /compute/api; Title-case+slash; www+lobby GET+HEAD; lobby same-host remap; /compute/api/v1* 200; /compute/v1* still /compute/api/v1*; /docs+/swagger peers; no fake /v1 JSON proxy; no plugin.jup.ag)');
