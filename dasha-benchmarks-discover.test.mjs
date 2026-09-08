#!/usr/bin/env node
/**
 * Quiet /benchmarks discoverability on llms + contribute.
 * No tok/s numbers. No lecture. Discoverability-only — not a Worker behavior change.
 * Route markers already on main (Instinct 8b10414). No second page.
 * No wrangler. No Designer. No plugin.jup.ag. No home first paint.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const LIVE = 'https://www.getdasha.com/benchmarks';

function extractConst(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`);
  const m = worker.match(re);
  assert.ok(m, `${name} must be embedded in the worker`);
  return m[1];
}

function assertQuietBenchmarks(body, label) {
  assert.ok(body.includes('/benchmarks'), `${label} includes /benchmarks`);
  assert.ok(body.includes(LIVE), `${label} includes ${LIVE}`);
  assert.doesNotMatch(body, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(body, /\d+\s*tok\/s/i, `${label} no invented tok/s`);
  assert.doesNotMatch(body, /providers_online=\d/, `${label} no invented Mac count`);
}

const llms = extractConst('LLMS_TXT');
const full = extractConst('LLMS_FULL_TXT');
assert.match(llms, /^Live benchmarks https:\/\/www\.getdasha\.com\/benchmarks$/m, 'llms.txt Live benchmarks line');
assert.match(llms, /\[Live benchmarks\]\(https:\/\/www\.getdasha\.com\/benchmarks\)/, 'llms.txt Live benchmarks link');
assert.match(full, /^Live benchmarks: https:\/\/www\.getdasha\.com\/benchmarks$/m, 'llms-full Live benchmarks line');
assertQuietBenchmarks(llms, 'LLMS_TXT');
assertQuietBenchmarks(full, 'LLMS_FULL_TXT');

const contribute = worker.match(/const CONTRIBUTE_HTML = htmlPage\([\s\S]*?\);\n/);
assert.ok(contribute, 'CONTRIBUTE_HTML');
assert.match(
  contribute[0],
  /<p>Compute\. <a href="https:\/\/www\.getdasha\.com\/compute#ask">Ask a Mac<\/a> · <a href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac<\/a> · <a href="https:\/\/www\.getdasha\.com\/benchmarks">Benchmarks<\/a><\/p>/,
  'contribute quiet Benchmarks beside Ask/Provide',
);
assertQuietBenchmarks(contribute[0], 'CONTRIBUTE_HTML');

assert.match(worker, /import \{ BENCHMARKS_PAGE_HTML \} from '\.\/dasha-benchmarks-page\.mjs';/, 'benchmarks page import already on main');
assert.match(worker, /function isBenchmarksPath\(/, 'isBenchmarksPath already on main');
assert.equal((worker.match(/isBenchmarksPath\(url\.pathname\)/g) || []).length, 3, 'benchmarks route on every host branch');
assert.match(worker, /'X-Dasha-Edge': 'benchmarks'/, 'x-dasha-edge:benchmarks already on main');
assert.match(extractConst('SITEMAP_XML'), /https:\/\/www\.getdasha\.com\/benchmarks<\/loc>/, 'sitemap already lists /benchmarks');

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const index = await edgeWorker.fetch(new Request(`${origin}/llms.txt`), {});
  assert.equal(index.status, 200, `${origin}/llms.txt`);
  assert.equal(index.headers.get('x-dasha-edge'), 'llms');
  const indexBody = await index.text();
  assert.match(indexBody, /^Live benchmarks https:\/\/www\.getdasha\.com\/benchmarks$/m, `${origin}/llms.txt line`);
  assertQuietBenchmarks(indexBody, `${origin}/llms.txt`);

  const fullRes = await edgeWorker.fetch(new Request(`${origin}/llms-full.txt`), {});
  assert.equal(fullRes.status, 200, `${origin}/llms-full.txt`);
  assert.equal(fullRes.headers.get('x-dasha-edge'), 'llms-full');
  const fullBody = await fullRes.text();
  assert.match(fullBody, /^Live benchmarks: https:\/\/www\.getdasha\.com\/benchmarks$/m, `${origin}/llms-full.txt line`);
  assertQuietBenchmarks(fullBody, `${origin}/llms-full.txt`);

  const page = await edgeWorker.fetch(new Request(`${origin}/contribute`), {});
  assert.equal(page.status, 200, `${origin}/contribute`);
  assert.equal(page.headers.get('x-dasha-edge'), 'contribute');
  const html = await page.text();
  assert.match(html, /href="https:\/\/www\.getdasha\.com\/benchmarks"/, `${origin}/contribute Benchmarks`);
  assertQuietBenchmarks(html, `${origin}/contribute`);

  const live = await edgeWorker.fetch(new Request(`${origin}/benchmarks`), {});
  assert.equal(live.status, 200, `${origin}/benchmarks`);
  assert.equal(live.headers.get('x-dasha-edge'), 'benchmarks', `${origin}/benchmarks edge`);
}

console.log('dasha-benchmarks-discover: PASS (llms + contribute + served /benchmarks door; no tok/s; route markers already on main)');
