#!/usr/bin/env node
/** Provider earnings routes against in-memory ComputeNetwork. */
import assert from 'node:assert/strict';
import { ComputeNetwork, computeApi } from './dasha-compute-network.mjs';
import { readFileSync } from 'node:fs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';
import { PROVIDER_PAYOUT_MODE, autoSendUsdcEnabled } from './dasha-compute-provider-earn.mjs';
import { base58Encode } from './dasha-faucet-solana.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-provider-earn-routes-secret',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: '42', handle: 'earn_user' });
const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const unauth = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/earnings'), origin);
assert.equal(unauth.status, 401);
const unauthBody = await unauth.json();
assert.equal(unauthBody.error, 'login required');
assert.equal(unauthBody.payout_mode, PROVIDER_PAYOUT_MODE);

const empty = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/earnings', {
  headers: { Cookie: headers.Cookie, Origin: origin },
}), origin);
assert.equal(empty.status, 200);
const emptyBody = await empty.json();
assert.equal(emptyBody.total_usdc_cents, 0);
assert.equal(emptyBody.total_jobs, 0);
assert.equal(emptyBody.payout_mode, 'pending');
assert.deepEqual(emptyBody.providers, []);

// Register provider via storage (skip full register rate/body)
await storage.put('compute:provider:mac_earn1', {
  id: 'mac_earn1', owner: 'x:42', name: 'Earn Mac', allowedModels: ['qwen3-8b'], models: ['qwen3-8b'],
  tokenHash: 'x', createdAt: 1, lastSeenAt: 1,
});
await storage.put('compute:provider-earn:mac_earn1', {
  usdc_cents: 150, jobs: 40, completion_tokens: 5000, updatedAt: 1,
});

const bal = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/earnings', {
  headers: { Cookie: headers.Cookie, Origin: origin },
}), origin);
assert.equal(bal.status, 200);
const balBody = await bal.json();
assert.equal(balBody.total_usdc_cents, 150);
assert.equal(balBody.total_dasha_cents, 165);
assert.equal(balBody.providers[0].id, 'mac_earn1');

const badPref = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payout-pref', {
  method: 'POST', headers, body: JSON.stringify({ method: 'usdc', wallet: 'nope' }),
}), origin);
assert.equal(badPref.status, 400);

const wallet = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
const pref = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payout-pref', {
  method: 'POST', headers, body: JSON.stringify({ method: 'dasha', wallet }),
}), origin);
assert.equal(pref.status, 200);
const prefBody = await pref.json();
assert.equal(prefBody.method, 'dasha');
assert.equal(prefBody.wallet, wallet);
assert.equal(prefBody.payout_mode, 'pending');

const payout = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payout', {
  method: 'POST', headers, body: JSON.stringify({ method: 'dasha', wallet }),
}), origin);
assert.equal(payout.status, 201, await payout.clone().text());
const payBody = await payout.json();
assert.equal(payBody.status, 'pending');
assert.equal(payBody.usdc_cents, 150);
assert.equal(payBody.payout_cents, 165);
assert.equal(payBody.payout_mode, 'pending');
assert.match(payBody.note, /does not auto-chain-send/);

const after = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/earnings', {
  headers: { Cookie: headers.Cookie, Origin: origin },
}), origin);
const afterBody = await after.json();
assert.equal(afterBody.total_usdc_cents, 0);
assert.equal(afterBody.pending.length, 1);
assert.equal(afterBody.pending[0].status, 'pending');

// Accrue via job complete path
const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers, body: JSON.stringify({ name: 'Live Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201, await reg.clone().text());
const regBody = await reg.json();
const providerId = regBody.provider_id;
const providerToken = regBody.provider_token;

// Seed a leased job and complete it
const jobId = 'job_earn_live';
await storage.put(`compute:job:${jobId}`, {
  id: jobId, owner: 'x:99', model: 'qwen3-8b', route: 'community', stream: false,
  status: 'leased', providerId, leaseExpiresAt: Date.now() + 60_000, expiresAt: Date.now() + 120_000,
  createdAt: Date.now(), messages: null,
});
const done = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${jobId}/result`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${providerToken}` },
  body: JSON.stringify({ provider_id: providerId, content: 'hello from mac', usage: { completion_tokens: 1000, prompt_tokens: 10, total_tokens: 1010 } }),
}), origin);
assert.equal(done.status, 202, await done.clone().text());
const earnRow = await storage.get(`compute:provider-earn:${providerId}`);
assert.equal(earnRow.usdc_cents, 6);
assert.equal(earnRow.jobs, 1);

// Replay: complete again should 409 (not leased) — seed another job and double-complete via accrue already tested
const jobId2 = 'job_earn_replay';
await storage.put(`compute:job:${jobId2}`, {
  id: jobId2, owner: 'x:99', model: 'qwen3-8b', route: 'community', stream: false,
  status: 'leased', providerId, leaseExpiresAt: Date.now() + 60_000, expiresAt: Date.now() + 120_000,
  createdAt: Date.now(), messages: null,
});
const done2 = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${jobId2}/result`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${providerToken}` },
  body: JSON.stringify({ provider_id: providerId, content: 'again', usage: { completion_tokens: 0 } }),
}), origin);
assert.equal(done2.status, 202);
assert.equal((await storage.get(`compute:provider-earn:${providerId}`)).usdc_cents, 11);

// Manual second accrue same jobId via storage replay key already set
const { accrueProviderEarn } = await import('./dasha-compute-provider-earn.mjs');
const replay = await accrueProviderEarn(storage, { providerId, jobId: jobId2, usage: { completion_tokens: 9999 }, now: Date.now() });
assert.equal(replay.replay, true);
assert.equal((await storage.get(`compute:provider-earn:${providerId}`)).usdc_cents, 11);

// computeApi whitelist must forward /compute/api/provider/*
const netSrc = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(netSrc, /path\.startsWith\('\/compute\/api\/provider\/'\)/);

// --- operator settle (secret gate; mark-paid; no auto-send by default) ---
// Clear prior pending rows from this suite so settle list counts are deterministic
for (const key of [...rows.keys()].filter((k) => k.startsWith('compute:provider-payout:') && !k.includes('pref'))) {
  await storage.delete(key);
}

assert.equal(autoSendUsdcEnabled(env), false, 'auto-send off without COMPUTE_PAYOUT_KEYPAIR');

const noSecret = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payouts/pending'), origin);
assert.equal(noSecret.status, 503);
assert.equal((await noSecret.json()).error, 'not configured');

env.COMPUTE_PAYOUT_SECRET = 'ops-payout-secret';

const badAuth = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payouts/pending', {
  headers: { Authorization: 'Bearer wrong' },
}), origin);
assert.equal(badAuth.status, 401);

const listEmpty = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payouts/pending', {
  headers: { 'x-dasha-payout-secret': 'ops-payout-secret' },
}), origin);
assert.equal(listEmpty.status, 200, await listEmpty.clone().text());
const listEmptyBody = await listEmpty.json();
assert.equal(listEmptyBody.count, 0);
assert.equal(listEmptyBody.auto_send, false);
assert.equal(listEmptyBody.payout_mode, 'pending');

// Seed a pending USDC payout for settle
const settleId = 'payout_settle1';
const settleWallet = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
await storage.put(`compute:provider-payout:${settleId}`, {
  id: settleId, owner: 'x:42', status: 'pending', method: 'usdc', wallet: settleWallet,
  usdc_cents: 150, payout_cents: 150, createdAt: Date.now(), updatedAt: Date.now(),
  note: 'pending — operator/treasury settle; Worker does not auto-chain-send',
});

const listOne = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payouts/pending', {
  headers: { Authorization: 'Bearer ops-payout-secret' },
}), origin);
assert.equal(listOne.status, 200);
const listOneBody = await listOne.json();
assert.equal(listOneBody.count, 1);
assert.equal(listOneBody.payouts[0].id, settleId);
assert.equal(listOneBody.payouts[0].owner, 'x:42');
assert.equal(listOneBody.payouts[0].usdc_cents, 150);

const FAKE_SIG = base58Encode(new Uint8Array(64).fill(9));

const settleNoSig = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payout/settle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-dasha-payout-secret': 'ops-payout-secret' },
  body: JSON.stringify({ payout_id: settleId }),
}), origin);
assert.equal(settleNoSig.status, 400);
assert.match((await settleNoSig.json()).error, /signature required/);

const settle = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payout/settle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ops-payout-secret' },
  body: JSON.stringify({ payout_id: settleId, signature: FAKE_SIG }),
}), origin);
assert.equal(settle.status, 200, await settle.clone().text());
const settleBody = await settle.json();
assert.equal(settleBody.status, 'paid');
assert.equal(settleBody.signature, FAKE_SIG);
assert.equal(settleBody.auto_send, false);
assert.match(settleBody.solscan, /solscan\.io\/tx\//);
assert.equal((await storage.get(`compute:provider-payout:${settleId}`)).status, 'paid');

const settleReplay = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payout/settle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ops-payout-secret' },
  body: JSON.stringify({ payout_id: settleId, signature: FAKE_SIG }),
}), origin);
assert.equal(settleReplay.status, 200);
assert.equal((await settleReplay.json()).replay, true);

const listAfter = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/payouts/pending', {
  headers: { Authorization: 'Bearer ops-payout-secret' },
}), origin);
assert.equal((await listAfter.json()).count, 0);

// Earnings UI path shows paid + solscan for owner
const earnPaid = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/provider/earnings', {
  headers: { Cookie: headers.Cookie, Origin: origin },
}), origin);
assert.equal(earnPaid.status, 200);
const earnPaidBody = await earnPaid.json();
const paidRow = (earnPaidBody.pending || []).find((r) => r.id === settleId);
assert.ok(paidRow, 'paid row visible on earnings');
assert.equal(paidRow.status, 'paid');
assert.equal(paidRow.signature, FAKE_SIG);
assert.match(paidRow.solscan, /solscan/);

console.log('dasha-compute-provider-earn-routes.test.mjs: ok');
