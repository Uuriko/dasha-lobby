#!/usr/bin/env node
/** Quiet 24h settled metric + receipt — not gate hero, honest zero copy. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const html = readFileSync(new URL('./dasha-compute.html', import.meta.url), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html \u2194 page.mjs sync');

assert.match(html, /id=["']settled-24h["']/);
assert.match(html, /0 tok \u00b7 24h/);
assert.match(html, /id=["']answer-receipt["']/);
assert.match(html, /settled_24h/);
assert.match(html, /loadSettled24h/);
assert.match(html, /Settled \u00b7/);
assert.match(html, /paintAnswerReceipt/);

// Must not compete with Start. first paint
const gate = html.slice(html.indexOf('id="step-gate"'), html.indexOf('id="step-ask"'));
assert.doesNotMatch(gate, /settled-24h|0 tok \u00b7 24h|answer-receipt/);
assert.match(gate, /Start\./);

// No Darkbloom invent
assert.doesNotMatch(html, /16\.1B|16100000000|last_24h_total_tokens/);

console.log('dasha-compute-settled-ui: PASS');
