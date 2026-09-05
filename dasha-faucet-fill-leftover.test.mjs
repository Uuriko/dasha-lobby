#!/usr/bin/env node
/**
 * Leftover after faucet fill-share DRY: Worker still paints class="leftover"
 * on live /faucet/fill/:sig (Solscan short-link). Crawlers see it in view-source.
 * Sig link + Get 100 + Buy stay. Disk only. No static-gen. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fillShareHtml } from './dasha-faucet-tape.mjs';

const src = readFileSync(new URL('./dasha-faucet-tape.mjs', import.meta.url), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const GOOD_SIG = '1'.repeat(64);

assert.doesNotMatch(src, /leftover/, 'tape source must not name leftover');
assert.doesNotMatch(src, /plugin\.jup\.ag/);

const html = fillShareHtml({ sig: GOOD_SIG, amountUi: 1000, at: Date.now(), from: 'So11111111111111111111111111111111111111112' });
assert.doesNotMatch(html, /leftover/, 'fill HTML must not serialize leftover');
assert.match(html, /<p class="sig">/, 'sig short-link stays');
assert.match(html, new RegExp(`solscan\\.io/tx/${GOOD_SIG}`));
assert.match(html, /href="\/faucet">Get 100</);
assert.match(html, />Buy</);
assert.match(html, new RegExp(`jup\\.ag/tokens/${MINT}`));
assert.doesNotMatch(html, /plugin\.jup\.ag/);

console.log('dasha-faucet-fill-leftover: PASS (no leftover class; sig link stays)');
