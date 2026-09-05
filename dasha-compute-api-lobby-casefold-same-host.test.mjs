#!/usr/bin/env node
/**
 * P2-2 COMPUTE-FULL-REVIEW: lobby Title-case /Compute/api stays on lobby.
 * www Title-case → www lowercase. Remainder after /compute/api/ keeps case.
 * Disk only. Never plugin.jup.ag. Do not fold product /Compute → lobby.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest, potterHome308Response } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /P2-2 COMPUTE-FULL-REVIEW: lobby Title-case \/Compute\/api stays on lobby/, 'P2-2 comment');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';

// Dest unit asserts stay WWW (potterHome308Dest unchanged).
assert.equal(potterHome308Dest('/Compute/api/network'), `${WWW}/compute/api/network`);
assert.equal(potterHome308Dest('/Compute/api/jobs/job_AbC'), `${WWW}/compute/api/jobs/job_AbC`);
assert.equal(potterHome308Dest('/compute/api/network'), null, 'lowercase api stays');

const env = {};

for (const method of ['GET', 'HEAD']) {
  const lobby = await edgeWorker.fetch(
    new Request(`${LOBBY}/Compute/api/network`, { method }),
    env,
  );
  assert.equal(lobby.status, 308, `lobby /Compute/api/network ${method}`);
  assert.equal(
    lobby.headers.get('location'),
    `${LOBBY}/compute/api/network`,
    `lobby /Compute/api/network ${method} loc`,
  );
  if (method === 'HEAD') assert.equal(await lobby.text(), '');

  const www = await edgeWorker.fetch(
    new Request(`${WWW}/Compute/api/network`, { method }),
    env,
  );
  assert.equal(www.status, 308, `www /Compute/api/network ${method}`);
  assert.equal(
    www.headers.get('location'),
    `${WWW}/compute/api/network`,
    `www /Compute/api/network ${method} loc`,
  );
  if (method === 'HEAD') assert.equal(await www.text(), '');
}

{
  const res = await edgeWorker.fetch(
    new Request(`${LOBBY}/Compute/api/jobs/job_AbC`),
    env,
  );
  assert.equal(res.status, 308, 'lobby remainder case');
  assert.equal(
    res.headers.get('location'),
    `${LOBBY}/compute/api/jobs/job_AbC`,
    'lobby remainder keeps job_AbC',
  );
}

// Product-page /Compute still folds to www (not this P2-2 rewrite).
{
  const dest = potterHome308Dest('/Compute');
  assert.equal(dest, `${WWW}/compute`, 'product /Compute dest stays www');
  const req = new Request(`${LOBBY}/Compute`);
  const r = potterHome308Response(req, new URL(`${LOBBY}/Compute`));
  assert.equal(r.status, 308);
  assert.equal(r.headers.get('location'), `${WWW}/compute`, 'product /Compute Location stays www');
}

console.log('dasha-compute-api-lobby-casefold-same-host: PASS (lobby /Compute/api → lobby; www → www; remainder case; no plugin.jup.ag)');
