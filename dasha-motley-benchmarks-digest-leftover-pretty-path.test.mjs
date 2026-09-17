#!/usr/bin/env node
/**
 * Durable Motley leftover HITs so tip deploys do not wipe live doors.
 * 1. Apex /api/benchmarks.json (+/) Title-case 308 → /benchmarks.
 *    Nested /compute/api/benchmarks.json keep-live. Do not invent /benchmarks.json.
 * 2. Bare /compute/api/digest (+/) Title-case 308 → /digest.json.
 *    Sibling /compute/api/digest.json keep. Do not retarget apex /api/digest
 *    (Motley HTML → /digest stays).
 * Stay-outs remain non-Motley: /api/v1 /api/models /api/providers /api/v1/status.
 * Disk only. No Designer. Never plugin.jup.ag. No Muse HTML. No Room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/api/benchmarks.json', '/api/benchmarks.json/',
  '/compute/api/digest', '/compute/api/digest/',
]) {
  assert.match(
    discoveryMap,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `Motley map lists ${path}`,
  );
}
assert.match(discoveryMap, /['"]\/compute\/api\/benchmarks\.json['"]/, 'keep nested /compute/api/benchmarks.json');
assert.match(discoveryMap, /['"]\/compute\/api\/digest\.json['"]/, 'keep sibling /compute/api/digest.json');
assert.doesNotMatch(discoveryMap, /['"]\/benchmarks\.json['"]/, 'do not invent apex /benchmarks.json');
assert.doesNotMatch(discoveryMap, /['"]\/api\/digest['"]/, 'do not retarget apex /api/digest');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'stay-out /api/v1');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'stay-out /api/models');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'stay-out /api/providers');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1\/status['"]/, 'stay-out /api/v1/status');

const WWW = 'https://www.getdasha.com';
const BENCHMARKS = `${WWW}/benchmarks`;
const DIGEST_JSON = `${WWW}/digest.json`;

const HITS = [
  ['/api/benchmarks.json', BENCHMARKS],
  ['/api/benchmarks.json/', BENCHMARKS],
  ['/Api/Benchmarks.json', BENCHMARKS],
  ['/API/BENCHMARKS.JSON', BENCHMARKS],
  ['/Api/Benchmarks.json/', BENCHMARKS],
  ['/compute/api/digest', DIGEST_JSON],
  ['/compute/api/digest/', DIGEST_JSON],
  ['/Compute/api/digest', DIGEST_JSON],
  ['/COMPUTE/API/DIGEST', DIGEST_JSON],
  ['/Compute/Api/Digest/', DIGEST_JSON],
];

const KEEP = [
  ['/compute/api/benchmarks.json', BENCHMARKS],
  ['/compute/api/digest.json', DIGEST_JSON],
];

const STAY_OUT = [
  '/benchmarks.json',
  '/api/digest',
  '/api/digest/',
  '/api/v1',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
];

for (const [path, dest] of HITS) {
  assert.equal(potterHome308Dest(path), dest, path);
}
for (const [path, dest] of KEEP) {
  assert.equal(potterHome308Dest(path), dest, `keep ${path}`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}

console.log('dasha-motley-benchmarks-digest-leftover-pretty-path: PASS (/api/benchmarks.json 308 /benchmarks; /compute/api/digest 308 /digest.json; Title-case+slash; keep nested benchmarks.json + sibling digest.json; stay-out /benchmarks.json /api/digest /api/v1|/api/models|/api/providers|/api/v1/status; no plugin.jup.ag)');
