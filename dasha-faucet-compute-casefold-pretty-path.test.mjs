#!/usr/bin/env node
/**
 * Leftover Title-case product pages: live /Faucet /Compute (and slash) html-404
 * while lowercase /faucet /compute already 200. 308 to the same dest (canonical
 * lowercase). Exact lowercase /compute stays 200; /compute/ folds. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /Title-case product pages \(\/Faucet \/Compute \/Lobby/, 'product case-fold comment');

const FAUCET = 'https://www.getdasha.com/faucet';
const COMPUTE = 'https://www.getdasha.com/compute';
const FAUCET_CASES = ['/Faucet', '/FAUCET', '/Faucet/', '/fAucEt'];
const COMPUTE_CASES = ['/Compute', '/COMPUTE', '/Compute/', '/cOmPuTe'];

for (const path of FAUCET_CASES) {
  assert.equal(potterHome308Dest(path), FAUCET, path);
}
for (const path of COMPUTE_CASES) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/faucet'), null, 'lowercase faucet stays 200');
assert.equal(potterHome308Dest('/faucet/'), null, 'lowercase faucet slash stays 200');
assert.equal(potterHome308Dest('/compute'), null, 'lowercase compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, 'lowercase compute slash folds to /compute');
assert.equal(potterHome308Dest('/compute/api'), null);
assert.equal(potterHome308Dest('/Compute/use'), COMPUTE, 'tab family still case-folds');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FAUCET_CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), FAUCET, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of COMPUTE_CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const faucet = await edgeWorker.fetch(new Request(`https://${host}/faucet`), env);
  assert.equal(faucet.status, 200, `${host} /faucet stays 200`);
  if (host === 'www.getdasha.com') assert.equal(faucet.headers.get('x-dasha-edge'), 'faucet');
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
}

console.log('dasha-faucet-compute-casefold-pretty-path: PASS (Title-case /Faucet+/Compute 308 lowercase www+lobby GET+HEAD, lowercase 200)');
