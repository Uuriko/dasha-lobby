#!/usr/bin/env node
/**
 * Source contract for live /price last-known on gecko/dex 429.
 * Worker ff78fb18-97c6-42c7-a921-31f98bd3421c already shipped hop DOWN.
 * 503 only when !priceCache.body (cold DO). PRICE_STALE_MS does not gate 503.
 * Last-known body stays 200 with stale:true / staleForMs / reason.
 * Never invent priceUsd. Disk only. No wrangler. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /const PRICE_STALE_MS = 10 \* 60_000/, 'PRICE_STALE_MS still defined');
assert.match(workerSrc, /const PRICE_STALE_MS = 10 \* 60_000; \/\/ not a \/price 503 gate/, 'PRICE_STALE_MS comment says not a 503 gate');

const handleAt = workerSrc.indexOf('async handlePrice(');
assert.ok(handleAt >= 0, 'handlePrice present');
const docAt = workerSrc.lastIndexOf('  /**', handleAt);
assert.ok(docAt >= 0 && handleAt - docAt < 800, 'handlePrice JSDoc present');
const nextAt = workerSrc.indexOf('\n  forumKey(', handleAt);
assert.ok(nextAt > handleAt, 'handlePrice bounded by forumKey');
const handlePrice = workerSrc.slice(docAt, nextAt);

assert.match(handlePrice, /Failure never invents a number/, 'never invents a number');
assert.match(handlePrice, /PRICE_STALE_MS does not gate 503/, 'doc: PRICE_STALE_MS does not gate 503');
assert.match(handlePrice, /503 only when !priceCache\.body \(cold DO\)/, 'doc: 503 only on cold DO');

const catchAt = handlePrice.indexOf('} catch (err) {');
assert.ok(catchAt >= 0, 'handlePrice has catch');
const catchBlock = handlePrice.slice(catchAt);
assert.match(catchBlock, /this\.priceError = String\(err\?\.message \|\| err\)\.slice\(0, 120\)/, 'catch records reason');
assert.match(
  catchBlock,
  /if \(!this\.priceCache\.body\) \{\s*return json\(\{ ok: false, error: 'price unavailable', reason: this\.priceError \}, 503/,
  '503 only when body missing',
);
assert.doesNotMatch(catchBlock, /PRICE_STALE_MS/, 'PRICE_STALE_MS does not appear in catch / 503 gate');
assert.doesNotMatch(
  catchBlock,
  /now - this\.priceCache\.at > PRICE_STALE_MS/,
  'old age gate that caused fleet-hunt P0 503 is gone',
);
assert.doesNotMatch(catchBlock, /priceUsd/, '503 path does not invent priceUsd');

const status503 = [...catchBlock.matchAll(/,\s*503\s*,/g)];
assert.equal(status503.length, 1, 'exactly one 503 return in handlePrice catch');
const only503 = catchBlock.slice(0, catchBlock.indexOf('503'));
assert.match(only503, /if \(!this\.priceCache\.body\)/, 'that 503 is gated by missing body');
assert.doesNotMatch(only503, /PRICE_STALE_MS/, 'PRICE_STALE_MS does not gate that 503');

assert.match(
  handlePrice,
  /stale:\s*true,\s*staleForMs:\s*age,\s*reason:\s*this\.priceError \|\| null/,
  'last-known body still marked stale:true / staleForMs / reason',
);
assert.match(handlePrice, /return json\(this\.priceCache\.body, 200/, 'last-known body serves 200');
assert.doesNotMatch(handlePrice, /priceUsd:\s*0(?:\.0+)?/, 'does not invent a zero priceUsd');

console.log('dasha-price-stale-no-503: PASS');
