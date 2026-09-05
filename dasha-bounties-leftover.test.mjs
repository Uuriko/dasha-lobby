#!/usr/bin/env node
/** /bounties leftover OG vs first paint. Honest: USDC on Solana. We don’t hold it. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(worker, /plugin\.jup\.ag/);
assert.doesNotMatch(worker, /Open \$dasha contribution bounties/);
assert.match(worker, /description: 'USDC on Solana\. We don’t hold it\.'/);

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/bounties'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'bounties');
const body = await res.text();
assert.match(body, /og:description" content="USDC on Solana\. We don’t hold it\."/);
assert.match(body, /twitter:description" content="USDC on Solana\. We don’t hold it\."/);
assert.match(body, /name="description" content="USDC on Solana\. We don’t hold it\."/);
assert.match(body, /<p>USDC on Solana\. We don’t hold it\.<\/p>/);
assert.doesNotMatch(body, /Open \$dasha contribution bounties/);
assert.doesNotMatch(body, /plugin\.jup\.ag/);
assert.match(body, /No funded bounties right now\./);
assert.match(body, /oauth\/x|id=["']bb-x/, 'site-hunt X-connect: oauth/x or #bb-x (x-connect.js alone does not count)');
assert.match(body, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'GitHub required stays');
assert.doesNotMatch(body, /Simp Points/);
assert.doesNotMatch(body, /need no wallet, holder status/);

const json = await edgeWorker.fetch(new Request('https://www.getdasha.com/bounties.json'), {});
assert.equal(json.status, 200);
const feed = await json.json();
assert.equal(feed.schema, 'dasha-bounties-feed/v1');
assert.match(feed.note, /We don.t hold it/);

console.log('dasha-bounties-leftover: PASS (OG matches first paint, no Simp gate lecture)');
