#!/usr/bin/env node
/**
 * Leftover Title-case /Compute/api(+sub) and /Faucet/fills|tape|status|me
 * html-404 while lowercase siblings already 200 (or 401 for API). 308 to
 * canonical lowercase. Keep remainder after /compute/api/ (job_/mac_ b64url)
 * and fill/fills sig case (base58). Do not invent /faucet/jar.
 * Pattern matches /Compute/ocm and /Faucet/fill. Disk only. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /Compute\/api\(\.\.\.\) Title-case/, 'compute api case-fold comment');
assert.match(workerSrc, /job_\/mac_ ids are base64url/, 'api remainder case kept');
assert.match(workerSrc, /Faucet\/fills\(\+sig\)/, 'fills case-fold comment');
assert.match(workerSrc, /POTTER_FAUCET_LEAF_CASEFOLD/, 'faucet leaf casefold set');
assert.doesNotMatch(workerSrc, /POTTER_FAUCET_LEAF_CASEFOLD[\s\S]*\/faucet\/jar/, 'do not invent /faucet/jar');

const WWW = 'https://www.getdasha.com';

const API_CASES = [
  ['/Compute/api', `${WWW}/compute/api`],
  ['/compute/API', `${WWW}/compute/api`],
  ['/COMPUTE/api/', `${WWW}/compute/api/`],
  ['/Compute/API', `${WWW}/compute/api`],
  ['/Compute/api/healthz', `${WWW}/compute/api/healthz`],
  ['/compute/API/v1/models', `${WWW}/compute/api/v1/models`],
  ['/Compute/api/jobs/job_AbC', `${WWW}/compute/api/jobs/job_AbC`],
  ['/COMPUTE/api/network', `${WWW}/compute/api/network`],
];

const FAUCET_CASES = [
  ['/Faucet/fills', `${WWW}/faucet/fills`],
  ['/faucet/Fills', `${WWW}/faucet/fills`],
  ['/FAUCET/FILLS', `${WWW}/faucet/fills`],
  ['/Faucet/fills/', `${WWW}/faucet/fills/`],
  ['/Faucet/fills/AbCdEf123', `${WWW}/faucet/fills/AbCdEf123`],
  ['/FAUCET/fills/XyZ', `${WWW}/faucet/fills/XyZ`],
  ['/Faucet/tape', `${WWW}/faucet/tape`],
  ['/faucet/Tape', `${WWW}/faucet/tape`],
  ['/Faucet/status', `${WWW}/faucet/status`],
  ['/faucet/Status', `${WWW}/faucet/status`],
  ['/Faucet/me', `${WWW}/faucet/me`],
  ['/FAUCET/ME', `${WWW}/faucet/me`],
];

for (const [path, dest] of API_CASES) {
  assert.equal(potterHome308Dest(path), dest, path);
}
for (const [path, dest] of FAUCET_CASES) {
  assert.equal(potterHome308Dest(path), dest, path);
}

assert.equal(potterHome308Dest('/compute/api'), null, 'lowercase api stays');
assert.equal(potterHome308Dest('/compute/api/'), null, 'lowercase api slash stays');
assert.equal(potterHome308Dest('/compute/api/healthz'), null, 'lowercase healthz stays');
assert.equal(potterHome308Dest('/compute/api/jobs/job_AbC'), null, 'lowercase api+id stays');
assert.equal(potterHome308Dest('/faucet/fills'), null, 'lowercase fills stays');
assert.equal(potterHome308Dest('/faucet/fills/AbCdEf123'), null, 'lowercase fills+sig stays');
assert.equal(potterHome308Dest('/faucet/tape'), null, 'lowercase tape stays');
assert.equal(potterHome308Dest('/faucet/status'), null, 'lowercase status stays');
assert.equal(potterHome308Dest('/faucet/me'), null, 'lowercase me stays');
assert.equal(potterHome308Dest('/faucet/fill'), null, 'lowercase fill stays');
assert.equal(potterHome308Dest('/faucet/fill/AbCdEf123'), null, 'lowercase fill+sig stays');
assert.equal(potterHome308Dest('/faucet/jar'), null, 'do not invent /faucet/jar');
assert.equal(potterHome308Dest('/Faucet/jar'), null, 'Title-case /Faucet/jar stays gap');
assert.equal(potterHome308Dest('/compute/skill'), null, 'lowercase skill index stays gap');

const env = {};
const LOBBY = 'https://lobby.getdasha.com';
const API_PATHS = new Set(API_CASES.map(([p]) => p));
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [...API_CASES, ...FAUCET_CASES]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      // P2-2: lobby + Compute/api Location stays on lobby; faucet (and www) keep WWW dest.
      let want = dest;
      if (host === 'lobby.getdasha.com' && API_PATHS.has(path)) {
        want = LOBBY + new URL(dest).pathname + new URL(dest).search + new URL(dest).hash;
      }
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

for (const path of ['/compute/api', '/compute/api/healthz']) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), env);
  assert.equal(res.status, 200, `www ${path} stays 200`);
}
{
  const fills = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/fills'), env);
  assert.equal(fills.status, 200, 'www /faucet/fills stays 200');
  assert.equal(fills.headers.get('x-dasha-edge'), 'faucet-tape');
  const tape = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/tape'), env);
  assert.equal(tape.status, 200, 'www /faucet/tape stays 200');
  assert.equal(tape.headers.get('x-dasha-edge'), 'faucet-tape');
  const jar = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/jar'), env);
  assert.equal(jar.status, 404, 'www /faucet/jar stays 404');
}

console.log('dasha-compute-api-faucet-fills-tape-casefold-pretty-path: PASS (Compute/api + Faucet fills/tape/status/me Title-case 308; lobby API same-host; faucet WWW)');
