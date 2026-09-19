#!/usr/bin/env node
/** Page meta is the audit-tightened descriptive line. Share OG is the API line. No sponsor lecture. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
assert.equal(html, COMPUTE_PAGE_HTML);

const META = /Run AI prompts on real community Macs/;
for (const [label, body] of [['disk', html], ['embed', COMPUTE_PAGE_HTML]]) {
  assert.match(body, /name="description" content="Run AI prompts on real community Macs — \$0\.05 per job, signed receipts, live tok\/s benchmarks\. OpenAI-compatible API\. Or provide your Mac and earn\."/, `${label} meta`);
  assert.match(body, /property="og:description" content="Use a Mac. OpenAI-compatible. https:\/\/lobby\.getdasha\.com\/compute\/api\/v1"/, `${label} OG`);
  assert.match(body, META, `${label} short copy`);
  assert.doesNotMatch(body, /Sponsor a Mac for the getdasha\.com compute network/, `${label} no lecture`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin`);
}
const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
const served = await res.text();
assert.match(served, /name="description" content="Run AI prompts on real community Macs/);
assert.doesNotMatch(served, /plugin\.jup\.ag/);
console.log('dasha-compute-desc-leftover: PASS');
