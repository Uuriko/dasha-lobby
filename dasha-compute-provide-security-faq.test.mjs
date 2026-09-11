#!/usr/bin/env node
/**
 * Provide host-security FAQ on /compute Immersity block.
 * Disk string checks: Keychain / local Ollama / no remote shell.
 * Ask/Provide doors stay. No wrangler. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function faqBlock(html) {
  const start = html.indexOf('id="compute-faq"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, 'Immersity FAQ bounds');
  return html.slice(start, end);
}

function assertHostSecure(html, label) {
  const faq = faqBlock(html);
  assert.match(faq, /data-faq=["']provide["']/, `${label} Provide FAQ stays`);
  assert.match(faq, /How do I enroll\?/, `${label} enroll Q stays`);
  assert.match(faq, /How is hosting secure\?/, `${label} host-secure Q`);
  assert.match(faq, /local Ollama/, `${label} local Ollama`);
  assert.match(faq, /Keychain/, `${label} Keychain`);
  assert.match(faq, /com\.getdasha\.compute\.provider/, `${label} Keychain service`);
  assert.match(faq, /No remote shell/, `${label} no remote shell`);
  assert.match(faq, /No remote filesystem/, `${label} no remote filesystem`);
  assert.match(faq, /DASHA_MODEL_MAP/, `${label} DASHA_MODEL_MAP`);
  assert.match(faq, /Community ≠ Hosted/, `${label} Community ≠ Hosted`);
  assert.match(faq, /Receipts stay honest/, `${label} receipts honest`);
  assert.match(html, /id=["']pick-ask["'][^>]*>Do</, `${label} Ask door`);
  assert.match(html, /id=["']pick-provide["'][^>]*>Provide</, `${label} Provide door`);
  assert.doesNotMatch(faq, /disclaimer|not financial advice|dyor|\bnfa\b|not advice/i, `${label} no lecture`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /\/room|Project Room/, `${label} stays off Room`);
}

assertHostSecure(disk, 'disk');
assertHostSecure(COMPUTE_PAGE_HTML, 'embed');

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200, '/compute 200');
assertHostSecure(await res.text(), 'worker.fetch');

console.log('dasha-compute-provide-security-faq: PASS (Keychain / local Ollama / no remote shell)');
