#!/usr/bin/env node
/** Settled paid-inference receipts + 24h counters — honest zeros, replay-safe. */
import assert from 'node:assert/strict';
import {
  emptySettled24h,
  hourBucket,
  listReceiptsForOwner,
  publicSettled24h,
  recordSettledInference,
  sumSettled24h,
  tokensFromUsage,
} from './dasha-compute-settled.mjs';

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

assert.deepEqual(publicSettled24h(null), { tokens: 0, jobs: 0, cents: 0 });
assert.deepEqual(await sumSettled24h(storage), emptySettled24h());
assert.equal(tokensFromUsage({ prompt_tokens: 10, completion_tokens: 5 }), 15);
assert.equal(tokensFromUsage({ total_tokens: 40, prompt_tokens: 1 }), 40);

const now = Date.now();
const a = await recordSettledInference(storage, {
  owner: 'x:1',
  engine: 'community',
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  cents: 5,
  jobId: 'job_a',
  replayKey: 'job:job_a',
  now,
  idFactory: () => 'rcp_a',
});
assert.equal(a.ok, true);
assert.equal(a.replay, false);
assert.equal(a.receipt.tokens, 150);
assert.equal(a.receipt.cents, 5);

const replay = await recordSettledInference(storage, {
  owner: 'x:1',
  engine: 'community',
  usage: { total_tokens: 999 },
  cents: 99,
  jobId: 'job_a',
  replayKey: 'job:job_a',
  now,
  idFactory: () => 'rcp_dup',
});
assert.equal(replay.ok, true);
assert.equal(replay.replay, true);
assert.equal(replay.receipt.id, 'rcp_a');

const sum = await sumSettled24h(storage, now);
assert.deepEqual(sum, { tokens: 150, jobs: 1, cents: 5 });

await recordSettledInference(storage, {
  owner: 'x:1',
  engine: 'hosted',
  usage: { total_tokens: 20 },
  cents: 5,
  requestId: 'hosted_x',
  replayKey: 'hosted:hosted_x',
  now,
  idFactory: () => 'rcp_b',
});
const sum2 = await sumSettled24h(storage, now);
assert.deepEqual(sum2, { tokens: 170, jobs: 2, cents: 10 });

const listed = await listReceiptsForOwner(storage, 'x:1');
assert.equal(listed.length, 2);
assert.equal(listed[0].kind, 'paid-inference');

// Old hour outside 24h must not inflate.
const oldHour = hourBucket(now - 25 * 60 * 60_000);
await storage.put(`compute:settled-hour:${oldHour}`, { tokens: 9_999_999, jobs: 999, cents: 999 });
const sum3 = await sumSettled24h(storage, now);
assert.deepEqual(sum3, { tokens: 170, jobs: 2, cents: 10 }, 'must not invent Darkbloom volume from stale buckets');

const empty = await recordSettledInference(storage, {
  engine: 'hosted',
  usage: { total_tokens: 0 },
  cents: 0,
  replayKey: 'hosted:empty',
  now,
});
assert.equal(empty.ok, false);

console.log('dasha-compute-settled: PASS');
