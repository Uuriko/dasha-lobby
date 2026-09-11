#!/usr/bin/env node
/**
 * One Provide host-security FAQ on /compute Immersity #ux-faq-items.
 * Disk string checks: Keychain / Ollama / no remote shell.
 * Hidden like peers. No extra FAQ noise. No wrangler. Never plugin.jup.ag.
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

const HOST_ITEM = `<div class="ux-faq-item" data-faq="provide" hidden>
        <p class="ux-faq-q">Is hosting safe for my Mac?</p>
        <p class="ux-faq-a">Weights stay local (Ollama). We send prompts; you return text. Keychain holds the provider key. No remote shell. Pick models; stop anytime.</p>
      </div>`;

function faqBlock(html) {
  const start = html.indexOf('id="ux-faq-items"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, '#ux-faq-items bounds');
  return html.slice(start, end);
}

function assertHostSafe(html, label) {
  const faq = faqBlock(html);
  assert.match(faq, /How do I enroll\?/, `${label} enroll Q stays`);
  assert.ok(faq.includes(HOST_ITEM), `${label} one hidden Provide host-safe item`);
  assert.equal((faq.match(/data-faq="provide"/g) || []).length, 3, `${label} three Provide items`);
  assert.match(faq, /How fast is Provide\?/, `${label} Provide speed Q`);
  assert.match(faq, /measured_providers/, `${label} measured_providers`);
  assert.equal((faq.match(/Is hosting safe for my Mac\?/g) || []).length, 1, `${label} host-safe Q once`);
  assert.match(faq, /Keychain/, `${label} Keychain`);
  assert.match(faq, /Ollama/, `${label} Ollama`);
  assert.match(faq, /No remote shell/, `${label} no remote shell`);
  assert.match(html, /id=["']pick-ask["'][^>]*>Do</, `${label} Ask door`);
  assert.match(html, /id=["']pick-provide["'][^>]*>Provide</, `${label} Provide door`);
  assert.doesNotMatch(faq, /How is hosting secure\?/, `${label} no long Q`);
  assert.doesNotMatch(faq, /disclaimer|not financial advice|dyor|\bnfa\b|not advice/i, `${label} no lecture`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertHostSafe(disk, 'disk');
assertHostSafe(COMPUTE_PAGE_HTML, 'embed');

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200, '/compute 200');
assertHostSafe(await res.text(), 'worker.fetch');

console.log('dasha-compute-provide-security-faq: PASS (Keychain / Ollama / no remote shell)');
