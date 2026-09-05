#!/usr/bin/env node
/** Copy curl must copy or select. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML);
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
assert.match(script, /function copy\(/);
assert.match(script, /execCommand\('copy'\)/);
assert.match(script, /Promise\.race/);
assert.match(script, /selectNodeContents/);
assert.match(html, /Copy curl|data-copy=["']code["']/);
assert.match(html, /Copy AI skill/);
assert.match(html, /const PROVIDE_SKILL=/);
assert.match(html, /const USE_SKILL=/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);
console.log('dasha-compute-copy: PASS');
