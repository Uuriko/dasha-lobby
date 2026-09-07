#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 477696ce): live /compute/v1 (+slash / Title-case)
 * html-404 → 308 https://www.getdasha.com/compute/api/v1 while /compute/api/v1
 * is 200 JSON. /compute/v1/models → /compute/api/v1/models (401 JSON handler).
 * /answer /compute/answer (+slash / Title-case) → plain /compute (no hash),
 * same as /ask /compute/ask. Lobby same-host remap for /compute/api/* dests.
 * Never fold exact /compute/api/v1* or bare /v1|/v1/models (stay 404).
 * Disk only. No Designer. Never plugin.jup.ag. No Graham OCM.
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
assert.match(workerSrc, /POTTER_COMPUTE_API_V1_308_PATHS/, 'v1 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_API_V1_MODELS_308_PATHS/, 'v1/models 308 set present');
assert.match(
  workerSrc,
  /Never fold exact \/compute\/api\/v1\* or bare \/v1\|\/v1\/models/,
  'stay-out comment for exact API + bare /v1',
);
assert.match(
  workerSrc,
  /\/answer \/compute\/answer \(\+slash \/ Title-case\) still html-404/,
  'answer leftover comment',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(tab, /'\/answer'/);
assert.match(tab, /'\/answer\/'/);
assert.match(tab, /'\/compute\/answer'/);
assert.match(tab, /'\/compute\/answer\/'/);
assert.doesNotMatch(tab, /['"]\/compute\/v1['"]/, '/compute/v1 is not a compute-tab fold');
assert.doesNotMatch(tab, /['"]\/v1['"]/, 'bare /v1 stays out of compute-tab');

const v1Set = workerSrc.match(/const POTTER_COMPUTE_API_V1_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(v1Set, /'\/compute\/v1'/);
assert.match(v1Set, /'\/compute\/v1\/'/);
assert.doesNotMatch(v1Set, /['"]\/v1['"]/, 'bare /v1 is not in v1 308 set');
assert.doesNotMatch(v1Set, /['"]\/compute\/api\/v1['"]/, 'exact /compute/api/v1 is not in v1 308 set');

const modelsSet = workerSrc.match(/const POTTER_COMPUTE_API_V1_MODELS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(modelsSet, /'\/compute\/v1\/models'/);
assert.match(modelsSet, /'\/compute\/v1\/models\/'/);
assert.doesNotMatch(modelsSet, /['"]\/v1\/models['"]/, 'bare /v1/models is not in models 308 set');
assert.doesNotMatch(modelsSet, /['"]\/compute\/api\/v1\/models['"]/, 'exact API models stays handler');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const V1 = `${WWW}/compute/api/v1`;
const V1_MODELS = `${WWW}/compute/api/v1/models`;

const V1_FOLDS = [
  '/compute/v1', '/compute/v1/', '/Compute/v1', '/COMPUTE/V1/',
  '/Compute/V1', '/COMPUTE/v1',
];
const V1_MODELS_FOLDS = [
  '/compute/v1/models', '/compute/v1/models/', '/Compute/v1/models',
  '/COMPUTE/V1/MODELS/', '/Compute/V1/Models',
];
const ANSWER_FOLDS = [
  '/answer', '/answer/', '/Answer', '/ANSWER/',
  '/compute/answer', '/compute/answer/', '/Compute/answer', '/COMPUTE/ANSWER/',
];
const ASK_PEERS = ['/ask', '/ask/', '/compute/ask', '/compute/ask/'];
const STAY_OUT = [
  '/v1', '/v1/', '/V1',
  '/v1/models', '/v1/models/', '/V1/models',
  '/api/v1', '/api/v1/',
  '/compute/api/v1', '/compute/api/v1/',
  '/compute/api/v1/models', '/compute/api/v1/models/',
];

for (const path of V1_FOLDS) {
  assert.equal(potterHome308Dest(path), V1, path);
}
for (const path of V1_MODELS_FOLDS) {
  assert.equal(potterHome308Dest(path), V1_MODELS, path);
}
for (const path of ANSWER_FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of ASK_PEERS) {
  assert.equal(potterHome308Dest(path), COMPUTE, `${path} still compute tab`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay out ${path}`);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/privacy'), null, '/privacy stays 200');
assert.equal(potterHome308Dest('/compute/network'), `${WWW}/compute/api/network`, 'network peer still folds');
assert.equal(potterHome308Dest('/compute/api/network'), null, 'exact network API stays handler');

const env = { LOBBY_SESSION_SECRET: 'compute-v1-answer-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of V1_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const want = host === 'lobby.getdasha.com' ? `${LOBBY}/compute/api/v1` : V1;
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of V1_MODELS_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const want = host === 'lobby.getdasha.com' ? `${LOBBY}/compute/api/v1/models` : V1_MODELS;
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ANSWER_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc stays www /compute`);
      assert.doesNotMatch(res.headers.get('location') || '', /#/, `${host} ${path} ${method} no hash`);
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
  }
  for (const path of ['/v1', '/v1/', '/v1/models', '/v1/models/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 404, `${host} ${path} ${method} stays 404`);
      if (host === 'www.getdasha.com') {
        assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} ${method} html-404`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/compute/v1', '/compute/v1/models', '/answer', '/compute/answer', '/v1', '/v1/models']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-compute-v1-answer-pretty-path: PASS (/compute/v1 308 /compute/api/v1; /compute/v1/models 308 /compute/api/v1/models; /answer+/compute/answer 308 /compute; www+lobby GET+HEAD; lobby same-host remap; bare /v1* 404; exact API stays; /privacy 200; no plugin.jup.ag)');
