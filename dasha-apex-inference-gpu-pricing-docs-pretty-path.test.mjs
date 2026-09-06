#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 20964dff): live /inference /gpu /gpus /pricing
 * /providing /mac-kit + /compute/* tabs (+slash / Title-case) html-404 → 308
 * /compute. Inference/GPU/pricing/provide-kit leftovers — live apex/tabs
 * html-404 while /run /models /provide /kit already 308→/compute.
 * Live /documentation /compute/documentation (+slash / Title-case) html-404
 * → 308 /compute/api (same dest as /docs — NOT bare /compute).
 * /compute/documentation alongside /compute/docs peers.
 * Title-case works via existing dest lowercasing.
 * Lobby /compute/api dests stay same-host via potterHome308Response.
 * Exact /compute stays 200 (null dest). /health /status /healthz must NOT fold.
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
assert.match(
  workerSrc,
  /Inference\/GPU\/pricing\/provide-kit leftovers/,
  'leftover comment notes Inference/GPU/pricing/provide-kit leftovers',
);
assert.match(
  workerSrc,
  /\/run \/models[\s\S]*\/provide \/kit already 308/,
  'leftover comment notes /run /models /provide /kit already 308→/compute',
);
assert.match(
  workerSrc,
  /\/inference\|\/gpu\|\/gpus\|\/pricing\|\/providing\|\/mac-kit\|\/compute\/inference\|\/compute\/gpu\|\/compute\/gpus\|\/compute\/pricing\|\/compute\/providing\|\/compute\/mac-kit/,
  'potterHome308Dest comment lists leftover family',
);
assert.match(
  workerSrc,
  /\/docs\|\/documentation\|\/compute\/docs\|\/compute\/documentation/,
  'potterHome308Dest comment lists documentation → /compute/api',
);
assert.match(
  workerSrc,
  /Same dest as \/docs — NOT bare \/compute/,
  'docs leftover comment keeps documentation on /compute/api',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const leaf of ['inference', 'gpu', 'gpus', 'pricing', 'providing', 'mac-kit']) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
assert.doesNotMatch(tab, /['"]\/health['"]/, 'do not fold /health on compute-tab set');
assert.doesNotMatch(tab, /['"]\/status['"]/, 'do not fold /status');
assert.doesNotMatch(tab, /['"]\/healthz['"]/, 'do not fold /healthz');

const docs = workerSrc.match(/const POTTER_COMPUTE_API_DOCS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const leaf of ['docs', 'documentation', 'compute/docs', 'compute/documentation']) {
  assert.match(docs, new RegExp(`'/${leaf}'`));
}

const COMPUTE = 'https://www.getdasha.com/compute';
const API = 'https://www.getdasha.com/compute/api';
const LOBBY_API = 'https://lobby.getdasha.com/compute/api';

const INFERENCE_GPU = [
  '/inference', '/inference/', '/Inference', '/INFERENCE', '/iNfErEnCe/',
  '/gpu', '/gpu/', '/Gpu', '/GPU', '/gPu/',
  '/gpus', '/gpus/', '/Gpus', '/GPUS', '/gPuS/',
  '/pricing', '/pricing/', '/Pricing', '/PRICING', '/pRiCiNg/',
  '/providing', '/providing/', '/Providing', '/PROVIDING', '/pRoViDiNg/',
  '/mac-kit', '/mac-kit/', '/Mac-kit', '/MAC-KIT', '/Mac-Kit/',
  '/compute/inference', '/compute/inference/', '/Compute/inference', '/COMPUTE/INFERENCE', '/Compute/Inference/',
  '/compute/gpu', '/compute/gpu/', '/Compute/gpu', '/COMPUTE/GPU', '/Compute/Gpu/',
  '/compute/gpus', '/compute/gpus/', '/Compute/gpus', '/COMPUTE/GPUS', '/Compute/Gpus/',
  '/compute/pricing', '/compute/pricing/', '/Compute/pricing', '/COMPUTE/PRICING', '/Compute/Pricing/',
  '/compute/providing', '/compute/providing/', '/Compute/providing', '/COMPUTE/PROVIDING', '/Compute/Providing/',
  '/compute/mac-kit', '/compute/mac-kit/', '/Compute/mac-kit', '/COMPUTE/MAC-KIT', '/Compute/Mac-Kit/',
];
const PRIOR_COMPUTE_PEERS = [
  '/provide', '/provide/', '/Provide',
  '/run', '/run/', '/Run',
  '/models', '/models/', '/Models',
  '/compute/provide', '/compute/run', '/compute/models',
];
const DOCS = [
  '/docs', '/docs/', '/Docs', '/DOCS', '/dOcS/',
  '/documentation', '/documentation/', '/Documentation', '/DOCUMENTATION', '/dOcUmEnTaTiOn/',
  '/compute/docs', '/compute/docs/', '/Compute/docs', '/COMPUTE/DOCS', '/Compute/Docs/',
  '/compute/documentation', '/compute/documentation/', '/Compute/documentation', '/COMPUTE/DOCUMENTATION', '/Compute/Documentation/',
];
const STAY_OUT = [
  '/health', '/health/', '/Health',
  '/status', '/status/', '/Status',
  '/healthz', '/healthz/', '/Healthz',
];

for (const path of [...INFERENCE_GPU, ...PRIOR_COMPUTE_PEERS]) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of DOCS) {
  assert.equal(potterHome308Dest(path), API, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not bare /compute`);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'apex-inference-gpu-pricing-docs-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of [...INFERENCE_GPU, ...PRIOR_COMPUTE_PEERS]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /#/, `${host} ${path} ${method} no hash`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const apiLoc = host === 'lobby.getdasha.com' ? LOBBY_API : API;
  for (const path of DOCS) {
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
  for (const path of STAY_OUT) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), API, `${host} ${path} ${method} not folded to api`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
        assert.notEqual(res.headers.get('location'), API, `${host} ${path} ${method} 308 dest is not /compute/api`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/inference', '/gpu', '/gpus', '/pricing', '/providing', '/mac-kit', '/documentation', '/docs', '/compute/docs', '/compute/documentation', '/health', '/status', '/healthz']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-inference-gpu-pricing-docs-pretty-path: PASS (/inference+/gpu+/gpus+/pricing+/providing+/mac-kit + /compute/* tabs 308 /compute; /docs+/documentation+/compute/docs+/compute/documentation 308 /compute/api lobby rewrite; /provide+/run+/models peers; Title-case+slash; www+lobby GET+HEAD; /compute 200; /health+/status+/healthz stay out; no plugin.jup.ag)');
