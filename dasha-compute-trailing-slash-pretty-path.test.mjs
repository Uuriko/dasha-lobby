#!/usr/bin/env node
/**
 * P2-1 COMPUTE-FULL-REVIEW: /compute/ (+ /compute/index.html) dual-URL → 308 /compute.
 * GET/HEAD HTML product only. Do not fold /compute/api/... (slash parity).
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest, potterHome308Response } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /P2-1 COMPUTE-FULL-REVIEW/, 'trailing-slash fold comment');

const COMPUTE = 'https://www.getdasha.com/compute';
const FOLD = ['/compute/', '/compute/index.html', '/Compute/', '/COMPUTE/', '/Compute/index.html'];
const STAY_NULL = [
  '/compute',
  '/compute/api',
  '/compute/api/',
  '/compute/api/status',
  '/compute/api/status/',
  '/compute/api/healthz',
  '/compute/api/healthz/',
  '/compute/api/network/',
  '/compute/ocm',
  '/compute/ocm/',
  '/compute/skill/provide.md',
];

for (const path of FOLD) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, path);
}

assert.equal(
  potterHome308Response(new Request('https://www.getdasha.com/compute/', { method: 'POST' }), new URL('https://www.getdasha.com/compute/')),
  null,
  'POST /compute/ does not fold',
);

const env = {
  AI: {},
  ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/compute/', '/compute/index.html']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const bare = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(bare.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') assert.equal(bare.headers.get('x-dasha-edge'), 'compute');

  for (const path of ['/compute/api', '/compute/api/', '/compute/api/status', '/compute/api/status/']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(res.status, 200, `${host} ${path} API stays 200`);
    assert.match(res.headers.get('content-type') || '', /json/);
    assert.equal((await res.json()).live, true, `${host} ${path} live`);
  }
}

console.log('dasha-compute-trailing-slash-pretty-path: PASS (/compute/+/index.html GET+HEAD 308 /compute www+lobby; /compute 200; API slash stays; POST no fold; no plugin.jup.ag)');
