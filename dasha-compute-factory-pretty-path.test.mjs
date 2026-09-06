#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 0ff8cee2): live /compute/factory /api/factory
 * (+slash / Title-case) html-404 → 308 https://www.getdasha.com/compute/api/factory.
 * Lobby keeps same-host /compute/api/* via potterHome308Response.
 * Bare /factory stays out. Exact /compute/api/factory stays the 200 JSON handler.
 * Disk only. No Designer. Never plugin.jup.ag. Do not invent arcade routes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_FACTORY_308_PATHS/, 'factory 308 set present');
assert.match(
  workerSrc,
  /Leftover \/compute\/factory \/api\/factory \(\+slash \/ Title-case\) → \/compute\/api\/factory/,
  'factory leftover comment',
);
assert.match(workerSrc, /Bare \/factory stays out/, 'bare /factory stay-out comment');
assert.match(workerSrc, /Never fold exact \/compute\/api\/factory/, 'exact API factory stay-out comment');
assert.match(workerSrc, /'\/compute\/factory'/, 'set lists /compute/factory');
assert.match(workerSrc, /'\/api\/factory'/, 'set lists /api/factory');
assert.doesNotMatch(
  workerSrc.match(/const POTTER_COMPUTE_API_FACTORY_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0],
  /['"]\/factory['"]/,
  'bare /factory is not in factory 308 set',
);
assert.doesNotMatch(
  workerSrc.match(/const POTTER_COMPUTE_API_FACTORY_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0],
  /['"]\/compute\/api\/factory['"]/,
  'exact /compute/api/factory is not in factory 308 set',
);

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const FACTORY = `${WWW}/compute/api/factory`;

const FOLDS = [
  '/compute/factory', '/compute/factory/', '/Compute/factory', '/COMPUTE/FACTORY/',
  '/Compute/Factory', '/API/factory/',
  '/api/factory', '/api/factory/', '/Api/Factory', '/API/FACTORY/',
];
const STAY_OUT = [
  '/factory', '/factory/', '/Factory',
  '/compute/api/factory', '/compute/api/factory/',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), FACTORY, path);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay out ${path}`);
}
assert.equal(potterHome308Dest('/compute/network'), `${WWW}/compute/api/network`, 'network peer still folds');
assert.equal(potterHome308Dest('/compute/api/network'), null, 'exact network API stays handler');

const env = { LOBBY_SESSION_SECRET: 'compute-factory-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const want = host === 'lobby.getdasha.com' ? `${LOBBY}/compute/api/factory` : FACTORY;
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const exact = await edgeWorker.fetch(new Request(`https://${host}/compute/api/factory`, { method }), env);
    assert.equal(exact.status, 200, `${host} /compute/api/factory ${method} stays handler`);
    if (method === 'GET') {
      const body = await exact.json();
      assert.equal(body.schema, 'factory.compute.v0', `${host} factory schema`);
    } else {
      assert.equal(await exact.text(), '');
    }
  }
  const bare = await edgeWorker.fetch(new Request(`https://${host}/factory`), env);
  assert.notEqual(bare.status, 308, `${host} /factory is not a 308 fold`);
  assert.equal(potterHome308Dest('/factory'), null, '/factory dest stays null');
  if (host === 'www.getdasha.com') {
    assert.equal(bare.status, 404, 'www /factory stays 404');
    assert.equal(bare.headers.get('x-dasha-edge'), 'html-404');
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/compute/factory', '/api/factory', '/factory']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-compute-factory-pretty-path: PASS (/compute/factory+/api/factory 308 /compute/api/factory www+lobby GET+HEAD; bare /factory out; exact API 200; no plugin.jup.ag)');
