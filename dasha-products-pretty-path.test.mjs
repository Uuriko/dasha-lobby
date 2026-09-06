#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 8008785a): live /products /compute/products
 * (+slash / Title-case) html-404 → 308 /compute.
 * Keep prior peers /product /providers if already folding to /compute.
 * Exact /compute stays 200 (null dest). Disk only. No Designer. Never plugin.jup.ag.
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
  /\/products\|\/compute\/products/,
  'apex→/compute leftover comment lists /products|/compute/products',
);

const COMPUTE = 'https://www.getdasha.com/compute';

const PRODUCTS = [
  '/products', '/products/', '/Products', '/PRODUCTS', '/pRoDuCtS/',
  '/compute/products', '/compute/products/', '/Compute/products', '/COMPUTE/PRODUCTS', '/Compute/Products/',
];
const PRIOR_PEERS = [
  '/product', '/product/', '/Product', '/PRODUCT', '/pRoDuCt/',
  '/providers', '/providers/', '/Providers', '/PROVIDERS', '/pRoViDeRs/',
];
const FOLDS = [...PRODUCTS, ...PRIOR_PEERS];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), 'https://www.getdasha.com/compute', '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/compute/use'), COMPUTE, '/compute/use still compute tab');

const env = { LOBBY_SESSION_SECRET: 'products-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/products', '/compute/products', '/product', '/providers']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-products-pretty-path: PASS (/products+/compute/products 308 /compute; prior /product /providers still fold; Title-case+slash; /compute 200; no plugin.jup.ag)');
