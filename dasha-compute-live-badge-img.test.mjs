#!/usr/bin/env node
/**
 * Quiet live Mac-count badge on /compute honesty strip.
 * Locks lobby src — www /compute/badge.svg is still 404 until Worker deploy.
 * Not on first-paint Start. gate. No stork / aitoolslist footer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const LOBBY_BADGE = 'https://lobby.getdasha.com/compute/badge.svg';
const IMG_RE = /<img\b[^>]*\bid=["']compute-live-badge["'][^>]*>/;

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function assertLiveBadge(html, label) {
  const imgs = html.match(new RegExp(IMG_RE.source, 'g')) || [];
  assert.equal(imgs.length, 1, `${label} one compute-live-badge`);
  const img = imgs[0];
  assert.match(img, new RegExp(`src=["']${LOBBY_BADGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`), `${label} lobby src`);
  assert.match(img, /alt=["']Dasha Compute · live Macs["']/, `${label} alt`);
  assert.match(img, /loading=["']lazy["']/, `${label} lazy`);
  assert.doesNotMatch(img, /www\.getdasha\.com\/compute\/badge\.svg/, `${label} not www src until deploy`);

  const panelStart = html.indexOf('id="honesty-panel"');
  assert.ok(panelStart > 0, `${label} honesty-panel`);
  const panel = html.slice(panelStart, html.indexOf('</aside>', panelStart) + 8);
  assert.match(panel, IMG_RE, `${label} badge in honesty strip`);

  const gate = html.slice(html.indexOf('id="step-gate"'), html.indexOf('id="step-how"'));
  assert.doesNotMatch(gate, /compute-live-badge|badge\.svg/, `${label} not Start. gate`);

  assert.doesNotMatch(html, /aitoolslist|stork\.ai|Listed on (AI|aitools)/i, `${label} no listed-on footer`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertLiveBadge(disk, 'disk');
assertLiveBadge(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertLiveBadge(await res.text(), 'worker.fetch');

console.log('dasha-compute-live-badge-img: PASS');
