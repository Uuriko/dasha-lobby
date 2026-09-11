#!/usr/bin/env node
/**
 * Block 32 receipt verifiability: a buyer can find and independently verify
 * their own receipt. chat/completions returns job_id (+ receipt); a
 * buyer-supplied request_id rides the job onto the signed chain row;
 * /compute/api/verify returns a machine-readable verdict and finds receipts
 * by hash, job_id, or request_id. llms.txt publishes the preimage format.
 * No wrangler. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COMPUTE_LLMS_TXT } from './dasha-compute-agent.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /\/compute\/api\/verify/);
assert.match(src, /anchoredVerdict/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);
assert.doesNotMatch(src, /potter[_-]?key|DASHA_POTTER|people-data/i);

// Doc pin: llms.txt publishes the hash preimage format (Block 32 item 1).
assert.match(COMPUTE_LLMS_TXT, /sha256\(JSON\.stringify\(body\)\)/);
assert.match(COMPUTE_LLMS_TXT, /prev_hash/);
assert.match(COMPUTE_LLMS_TXT, /GENESIS/);
assert.match(COMPUTE_LLMS_TXT, /ed25519/);
assert.match(COMPUTE_LLMS_TXT, /\/compute\/api\/verify\?hash=/);
assert.match(COMPUTE_LLMS_TXT, /request_id/);

const env = {
  LOBBY_SESSION_SECRET: 'receipt-verify-secret',
  AI: { run: async () => ({ response: 'hosted-unused' }) },
  DASHA_HEADS_ED25519_SK: Buffer.from(new Uint8Array(32).fill(7)).toString('base64'),
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
const session = await createSessionToken(env, { xId: 'rcp-verify', handle: 'rcp_verify' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Verify Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201, await reg.clone().text());
const creds = await reg.json();
const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: creds.provider_id, name: 'Verify Mac', models: ['qwen3-8b'] };
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin)).status, 204);

const keyCreated = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'rcp-verify', limit_cents: null, limit_reset: 'none' }),
}), origin);
assert.equal(keyCreated.status, 201, await keyCreated.clone().text());
const developerKey = await keyCreated.json();
await storage.put('compute:credit-balance:x:rcp-verify', { owner: 'x:rcp-verify', cents: 1000, updatedAt: Date.now() });
const apiHeaders = { Authorization: `Bearer ${developerKey.api_key}`, 'Content-Type': 'application/json' };

const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: apiHeaders,
  body: JSON.stringify({ model: 'qwen3-8b', request_id: 'blk32-probe-1', messages: [{ role: 'user', content: 'verifiable?' }] }),
}));
await new Promise((r) => setTimeout(r, 0));
let poll, job;
for (let attempt = 0; attempt < 40; attempt++) {
  poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
  }), origin);
  if (poll.status === 200) break;
  await new Promise((r) => setTimeout(r, 5));
}
assert.equal(poll.status, 200, 'provider leased the job');
job = (await poll.json()).job;
assert.equal(rows.get(`compute:job:${job.id}`)?.request_id, 'blk32-probe-1', 'stored job carries the buyer request_id');
assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/result`, {
  method: 'POST', headers: providerHeaders,
  body: JSON.stringify({ provider_id: creds.provider_id, content: 'verifiable ok', usage: { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 } }),
}), origin)).status, 202);
const res = await pending;
assert.equal(res.status, 200);
const completion = await res.json();
assert.equal(completion.job_id, job.id, 'completion returns job_id (Block 32 item 2)');
assert.equal(completion.request_id, 'blk32-probe-1', 'completion echoes request_id');
assert.equal(completion.receipt?.job_id, job.id, 'completion carries the receipt');
assert.equal(completion.receipt?.request_id, 'blk32-probe-1');
assert.equal('dasha' in completion, false, 'OpenAI-compat body: no dasha extension key');

const chainRes = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/chain'), origin);
const chain = await chainRes.json();
const row = chain.receipts.find((r) => r.job_id === job.id);
assert.ok(row, 'settle joined the signed chain');
assert.equal(row.request_id, 'blk32-probe-1', 'chain row carries request_id (Block 32 item 2)');
assert.ok(row.hash && row.sig && row.signer, 'chain row signed');

for (const q of [`hash=${row.hash}`, `job_id=${job.id}`, 'request_id=blk32-probe-1']) {
  const vres = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/verify?${q}`), origin);
  assert.equal(vres.status, 200, q);
  const verdict = await vres.json();
  assert.equal(verdict.schema, 'settled.verify.v0');
  assert.equal(verdict.verdict.tier, 'ANCHORED', `${q}: fresh settle covered by a head`);
  assert.equal(verdict.found, true, `${q}: receipt found`);
  assert.equal(verdict.receipt.hash, row.hash);
}
const bare = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/verify'), origin)).json();
assert.equal(bare.verdict.tier, 'ANCHORED');
assert.ok(bare.chain.length >= 1);
assert.equal(bare.found, undefined, 'no query, no found flag');
