#!/usr/bin/env node
/**
 * /privacy Compute honesty — Hosted vs Community + retention from real code paths.
 * Keep H1 Privacy; leftover CSS strippers stay. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  stripPrivacyDroppedCtaCss,
  stripPrivacyLeftoverCodeCss,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
assert.match(workerSrc, /stripPrivacyLeftoverCodeCss\(stripPrivacyDroppedCtaCss\(PRIVACY_HTML\)\)/);
assert.match(workerSrc, /Updated 4 September 2026/);
assert.match(workerSrc, /<h2>Compute<\/h2>/);
assert.match(workerSrc, /Hosted Ask runs on Cloudflare Workers AI/);
assert.match(workerSrc, /Community and Mixture/);
assert.match(workerSrc, /operators can read jobs/i);
assert.match(workerSrc, /stored:false/);
assert.match(workerSrc, /SHA-256/);
assert.match(workerSrc, /Provider earnings/);

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'privacy');
  const html = await res.text();
  assert.match(html, /<h1>Privacy<\/h1>/);
  assert.match(html, /Updated 4 September 2026/);
  assert.match(html, /<h2>Compute<\/h2>/);
  assert.match(html, /Hosted Ask runs on Cloudflare Workers AI/);
  assert.match(html, /Community and Mixture/);
  assert.match(html, /operators can read/i);
  assert.match(html, /stored:false/);
  assert.match(html, /API key hashes/);
  assert.match(html, /credit balances/i);
  assert.match(html, /Provider earnings/);
  assert.match(html, /No Compute training job/);
  assert.doesNotMatch(html, /disclaimer|not financial advice|\bNFA\b|\bdyor\b|not legal advice/i);
  assert.doesNotMatch(html, /\.cta\s*\{/, 'leftover .cta CSS still stripped');
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  const stripped = stripPrivacyLeftoverCodeCss(stripPrivacyDroppedCtaCss(html));
  assert.match(stripped, /<h1>Privacy<\/h1>/);
  assert.match(stripped, /<h2>Compute<\/h2>/);
}

{
  const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
  assert.match(html, /href=["']\/privacy["']/, 'compute page links /privacy');
}

console.log('dasha-privacy-compute: PASS (Compute Hosted/Community honesty + retention + footer link)');
