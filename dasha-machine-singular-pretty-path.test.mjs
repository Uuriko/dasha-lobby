#!/usr/bin/env node
/**
 * Leftover pretty path (Worker a5171335-71ce-4fb5-ae94-9d8cef4c622e):
 * live /machine /compute/machine (+slash / Title-case) html-404 → 308
 * https://www.getdasha.com/compute while /machines /compute/machines
 * already 308→/compute. Title-case covered by potterHome308Dest
 * lowercasing. Exact /compute stays 200 (null dest).
 * Skip /openai /arcade /games /social /x402 /status /health /healthz /v1.
 * Disk only. No Designer. Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
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
assert.match(
  workerSrc,
  /Leftover \/machine \/compute\/machine \(Worker a5171335\)/,
  'compute leftover comment names singular /machine family',
);
assert.match(
  workerSrc,
  /Leftover \/machine\|\/compute\/machine → \/compute \(Worker a5171335\)/,
  'potterHome308Dest comment lists leftover /machine|/compute/machine',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of ['/machine', '/machine/', '/compute/machine', '/compute/machine/']) {
  assert.match(tab, new RegExp(`'${path}'`), `${path} in compute-tab set`);
}
for (const path of ['/machines', '/machines/', '/compute/machines', '/compute/machines/']) {
  assert.match(tab, new RegExp(`'${path}'`), `${path} prior plural peer still in compute-tab set`);
}

const SKIPS = [
  '/openai', '/arcade', '/games', '/social', '/x402',
  '/status', '/health', '/healthz', '/v1',
];
for (const skip of SKIPS) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
}
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const COMPUTE = 'https://www.getdasha.com/compute';

const SHIP = [
  '/machine', '/machine/', '/Machine', '/MACHINE', '/mAcHiNe/',
  '/compute/machine', '/compute/machine/', '/Compute/machine',
  '/COMPUTE/MACHINE', '/Compute/Machine/',
];
const PRIOR_PEERS = [
  '/machines', '/machines/', '/Machines', '/MACHINES',
  '/compute/machines', '/compute/machines/', '/Compute/machines',
  '/COMPUTE/MACHINES',
];
const STAY_404 = [
  '/openai', '/openai/', '/OpenAI',
  '/arcade', '/arcade/', '/Arcade',
  '/games', '/games/', '/Games',
  '/social', '/social/', '/Social',
  '/x402', '/x402/',
  '/status', '/status/', '/Status',
  '/healthz', '/healthz/',
  '/v1', '/v1/',
];
const SKIP_UNTOUCHED = ['/health', '/health/', '/Health'];

for (const path of [...SHIP, ...PRIOR_PEERS]) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
for (const path of [...STAY_404, ...SKIP_UNTOUCHED]) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

const env = {
  LOBBY_SESSION_SECRET: 'machine-singular-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of [...SHIP, ...PRIOR_PEERS]) {
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
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (host === 'www.getdasha.com') {
        assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} ${method} html-404`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }
  for (const path of SKIP_UNTOUCHED) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/machine', '/compute/machine', '/machines', '/compute/machines',
  '/openai', '/arcade', '/games', '/social', '/x402',
  '/status', '/health', '/healthz', '/v1',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-machine-singular-pretty-path: PASS (/machine+/compute/machine 308 /compute; Title-case+slash; www+lobby GET+HEAD; /machines+/compute/machines peers; /compute 200; /openai+/arcade+/games+/social+/x402+/status+/healthz+/v1 404; /health stays out; no plugin.jup.ag)');
