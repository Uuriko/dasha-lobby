#!/usr/bin/env node
/** Provider earn math, replay, pref, pending payout, mark paid. */
import assert from 'node:assert/strict';
import {
  PROVIDER_JOB_CENTS,
  PROVIDER_TOKEN_CENTS_PER_1K,
  PROVIDER_MIN_PAYOUT_CENTS,
  PROVIDER_PAYOUT_MODE,
  accrueProviderEarn,
  autoSendUsdcEnabled,
  computePayoutKeypair,
  createPendingPayout,
  dashaPayoutCents,
  earnCentsForJob,
  earningsCatalog,
  isValidSolanaTxSignature,
  listPendingProviderPayouts,
  markProviderPayoutPaid,
  normalizePayoutPref,
  payoutAmounts,
  payoutSecretOk,
  usdcRawFromCents,
} from './dasha-compute-provider-earn.mjs';
import { base58Encode } from './dasha-faucet-solana.mjs';

assert.equal(PROVIDER_JOB_CENTS, 5);
assert.equal(PROVIDER_TOKEN_CENTS_PER_1K, 1);
assert.equal(PROVIDER_MIN_PAYOUT_CENTS, 100);
assert.equal(PROVIDER_PAYOUT_MODE, 'pending');

assert.equal(earnCentsForJob({ completion_tokens: 0 }), 5);
assert.equal(earnCentsForJob({ completion_tokens: 999 }), 5);
assert.equal(earnCentsForJob({ completion_tokens: 1000 }), 6);
assert.equal(earnCentsForJob({ completion_tokens: 2500 }), 7);
assert.equal(earnCentsForJob(null), 5);
assert.equal(dashaPayoutCents(100), 110);
assert.equal(dashaPayoutCents(2), 2);
assert.deepEqual(payoutAmounts(100, 'usdc'), { method: 'usdc', usdc_cents: 100, payout_cents: 100 });
assert.deepEqual(payoutAmounts(100, 'dasha'), { method: 'dasha', usdc_cents: 100, payout_cents: 110 });

assert.equal(normalizePayoutPref({ method: 'usdc', wallet: 'not-valid' }).ok, false);
assert.equal(normalizePayoutPref({ method: 'btc', wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN' }).ok, false);
const okPref = normalizePayoutPref({ method: 'dasha', wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN' });
assert.equal(okPref.ok, true);
assert.equal(okPref.method, 'dasha');

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

const a1 = await accrueProviderEarn(storage, {
  providerId: 'mac_test1',
  jobId: 'job_abc',
  usage: { completion_tokens: 1500 },
  now: 1_000,
});
assert.equal(a1.ok, true);
assert.equal(a1.replay, false);
assert.equal(a1.usdc_cents, 6); // 5 + floor(1500/1000)
assert.equal(a1.balance.usdc_cents, 6);
assert.equal(a1.balance.jobs, 1);
assert.equal(a1.balance.completion_tokens, 1500);

const a2 = await accrueProviderEarn(storage, {
  providerId: 'mac_test1',
  jobId: 'job_abc',
  usage: { completion_tokens: 9999 },
  now: 2_000,
});
assert.equal(a2.replay, true);
assert.equal(a2.usdc_cents, 6);
assert.equal((await storage.get('compute:provider-earn:mac_test1')).usdc_cents, 6);

const a3 = await accrueProviderEarn(storage, {
  providerId: 'mac_test1',
  jobId: 'job_def',
  usage: { completion_tokens: 0 },
  now: 3_000,
});
assert.equal(a3.replay, false);
assert.equal(a3.usdc_cents, 5);
assert.equal((await storage.get('compute:provider-earn:mac_test1')).usdc_cents, 11);
assert.equal((await storage.get('compute:provider-earn:mac_test1')).jobs, 2);

const cat = earningsCatalog({
  providers: [{ id: 'mac_test1', name: 'My Mac', usdc_cents: 5, jobs: 2, completion_tokens: 1500 }],
  pref: { method: 'usdc', wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN' },
  pending: [],
});
assert.equal(cat.total_usdc_cents, 5);
assert.equal(cat.total_dasha_cents, 5);
assert.equal(cat.payout_mode, 'pending');
assert.equal(cat.rates.job_cents, 5);

await storage.put('compute:provider:mac_test1', { id: 'mac_test1', owner: 'x:1', name: 'My Mac' });
// under min
const low = await createPendingPayout(storage, {
  owner: 'x:1',
  method: 'usdc',
  wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN',
  now: 4_000,
});
assert.equal(low.ok, false);
assert.match(low.error, /min payout/);

// pad balance to $1+
await storage.put('compute:provider-earn:mac_test1', { usdc_cents: 100, jobs: 50, completion_tokens: 0, updatedAt: 4_000 });
const pay = await createPendingPayout(storage, {
  owner: 'x:1',
  method: 'dasha',
  wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN',
  now: 5_000,
  idFactory: () => 'payout_test1',
});
assert.equal(pay.ok, true);
assert.equal(pay.payout.status, 'pending');
assert.equal(pay.payout.usdc_cents, 100);
assert.equal(pay.payout.payout_cents, 110);
assert.equal(pay.payout.method, 'dasha');
assert.match(pay.payout.note, /does not auto-chain-send/);
assert.equal((await storage.get('compute:provider-earn:mac_test1')).usdc_cents, 0);
assert.equal((await storage.get('compute:provider-payout:payout_test1')).status, 'pending');
assert.equal((await storage.get('compute:provider-payout-pref:x:1')).method, 'dasha');

assert.equal(usdcRawFromCents(100), 1_000_000);
assert.equal(usdcRawFromCents(1), 10_000);
assert.equal(usdcRawFromCents(0), 0);

const FAKE_SIG = base58Encode(new Uint8Array(64).fill(7));
const FAKE_SIG2 = base58Encode(new Uint8Array(64).fill(8));
assert.equal(isValidSolanaTxSignature(FAKE_SIG), true);
assert.equal(isValidSolanaTxSignature('short'), false);
assert.equal(isValidSolanaTxSignature('!!!'), false);

assert.equal(payoutSecretOk({}, 'x'), false);
assert.equal(payoutSecretOk({ COMPUTE_PAYOUT_SECRET: 'sekrit' }, 'wrong'), false);
assert.equal(payoutSecretOk({ COMPUTE_PAYOUT_SECRET: 'sekrit' }, 'sekrit'), true);
assert.equal(autoSendUsdcEnabled({}), false);
assert.equal(autoSendUsdcEnabled({ COMPUTE_PAYOUT_KEYPAIR: '[1,2]' }), true);
assert.equal(computePayoutKeypair({ FAUCET_KEYPAIR: 'nope' }), '');

const missing = await markProviderPayoutPaid(storage, { payoutId: 'nope', signature: FAKE_SIG });
assert.equal(missing.ok, false);
assert.equal(missing.status, 404);

const mark = await markProviderPayoutPaid(storage, {
  payoutId: 'payout_test1',
  signature: FAKE_SIG,
  now: 6_000,
  note: 'ops settle',
});
assert.equal(mark.ok, true);
assert.equal(mark.replay, false);
assert.equal(mark.payout.status, 'paid');
assert.equal(mark.payout.signature, FAKE_SIG);
assert.equal(mark.payout.paidAt, 6_000);

const replay = await markProviderPayoutPaid(storage, {
  payoutId: 'payout_test1',
  signature: FAKE_SIG,
  now: 7_000,
});
assert.equal(replay.ok, true);
assert.equal(replay.replay, true);

const clash = await markProviderPayoutPaid(storage, {
  payoutId: 'payout_test1',
  signature: FAKE_SIG2,
});
assert.equal(clash.ok, false);
assert.equal(clash.status, 409);
assert.match(clash.error, /already paid/);

await storage.put('compute:provider-payout:payout_cancel', {
  id: 'payout_cancel', owner: 'x:1', status: 'cancelled', method: 'usdc',
  wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN', usdc_cents: 100, payout_cents: 100, createdAt: 1,
});
const cancelled = await markProviderPayoutPaid(storage, { payoutId: 'payout_cancel', signature: FAKE_SIG });
assert.equal(cancelled.ok, false);
assert.match(cancelled.error, /cancelled/);

await storage.put('compute:provider-payout:payout_pend2', {
  id: 'payout_pend2', owner: 'x:2', status: 'pending', method: 'usdc',
  wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN', usdc_cents: 200, payout_cents: 200, createdAt: 2,
});
const listed = await listPendingProviderPayouts(storage);
assert.equal(listed.length, 1);
assert.equal(listed[0].id, 'payout_pend2');
assert.equal(listed[0].usdc_cents, 200);

const catPaid = earningsCatalog({
  providers: [],
  pending: [mark.payout],
});
assert.equal(catPaid.pending[0].status, 'paid');
assert.equal(catPaid.pending[0].signature, FAKE_SIG);
assert.match(catPaid.pending[0].solscan, /solscan\.io\/tx\//);

console.log('dasha-compute-provider-earn.test.mjs: ok');
