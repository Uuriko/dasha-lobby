#!/usr/bin/env node
/**
 * Quiet Compute buyer FAQ on /llms-full.txt (LLMS_FULL_TXT only).
 * Four Q/A. No lecture. No invented Mac count. No always-on model name.
 * $0.05/job is Provider Earn, not the buyer price.
 * Stays off dasha-compute.html / dasha-compute-page.mjs while #114 owns those.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No home first paint.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

const FAQ_LINES = [
  'How do I start? Sign in. Change the base URL. https://lobby.getdasha.com/compute/api/v1',
  'What is live? The Mac that is advertising. Read /compute/api/network.',
  'What if no Mac is online? Hosted is still there.',
  'What does $0.05/job mean? Provider Earn. Not the buyer price.',
];
const FAQ_BLOCK = FAQ_LINES.join('\n');

function extractConst(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`);
  const m = worker.match(re);
  assert.ok(m, `${name} must be embedded in the worker`);
  return m[1];
}

function buyerFaq(full, label) {
  const m = String(full).match(/^## Compute buyer FAQ\n\n([\s\S]*?)\n\nLogin:/m);
  assert.ok(m, `${label} ## Compute buyer FAQ`);
  return m[1].trim();
}

function assertBuyerFaq(full, label) {
  const faq = buyerFaq(full, label);
  assert.equal(faq, FAQ_BLOCK, `${label} four Q/A lines`);
  assert.equal((full.match(/^## Compute buyer FAQ$/gm) || []).length, 1, `${label} FAQ once`);
  assert.doesNotMatch(faq, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(faq, /\d+\s*Mac|Macs · \d|providers_online=\d/i, `${label} no invented Mac count`);
  assert.doesNotMatch(faq, /always on|always-on|always free|free-qwen|gpt-oss|qwen3/i, `${label} no always-on model`);
  assert.doesNotMatch(faq, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.match(faq, /What does \$0\.05\/job mean\? Provider Earn\. Not the buyer price\./, `${label} Earn not buyer price`);
  const before = String(full).split('## Compute buyer FAQ')[0];
  assert.doesNotMatch(before, /\$0\.05\/job/, `${label} $0.05/job stays off buyer one-path lines`);
}

const full = extractConst('LLMS_FULL_TXT');
const llms = extractConst('LLMS_TXT');
assertBuyerFaq(full, 'LLMS_FULL_TXT');
assert.doesNotMatch(llms, /## Compute buyer FAQ/, 'FAQ stays off llms.txt');
assert.doesNotMatch(llms, /How do I start\?/, 'FAQ Qs stay off llms.txt');
assert.doesNotMatch(llms, /\$0\.05\/job/, 'llms.txt has no $0.05/job');

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const res = await edgeWorker.fetch(new Request(`${origin}/llms-full.txt`), {});
  assert.equal(res.status, 200, `${origin}/llms-full.txt`);
  assert.equal(res.headers.get('x-dasha-edge'), 'llms-full');
  const body = await res.text();
  assertBuyerFaq(body, `${origin}/llms-full.txt`);

  const index = await edgeWorker.fetch(new Request(`${origin}/llms.txt`), {});
  assert.equal(index.status, 200, `${origin}/llms.txt`);
  const indexBody = await index.text();
  assert.doesNotMatch(indexBody, /## Compute buyer FAQ/, `${origin}/llms.txt no FAQ heading`);
  assert.doesNotMatch(indexBody, /How do I ask\?/, `${origin}/llms.txt no FAQ Q`);
  assert.doesNotMatch(indexBody, /\$0\.05\/job/, `${origin}/llms.txt no $0.05/job`);
}

console.log('dasha-compute-buyer-faq: PASS (four Q/A on LLMS_FULL_TXT + served /llms-full.txt; Earn not buyer price; no Mac count; no always-on model)');
