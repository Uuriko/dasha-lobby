#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 320ba32b): live /run /ollama
 * /compute/run /compute/ollama (+slash / Title-case) html-404 → 308 /compute.
 * Title-case works via existing dest lowercasing.
 * Keep prior compute-tab peers. Exact /compute stays 200 (null dest).
 * /yc /news stay 404 — do not invent a fold.
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
assert.match(
  workerSrc,
  /\/run\|\/ollama\|\/compute\/run\|\/compute\/ollama/,
  'apex→/compute leftover comment lists /run|/ollama|/compute/run|/compute/ollama',
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

const RUN_OLLAMA = [
  '/run', '/run/', '/Run', '/RUN', '/rUn/',
  '/ollama', '/ollama/', '/Ollama', '/OLLAMA', '/OlLaMa/',
  '/compute/run', '/compute/run/', '/Compute/run', '/COMPUTE/RUN', '/Compute/Run/',
  '/compute/ollama', '/compute/ollama/', '/Compute/ollama', '/COMPUTE/OLLAMA', '/Compute/Ollama/',
];
const PRIOR_PEERS = [
  '/compute/use', '/Compute/use',
  '/products', '/products/', '/Products',
  '/compute/products', '/Compute/products',
  '/faucet/compute', '/Faucet/compute',
];
const FOLDS = [...RUN_OLLAMA, ...PRIOR_PEERS];
const STAY_404 = ['/yc', '/yc/', '/Yc', '/YC', '/news', '/news/', '/News', '/NEWS'];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
for (const path of STAY_404) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'run-ollama-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  for (const path of STAY_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 404, `${host} ${path} ${method} stays 404`);
      if (host === 'www.getdasha.com') {
        assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} ${method} html-404`);
      }
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/run', '/ollama', '/compute/run', '/compute/ollama', '/yc', '/news']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-run-ollama-pretty-path: PASS (/run+/ollama+/compute/run+/compute/ollama 308 /compute; Title-case+slash; www+lobby GET+HEAD; peers; /compute 200; /yc+/news 404; no plugin.jup.ag)');
