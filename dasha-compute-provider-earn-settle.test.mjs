#!/usr/bin/env node
/**
 * #337 fail-closed /compute/api/provider/payout/settle: the status gate must run
 * BEFORE any transfer, the pending → processing claim must be durable across the
 * send, and retries/crashes must complete idempotently without resending.
 */
import assert from 'node:assert/strict';
import {
  markProviderPayoutPaid,
  settleProviderPayout,
} from './dasha-compute-provider-earn.mjs';
import { base58Encode } from './dasha-faucet-solana.mjs';

const SIG_A = base58Encode(new Uint8Array(64).fill(7));
const SIG_B = base58Encode(new Uint8Array(64).fill(8));
const WALLET = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';

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

const seed = (id, over = {}) => rows.set(`compute:provider-payout:${id}`, {
  id, owner: 'x:1', status: 'pending', method: 'usdc',
  wallet: WALLET, usdc_cents: 100, payout_cents: 100, createdAt: 1, ...over,
});

const okAutoSend = (calls, sig = SIG_A, delayMs = 5) => async ({ destOwner, amountRaw }) => {
  calls.push({ destOwner, amountRaw });
  await new Promise((r) => setTimeout(r, delayMs));
  return { ok: true, signature: sig, solscan: `https://solscan.io/tx/${sig}` };
};

// --- 1. replay against an already-PAID payout sends NO transfer (the #337 hole) ---
seed('p_paid', { status: 'paid', signature: SIG_A, paidAt: 5 });
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_paid', autoSend: okAutoSend(calls) });
  assert.equal(res.ok, true, 'paid row, no sig supplied: idempotent replay');
  assert.equal(res.replay, true);
  assert.equal(calls.length, 0, 'no second transfer on paid replay');
}
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_paid', signature: SIG_A, autoSend: okAutoSend(calls) });
  assert.equal(res.ok, true);
  assert.equal(res.replay, true);
  assert.equal(calls.length, 0);
}
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_paid', signature: SIG_B, autoSend: okAutoSend(calls) });
  assert.equal(res.ok, false);
  assert.equal(res.status, 409);
  assert.match(res.error, /already paid/);
  assert.equal(calls.length, 0, 'conflicting sig on paid row: no transfer');
}

// --- 2. cancelled payout is never paid out ---
seed('p_cancel', { status: 'cancelled' });
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_cancel', autoSend: okAutoSend(calls) });
  assert.equal(res.ok, false);
  assert.equal(res.status, 409);
  assert.match(res.error, /cancelled/);
  assert.equal(calls.length, 0, 'cancelled payout: no transfer');
}

// --- 3. missing payout ---
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_missing', autoSend: okAutoSend(calls) });
  assert.equal(res.ok, false);
  assert.equal(res.status, 404);
  assert.equal(calls.length, 0);
}

// --- 4. pending + operator-supplied signature: mark paid, no Worker transfer ---
seed('p_opsig');
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_opsig', signature: SIG_A, now: 10_000, autoSend: okAutoSend(calls) });
  assert.equal(res.ok, true);
  assert.equal(res.replay, false);
  assert.equal(res.payout.status, 'paid');
  assert.equal(res.payout.signature, SIG_A);
  assert.equal(calls.length, 0, 'operator signature path never auto-sends');
}

// --- 5. pending + auto-send: one transfer, durable claim, paid with signature ---
seed('p_auto');
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_auto', now: 20_000, autoSend: okAutoSend(calls, SIG_A) });
  assert.equal(res.ok, true);
  assert.equal(res.payout.status, 'paid');
  assert.equal(res.payout.signature, SIG_A);
  assert.equal(res.auto.signature, SIG_A);
  assert.equal(calls.length, 1, 'exactly one transfer');
  assert.equal(calls[0].destOwner, WALLET);
  assert.ok(calls[0].amountRaw > 0n);
  // idempotent retry of the same request: no second transfer
  const again = await settleProviderPayout(storage, { payoutId: 'p_auto', autoSend: okAutoSend(calls, SIG_B) });
  assert.equal(again.ok, true);
  assert.equal(again.replay, true);
  assert.equal(calls.length, 1, 'retry after success does not resend');
}

// --- 6. concurrent settles on one pending payout: exactly one transfer ---
seed('p_race');
{
  const calls = [];
  const autoSend = okAutoSend(calls, SIG_A, 25);
  const [r1, r2] = await Promise.all([
    settleProviderPayout(storage, { payoutId: 'p_race', now: 30_000, autoSend }),
    settleProviderPayout(storage, { payoutId: 'p_race', now: 30_001, autoSend }),
  ]);
  assert.equal(calls.length, 1, 'concurrent settles: exactly one transfer');
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true, 'loser of the race sees the idempotent replay, not an error');
  assert.equal(r1.replay !== r2.replay, true, 'exactly one of the two is the original settle');
  assert.equal(rows.get('compute:provider-payout:p_race').status, 'paid');
}

// --- 7. crash recovery: processing WITH recorded signature completes without resend ---
seed('p_crash', { status: 'processing', signature: SIG_A, settleAttemptAt: 40_000 });
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_crash', now: 41_000, autoSend: okAutoSend(calls, SIG_B) });
  assert.equal(res.ok, true);
  assert.equal(res.payout.status, 'paid');
  assert.equal(res.payout.signature, SIG_A);
  assert.equal(res.auto.signature, SIG_A);
  assert.equal(calls.length, 0, 'recovery never resends the transfer');
}

// --- 8. processing WITHOUT signature: fail closed, no auto-resend ---
seed('p_stuck', { status: 'processing', signature: null, settleAttemptAt: 50_000 });
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_stuck', autoSend: okAutoSend(calls) });
  assert.equal(res.ok, false);
  assert.equal(res.status, 409);
  assert.match(res.error, /settlement in progress/);
  assert.equal(calls.length, 0, 'stuck claim never auto-resends');
  // operator verifies on-chain and POSTs the signature: records + completes
  const done = await settleProviderPayout(storage, { payoutId: 'p_stuck', signature: SIG_B, now: 51_000, autoSend: okAutoSend(calls) });
  assert.equal(done.ok, true);
  assert.equal(done.payout.status, 'paid');
  assert.equal(done.payout.signature, SIG_B);
  assert.equal(calls.length, 0);
}

// --- 9. auto-send failure: 502, claim kept, no auto-retry ---
seed('p_fail');
{
  let calls = 0;
  const failSend = async () => { calls += 1; return { ok: false, error: 'confirmation timeout', detail: 'rpc' }; };
  const res = await settleProviderPayout(storage, { payoutId: 'p_fail', autoSend: failSend });
  assert.equal(res.ok, false);
  assert.equal(res.status, 502);
  assert.equal(res.error, 'confirmation timeout');
  assert.equal(calls, 1);
  const row = rows.get('compute:provider-payout:p_fail');
  assert.equal(row.status, 'processing', 'failed send keeps the durable claim');
  assert.equal(row.settleError, 'confirmation timeout');
  const retry = await settleProviderPayout(storage, { payoutId: 'p_fail', autoSend: failSend });
  assert.equal(retry.status, 409, 'retry does not auto-resend after a failed send');
  assert.equal(calls, 1, 'still exactly one attempted transfer');
}

// --- 10. no autoSend wired: signature required, method echoed for the hint ---
seed('p_noauto_usdc');
seed('p_noauto_dasha', { method: 'dasha' });
{
  const usdc = await settleProviderPayout(storage, { payoutId: 'p_noauto_usdc' });
  assert.equal(usdc.ok, false);
  assert.equal(usdc.status, 400);
  assert.equal(usdc.error, 'signature required');
  assert.equal(usdc.method, 'usdc');
  const dasha = await settleProviderPayout(storage, { payoutId: 'p_noauto_dasha' });
  assert.equal(dasha.method, 'dasha');
}

// --- 11. invalid amount never reaches the transfer ---
seed('p_zero', { usdc_cents: 0, payout_cents: 0 });
{
  const calls = [];
  const res = await settleProviderPayout(storage, { payoutId: 'p_zero', autoSend: okAutoSend(calls) });
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
  assert.equal(res.error, 'invalid amount');
  assert.equal(calls.length, 0);
}

// --- 12. input validation ---
{
  const res = await settleProviderPayout(storage, { payoutId: ' ' });
  assert.equal(res.status, 400);
  const bad = await settleProviderPayout(storage, { payoutId: 'p_auto', signature: 'not-a-sig' });
  assert.equal(bad.status, 400);
  assert.equal(bad.error, 'invalid signature');
}

// --- 13. markProviderPayoutPaid: processing completes only for its recorded sig ---
seed('p_mark_processing', { status: 'processing', signature: SIG_A });
{
  const wrong = await markProviderPayoutPaid(storage, { payoutId: 'p_mark_processing', signature: SIG_B });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.status, 409);
  assert.match(wrong.error, /settlement in progress/);
  const right = await markProviderPayoutPaid(storage, { payoutId: 'p_mark_processing', signature: SIG_A, now: 60_000 });
  assert.equal(right.ok, true);
  assert.equal(right.payout.status, 'paid');
  assert.equal(right.payout.paidAt, 60_000);
}

console.log('dasha-compute-provider-earn-settle: all assertions passed');
