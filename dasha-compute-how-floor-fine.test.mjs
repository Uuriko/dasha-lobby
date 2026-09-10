#!/usr/bin/env node
/** Quiet How engines line: idle Hosted floor; Community-selected live paint is Community-honest. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs');

const re = /id=["']how-floor-fine["'][^>]*>Local Macs \+ Hosted floor\./;
assert.match(html, re, 'how-floor-fine idle copy');
assert.match(
  html,
  /id=["']step-how["'][\s\S]*?id=["']how-floor-fine["'][\s\S]*?<\/section>/,
  'how-floor-fine inside step-how',
);
const gate = html.match(/id=["']step-gate["'][\s\S]*?<\/section>/);
assert.ok(gate, 'gate section');
assert.doesNotMatch(gate[0], /how-floor-fine/, 'how-floor-fine not on gate');
assert.doesNotMatch(html, /Hosted when idle/, 'no lede fluff');
assert.match(html, /function howFloorFineText\(/, 'howFloorFineText builder');
assert.match(html, /el\.textContent=howFloorFineText\(/, 'paintHowFloorFine uses builder');

const src = html.match(/function howFloorFineText\([^)]*\)\{[\s\S]*?\n\}/);
assert.ok(src, 'extract howFloorFineText');
const howFloorFineText = new Function(`${src[0]}; return howFloorFineText;`)();

assert.equal(howFloorFineText(0, 'hosted', '', ''), 'Local Macs + Hosted floor.');
assert.equal(howFloorFineText(0, 'community', '', ''), 'Local Macs + Hosted floor.');

const hostedLive = howFloorFineText(1, 'hosted', 'gemma3-27b', '12');
assert.equal(hostedLive, '1 · gemma3-27b · 12 tok/s · Hosted floor.');
assert.match(hostedLive, /Hosted floor\./);

const communityLive = howFloorFineText(1, 'community', 'gemma3-27b', '12');
assert.equal(communityLive, '1 · gemma3-27b · 12 tok/s · Community settle.');
assert.doesNotMatch(communityLive, /Hosted floor/);
assert.match(communityLive, /Community settle\./);

const communityMacs = howFloorFineText(1, 'community', '', '');
assert.equal(communityMacs, '1 Mac online · Community settle.');
assert.doesNotMatch(communityMacs, /Hosted floor/);

const mixtureLive = howFloorFineText(2, 'mixture', 'qwen3-8b', '42.5');
assert.equal(mixtureLive, '2 · qwen3-8b · 42.5 tok/s · Community settle.');
assert.doesNotMatch(mixtureLive, /Hosted floor/);

console.log('dasha-compute-how-floor-fine: PASS');
