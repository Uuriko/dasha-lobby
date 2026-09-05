#!/usr/bin/env node
/** Quiet How engines line: Local Macs + Hosted floor — not on gate first paint. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs');

const re = /id=["']how-floor-fine["'][^>]*>Local Macs \+ Hosted floor\./;
assert.match(html, re, 'how-floor-fine copy');
assert.match(
  html,
  /id=["']step-how["'][\s\S]*?id=["']how-floor-fine["'][\s\S]*?<\/section>/,
  'how-floor-fine inside step-how',
);
const gate = html.match(/id=["']step-gate["'][\s\S]*?<\/section>/);
assert.ok(gate, 'gate section');
assert.doesNotMatch(gate[0], /how-floor-fine/, 'how-floor-fine not on gate');
assert.doesNotMatch(html, /Hosted when idle/, 'no lede fluff');

console.log('dasha-compute-how-floor-fine: PASS');
