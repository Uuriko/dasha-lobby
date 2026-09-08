#!/usr/bin/env node
/** Task 24 receipts showcase: chain rows carry model + latency_ms (unsigned extras),
 *  signed body unchanged, public chain feed stays anonymized (no owner/request_id prompts). */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordSettledInference, publicReceipt } from './dasha-compute-settled.mjs';
import { appendChainedReceipt, canonicalReceiptBody, headsSigningKey, listChain, verifyChain } from './dasha-compute-heads.mjs';

const root = dirname(fileURLToPath(import.meta.url));

const store = new Map();
const storage = {
  get: async (k) => store.get(k),
  put: async (k, v) => { store.set(k, v); },
  list: async ({ prefix } = {}) => [...store.entries()].filter(([k]) => k.startsWith(prefix)),
};

const res = await recordSettledInference(storage, {
  owner: 'user_secret', engine: 'community', tokens: 321, cents: 7,
  jobId: 'job_abc', replayKey: 'job:job_abc', model: 'gemma3-27b', latencyMs: 4123.7, now: 1788900000000,
});
assert.equal(res.ok, true);
assert.equal(res.receipt.model, 'gemma3-27b');
assert.equal(res.receipt.latency_ms, 4123, 'latency floored to ms');
const pub = publicReceipt(res.receipt);
assert.equal(pub.model, 'gemma3-27b');
assert.equal(pub.latency_ms, 4123);
assert.equal('owner' in pub, false, 'publicReceipt never exposes owner');

const env = { DASHA_HEADS_ED25519_SK: Buffer.from(new Uint8Array(32).fill(7)).toString('base64') };
const key = await headsSigningKey(env);
const row = await appendChainedReceipt(storage, key, res.receipt);
assert.equal(row.model, 'gemma3-27b');
assert.equal(row.latency_ms, 4123);
assert.deepEqual(Object.keys(canonicalReceiptBody(row)), ['job_id', 'engine', 'tokens', 'cents', 'at', 'prev_hash'], 'signed body shape unchanged');
const chain = await listChain(storage);
const v = await verifyChain(chain, { [key.signer]: key.pubPem });
assert.equal(v.ok, true, 'chain still verifies with display fields present');

const net = await readFile(join(root, 'dasha-compute-network.mjs'), 'utf8');
assert.match(net, /job\.leasedAt = now;/, 'lease timestamp recorded');
assert.equal((net.match(/model: job\.model,\s*\n\s*latencyMs: job\.leasedAt \? now - job\.leasedAt : null,/g) || []).length, 2, 'both job settle paths pass model + latency');
assert.match(net, /model: 'gpt-oss-20b',/, 'hosted settle names its model');

const client = await readFile(join(root, 'verify-page-src/client.mjs'), 'utf8');
assert.match(client, /r\.model/, 'verify index shows model');
assert.match(client, /latency_ms/, 'verify index shows latency');
const page = await readFile(join(root, 'dasha-verify-page.mjs'), 'utf8');
assert.match(page, /latency_ms/, 'generated verify page carries the fields');

console.log('dasha-compute-receipts-showcase: PASS');
