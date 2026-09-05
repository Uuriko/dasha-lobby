#!/usr/bin/env node
/**
 * Leftover: live GET apex Typeform/product doors → html-404 while /compute/* peers 308.
 * /provide /start /sponsor(s) /ask /pay /credits /host /use /marketplace /market /you
 * /night /build /ocm (+ Title-case / slash) → https://www.getdasha.com/compute
 * /tip /tip-me → https://www.getdasha.com/faucet (claim path ends tip me)
 * Never plugin.jup.ag. Never Designer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /Apex product doors/);
assert.match(workerSrc, /Ask\/Pay\/Credits\/Host\/Use\/Night\/Marketplace/);
assert.match(workerSrc, /tip-me doors/);

const COMPUTE = 'https://www.getdasha.com/compute';
const FAUCET = 'https://www.getdasha.com/faucet';
const COMPUTE_CASES = [
  '/provide', '/provide/', '/Provide', '/PROVIDE', '/pRoViDe/',
  '/start', '/start/', '/Start', '/START', '/sTaRt/',
  '/sponsor', '/sponsor/', '/Sponsor', '/SPONSOR',
  '/sponsors', '/sponsors/', '/Sponsors', '/SPONSORS',
  '/ask', '/ask/', '/Ask', '/ASK', '/aSk/',
  '/pay', '/pay/', '/Pay', '/PAY',
  '/credits', '/credits/', '/Credits', '/CREDITS',
  '/host', '/host/', '/Host', '/HOST',
  '/use', '/use/', '/Use', '/USE',
  '/marketplace', '/marketplace/', '/Marketplace', '/MARKETPLACE',
  '/market', '/market/', '/Market', '/MARKET',
  '/you', '/you/', '/You', '/YOU',
  '/night', '/night/', '/Night', '/NIGHT',
  '/build', '/build/', '/Build', '/BUILD',
  '/ocm', '/ocm/', '/Ocm', '/OCM',
];
const FAUCET_CASES = [
  '/tip', '/tip/', '/Tip', '/TIP',
  '/tip-me', '/tip-me/', '/Tip-me', '/TIP-ME', '/Tip-Me/',
];

for (const path of COMPUTE_CASES) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of FAUCET_CASES) {
  assert.equal(potterHome308Dest(path), FAUCET, path);
}
assert.equal(potterHome308Dest('/compute'), null, 'lowercase /compute stays 200');
assert.equal(potterHome308Dest('/faucet'), null, 'lowercase /faucet stays 200');
assert.equal(potterHome308Dest('/compute/provide'), COMPUTE);
assert.equal(potterHome308Dest('/compute/sponsor'), COMPUTE);
assert.equal(potterHome308Dest('/compute/ask'), COMPUTE);
assert.equal(potterHome308Dest('/compute/ocm'), null, 'lowercase /compute/ocm stays edge (200)');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of COMPUTE_CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of FAUCET_CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), FAUCET, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

console.log('dasha-apex-product-door-pretty-path: PASS (apex Ask/Pay/Credits/Host/Use/Night/Marketplace/Market/You/Build/Ocm+provide/start/sponsor→/compute; tip→/faucet www+lobby GET+HEAD)');
