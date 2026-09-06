#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 73355945): live /models /model
 * /compute/models /compute/model (+slash / Title-case) html-404 → 308 /compute.
 * Live /gateway /compute/gateway (+slash / Title-case) html-404 → 308 /compute/api.
 * Keep prior compute-tab + swagger peers. Exact /compute stays 200 (null dest).
 * Exact /compute/api stays JSON (null dest). Skip /openai /yc /news /v1.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_308_PATHS/, 'api-docs 308 set present');

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(tab, /'\/models'/);
assert.match(tab, /'\/model'/);
assert.match(tab, /'\/compute\/models'/);
assert.match(tab, /'\/compute\/model'/);
assert.match(
  workerSrc,
  /\/models\|\/model\|\/compute\/models\|\/compute\/model/,
  'apex→/compute leftover comment lists /models|/model|/compute/models|/compute/model',
);
assert.match(
  workerSrc,
  /\/gateway\|\/compute\/gateway/,
  'apex→/compute/api leftover comment lists /gateway|/compute/gateway',
);
assert.doesNotMatch(
  workerSrc,
  /POTTER_COMPUTE_TAB_308_PATHS[\s\S]*['"]\/openai['"]/,
  'do not invent /openai on compute-tab set',
);
assert.doesNotMatch(
  workerSrc,
  /POTTER_COMPUTE_TAB_308_PATHS[\s\S]*['"]\/yc['"]/,
  'do not invent /yc',
);
assert.doesNotMatch(
  workerSrc,
  /POTTER_COMPUTE_TAB_308_PATHS[\s\S]*['"]\/news['"]/,
  'do not invent /news',
);

const COMPUTE = 'https://www.getdasha.com/compute';
const API = 'https://www.getdasha.com/compute/api';
const LOBBY_API = 'https://lobby.getdasha.com/compute/api';

const MODEL_CASES = [
  '/models', '/models/', '/Models', '/MODELS', '/mOdElS/',
  '/model', '/model/', '/Model', '/MODEL', '/mOdEl/',
  '/compute/models', '/compute/models/', '/Compute/models', '/COMPUTE/MODELS', '/Compute/Models/',
  '/compute/model', '/compute/model/', '/Compute/model', '/COMPUTE/MODEL', '/Compute/Model/',
];

const GATEWAY_CASES = [
  '/gateway', '/gateway/', '/Gateway', '/GATEWAY', '/gAtEwAy/',
  '/compute/gateway', '/compute/gateway/', '/Compute/gateway', '/COMPUTE/GATEWAY', '/Compute/Gateway/',
];

const PRIOR_COMPUTE_PEERS = [
  '/run', '/ollama', '/compute/run', '/products', '/faucet/compute',
];
const PRIOR_API_PEERS = [
  '/swagger-ui', '/openapi', '/api-docs',
];
const STAY_404 = ['/openai', '/openai/', '/OpenAI', '/yc', '/yc/', '/Yc', '/news', '/news/', '/News', '/v1', '/v1/'];

for (const path of MODEL_CASES) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of GATEWAY_CASES) {
  assert.equal(potterHome308Dest(path), API, path);
}
for (const path of PRIOR_COMPUTE_PEERS) {
  assert.equal(potterHome308Dest(path), COMPUTE, `peer ${path}`);
}
for (const path of PRIOR_API_PEERS) {
  assert.equal(potterHome308Dest(path), API, `peer ${path}`);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
for (const path of STAY_404) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'models-gateway-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of MODEL_CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const apiLoc = host === 'lobby.getdasha.com' ? LOBBY_API : API;
  for (const path of GATEWAY_CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), apiLoc, `${host} ${path} ${method} loc`);
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
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/models', '/model', '/compute/models', '/compute/model', '/gateway', '/compute/gateway', '/openai', '/yc', '/news']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-models-gateway-pretty-path: PASS (/models+/model+/compute/models+/compute/model 308 /compute; /gateway+/compute/gateway 308 /compute/api; Title-case+slash; www+lobby GET+HEAD; peers; /compute 200; /compute/api 200; /openai+/yc+/news+/v1 404; no plugin.jup.ag)');
