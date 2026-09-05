#!/usr/bin/env node
/**
 * Leftover 2026-09-04 keep-swarm: live /compute/ask|/pay|/credits|/host|/marketplace|/you
 * (+ Title-case) html-404 while /compute/provide|/night|/sponsor already 308→/compute.
 * Typeform doors are Start. Ask. Provide. Pay. Credits.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

const COMPUTE = 'https://www.getdasha.com/compute';
const DOORS = [
  '/compute/ask', '/compute/ask/', '/compute/Ask', '/compute/ASK',
  '/compute/pay', '/compute/pay/', '/compute/Pay',
  '/compute/credits', '/compute/credits/', '/compute/Credits',
  '/compute/host', '/compute/Host',
  '/compute/market', '/compute/marketplace', '/compute/Marketplace',
  '/compute/you', '/compute/You',
];

for (const path of DOORS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute'), null);
assert.equal(potterHome308Dest('/compute/api'), null);
assert.equal(potterHome308Dest('/compute/ocm'), null);
assert.equal(potterHome308Dest('/compute/ocm/provider'), null);

for (const method of ['GET', 'HEAD']) {
  for (const path of DOORS) {
    const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`, { method }), {});
    assert.equal(res.status, 308, `${method} ${path}`);
    assert.equal(res.headers.get('location'), COMPUTE, `${method} ${path}`);
  }
  // regression: prior tabs still 308
  for (const path of ['/compute/provide', '/compute/night', '/compute/sponsor']) {
    const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`, { method }), {});
    assert.equal(res.status, 308, `${method} ${path}`);
  }
}

{
  const compute = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
  assert.equal(compute.status, 200);
  assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  const body = await compute.text();
  assert.match(body, /Ask|Start\./);
  assert.doesNotMatch(body, /plugin\.jup\.ag/);
}

console.log('dasha-compute-ask-pay-credits-door-pretty-path: PASS');
