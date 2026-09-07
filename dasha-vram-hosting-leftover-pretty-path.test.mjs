#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 2c4779a2): live /vram /hosting /rent-gpu
 * /infer /deposit /vscode (+slash / Title-case / /compute/* tabs)
 * 308 → https://www.getdasha.com/compute.
 * Peers /gpu /gpus /host /hosts /rent /inference /topup /credits already
 * 308→/compute. Skip /code /terminal /python /rust /go /openai /arcade
 * /x402 /status (leave 404). Never fold /price or /privacy.
 * Disk only. No Designer. Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(
  workerSrc,
  /Leftover \/vram \/hosting \/rent-gpu \/infer \/deposit \/vscode batch/,
  'leftover comment names Worker 2c4779a2 family',
);
assert.match(workerSrc, /Worker 2c4779a2/, 'leftover comment cites live Worker 2c4779a2');

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const LEAVES = ['vram', 'hosting', 'rent-gpu', 'infer', 'deposit', 'vscode'];
for (const leaf of LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/${leaf}/'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}/'`));
}

const COMPUTE = 'https://www.getdasha.com/compute';
const FOLDS = LEAVES.flatMap((leaf) => [
  `/${leaf}`, `/${leaf}/`,
  `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
  `/${leaf.toUpperCase()}`,
  `/compute/${leaf}`, `/compute/${leaf}/`,
  `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
]);
const PEERS = ['/gpu', '/gpus', '/host', '/hosts', '/rent', '/inference', '/topup', '/credits'];
const SKIP = [
  '/code', '/code/',
  '/terminal', '/terminal/',
  '/python', '/python/',
  '/rust', '/rust/',
  '/go', '/go/',
  '/openai', '/openai/',
  '/arcade', '/arcade/',
  '/x402', '/x402/',
  '/status', '/status/',
];
const STAY_200 = ['/compute', '/privacy', '/privacy/', '/price', '/price/'];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of PEERS) {
  assert.equal(potterHome308Dest(path), COMPUTE, `peer ${path}`);
}
for (const path of SKIP) {
  assert.equal(potterHome308Dest(path), null, `skip ${path} stays null`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}

console.log('dasha-vram-hosting-leftover-pretty-path: PASS (/vram+/hosting+/rent-gpu+/infer+/deposit+/vscode + /compute/* tabs 308 /compute; skip /code+/terminal+/python+/rust+/go+/openai+/arcade+/x402+/status null; /compute+/privacy+/price stay 200; no plugin.jup.ag)');
