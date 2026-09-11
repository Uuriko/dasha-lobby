#!/usr/bin/env node
/**
 * /compute/api/verify verifies the FULL retained heads log, not a 24h slice.
 * A windowed read breaks at the window's oldest head when it links backward
 * out of the window (live break at ts 1789060654753, 2026-09-10: retention
 * was intact - the predecessor sat one day outside the window). /heads keeps
 * serving the 24h display window unchanged. No wrangler. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import {
  appendChainedReceipt,
  appendHead,
  headsSigningKey,
  headsTip,
  makeHead,
} from './dasha-compute-heads.mjs';

const env = {
  LOBBY_SESSION_SECRET: 'full-log-verdict-secret',
  AI: { run: async () => ({ response: 'hosted-unused' }) },
  DASHA_HEADS_ED25519_SK: Buffer.from(new Uint8Array(32).fill(9)).toString('base64'),
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const key = await headsSigningKey(env);
const now = Date.now();
const DAY = 86400000;

// Five days of chained heads, starting GENESIS - the oldest four days fall
// outside listHeads' 3-day read range AND the 24h filter.
let prev = 'GENESIS';
for (let d = 5; d >= 0; d--) {
  for (const offset of [2 * 3600000, 3600000]) {
    const head = await makeHead(key, `tip-day-${d}-${offset}`, prev, now - d * DAY - offset);
    await appendHead(storage, head);
    prev = head.hash;
  }
}
// A chained receipt covered by a fresh head -> ANCHORABLE tip.
const receipt = await appendChainedReceipt(storage, key, { id: 'rcp_fulllog', job_id: 'job_fulllog', engine: 'community', tokens: 42, cents: 5, request_id: 'blk32-fulllog' }, now);
await appendHead(storage, await makeHead(key, receipt.hash, await headsTip(storage), now));

const res = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/verify'), origin);
assert.equal(res.status, 200);
const verdict = await res.json();
assert.equal(verdict.verdict.tier, 'ANCHORED', 'full-log verdict reaches ANCHORED across a deep history');
assert.match(verdict.verdict.why, /chain verifies/);

const found = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/verify?request_id=blk32-fulllog'), origin)).json();
assert.equal(found.found, true);
assert.equal(found.verdict.tier, 'ANCHORED');

// /heads display window unchanged: only the last 24h, not the deep history.
const headsRes = await network.fetch(new Request('https://lobby.getdasha.com/heads'), origin);
const windowHeads = await headsRes.json();
assert.ok(windowHeads.length >= 1, 'window non-empty');
assert.ok(windowHeads.every((h) => Number(h.ts) >= now - DAY), 'display window stays 24h');
assert.ok(windowHeads.length < 13, 'deep history not leaked into the display window');
