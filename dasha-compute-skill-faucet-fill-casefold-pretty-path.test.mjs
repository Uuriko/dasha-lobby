#!/usr/bin/env node
/**
 * Leftover Title-case compute skill + faucet fill doors:
 * live /compute/skill/PROVIDE.md /USE.md /OCM-HOST.md and /Compute/skill/... html-404
 * while lowercase siblings already 200. Same for /Faucet/fill(+sig) — keep sig case.
 * 308 to canonical lowercase (keep subpath). Exact lowercase stays for 200 handlers.
 * Pattern matches /Compute/ocm casefold. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /compute\/skill\/\*\.md disk names are PROVIDE\.md/, 'skill case-fold comment');
assert.match(workerSrc, /Faucet\/fill\(\+sig\) Title-case/, 'faucet fill case-fold comment');
assert.match(workerSrc, /Keep sig case \(base58\)/, 'fill sig case preserved');

const WWW = 'https://www.getdasha.com';

const SKILL_CASES = [
  ['/compute/skill/PROVIDE.md', `${WWW}/compute/skill/provide.md`],
  ['/compute/skill/USE.md', `${WWW}/compute/skill/use.md`],
  ['/compute/skill/OCM-HOST.md', `${WWW}/compute/skill/ocm-host.md`],
  ['/Compute/skill/provide.md', `${WWW}/compute/skill/provide.md`],
  ['/COMPUTE/skill/use.md', `${WWW}/compute/skill/use.md`],
  ['/Compute/skill/OCM-HOST.md', `${WWW}/compute/skill/ocm-host.md`],
];

const FILL_CASES = [
  ['/Faucet/fill', `${WWW}/faucet/fill`],
  ['/FAUCET/FILL', `${WWW}/faucet/fill`],
  ['/faucet/Fill', `${WWW}/faucet/fill`],
  ['/Faucet/fill/', `${WWW}/faucet/fill/`],
  ['/Faucet/fill/AbCdEf123', `${WWW}/faucet/fill/AbCdEf123`],
  ['/FAUCET/fill/XyZ', `${WWW}/faucet/fill/XyZ`],
];

for (const [path, dest] of SKILL_CASES) {
  assert.equal(potterHome308Dest(path), dest, path);
}
for (const [path, dest] of FILL_CASES) {
  assert.equal(potterHome308Dest(path), dest, path);
}

assert.equal(potterHome308Dest('/compute/skill/provide.md'), null, 'lowercase provide skill stays');
assert.equal(potterHome308Dest('/compute/skill/use.md'), null, 'lowercase use skill stays');
assert.equal(potterHome308Dest('/compute/skill/ocm-host.md'), null, 'lowercase ocm-host skill stays');
assert.equal(potterHome308Dest('/faucet/fill'), null, 'lowercase bare fill stays for handler');
assert.equal(potterHome308Dest('/faucet/fill/AbCdEf123'), null, 'lowercase fill+sig stays for handler');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [...SKILL_CASES, ...FILL_CASES]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/compute/skill/provide.md', '/compute/skill/use.md', '/compute/skill/ocm-host.md']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(res.status, 200, `${host} ${path} stays 200`);
    assert.match(res.headers.get('x-dasha-edge') || '', /^compute-skill-/);
  }
}

console.log('dasha-compute-skill-faucet-fill-casefold-pretty-path: PASS (skill+faucet/fill Title-case 308 lowercase www+lobby GET+HEAD)');
