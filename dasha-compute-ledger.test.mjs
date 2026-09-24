#!/usr/bin/env node
/** Receipt-economics private ledger: row shapes, wire-ins, export endpoint. */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';
import {
  LEDGER_EVENT_PREFIX, LEDGER_POH_PREFIX,
  buildLedgerPayoutRow, buildLedgerSettledRow, buildLedgerFailedRow,
  mapLedgerFailureReason, utcHour, usdMicrosFromCents,
} from './dasha-compute-ledger.mjs';

// ---------- unit: builders + money math ----------
{
  const row = buildLedgerPayoutRow({ payoutId: 'payout_1', providerId: 'mac_1', requestedAtMs: 1000, method: 'dasha', faceCents: 500, payoutCents: 525 });
  assert.equal(row.payout_face_usd_micros, 5_000_000);
  assert.equal(row.payout_option, 'dasha');
  assert.equal(row.dasha_bonus_usd_micros, 250_000); // (floor(500*1.05)-500) x 10,000
  assert.equal(row.paid_at_ms, null);
  assert.equal(row.dasha_quantity, null);
  const usdc = buildLedgerPayoutRow({ payoutId: 'payout_2', providerId: 'mac_1', requestedAtMs: 1000, method: 'usdc', faceCents: 500, payoutCents: 500 });
  assert.equal(usdc.payout_option, 'usdc');
  assert.equal(usdc.dasha_bonus_usd_micros, 0);
  const settled = buildLedgerSettledRow({ receiptId: 'r1', jobId: 'j1', providerId: 'mac_1', usage: { prompt_tokens: 12, completion_tokens: 34 }, durationMs: 1500, settledAtMs: 2000, buyerChargeCents: 5, creditUsedCents: 5, providerPayoutCents: 8, pricingVersion: '2026-09-alpha-1' });
  assert.equal(settled.buyer_charge_usd_micros, 50_000);
  assert.equal(settled.provider_payout_usd_micros, 80_000);
  assert.equal(settled.payment_fee_usd_micros, null);
  assert.equal(settled.prompt_tokens, 12);
  assert.equal(settled.completion_tokens, 34);
  // economy ruling: hosted rows payout 0, cost field null until real Workers AI numbers
  const hosted = buildLedgerSettledRow({ receiptId: 'r2', jobId: null, providerId: null, usage: { total_tokens: 46 }, settledAtMs: 2000, buyerChargeCents: 5, creditUsedCents: null, providerPayoutCents: 0, hostedInferenceCostCents: null, pricingVersion: '2026-09-alpha-1', engine: 'hosted' });
  assert.equal(hosted.provider_payout_usd_micros, 0);
  assert.equal(hosted.hosted_inference_cost_usd_micros, null);
  assert.equal(hosted.engine, 'hosted');
  // traction fix 2: missing money inputs stay null, never silently 0
  const missing = buildLedgerSettledRow({ receiptId: 'r3', jobId: 'j9' });
  assert.equal(missing.buyer_charge_usd_micros, null);
  assert.equal(missing.credit_used_usd_micros, null);
  assert.equal(missing.provider_payout_usd_micros, null);
  assert.equal(usdMicrosFromCents(undefined), null);
  assert.equal(usdMicrosFromCents(null), null);
  assert.equal(usdMicrosFromCents(0), 0);
  assert.equal(mapLedgerFailureReason('provider cut'), 'provider_offline');
  assert.equal(mapLedgerFailureReason('expired'), 'timeout');
  assert.equal(mapLedgerFailureReason('cancelled'), 'client_abort');
  assert.equal(mapLedgerFailureReason('provider inference failed'), 'model_error');
  assert.equal(buildLedgerFailedRow({ failureReason: 'provider cut' }).failure_reason, 'provider_offline');
  assert.equal(utcHour(0), '1970-01-01T00');
  assert.equal(usdMicrosFromCents(5), 50_000);
}

// ---------- integration harness ----------
const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-ledger-test-secret',
  LEDGER_EXPORT_TOKEN: 'ledger-test-token',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '', limit, startAfter } = {}) {
    let entries = [...rows].filter(([key]) => key.startsWith(prefix));
    if (startAfter) entries = entries.filter(([key]) => key > startAfter);
    if (limit) entries = entries.slice(0, limit);
    return new Map(entries);
  },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: '77', handle: 'ledger_buyer' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
const ledgerRows = (kind) => [...rows.entries()]
  .filter(([key]) => key.startsWith(LEDGER_EVENT_PREFIX))
  .map(([key, row]) => ({ ledger_key: key, ...row }))
  .filter((row) => row.kind === kind);

// provider register -> provider_event registered row
const register = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders,
  body: JSON.stringify({ name: 'Ledger Mac', models: ['gemma3-27b', 'qwen3-8b'] }),
}), origin);
assert.equal(register.status, 201);
const creds = await register.json();
const registered = ledgerRows('provider_event').filter((r) => r.provider_registered_at_ms != null);
assert.equal(registered.length, 1);
assert.equal(registered[0].provider_id, creds.provider_id);

// poll -> first_heartbeat once (version-less), one online-hour row per hour
const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
const pollBody = { provider_id: creds.provider_id, name: 'Ledger Mac', models: ['gemma3-27b'] };
await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(pollBody) }), origin);
await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(pollBody) }), origin);
const heartbeats = ledgerRows('provider_event').filter((r) => r.first_heartbeat_at_ms != null);
assert.equal(heartbeats.length, 1);
assert.equal(heartbeats[0].kit_version, 'version-less');
const pohRows = [...rows.keys()].filter((k) => k.startsWith(LEDGER_POH_PREFIX));
assert.equal(pohRows.length, 1);
assert.equal(rows.get(pohRows[0]).online, 1);
assert.equal(rows.get(pohRows[0]).provider_id, creds.provider_id);

// dsk mint -> buyer_event + carry-over mapping
const keyMint = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Ledger key' }),
}), origin);
assert.equal(keyMint.status, 201);
const minted = await keyMint.json();
const buyerEvents = ledgerRows('buyer_event');
assert.equal(buyerEvents.length, 1);
assert.match(buyerEvents[0].buyer_id, /^buy_[0-9a-f]{16}$/);
assert.equal(buyerEvents[0].first_job_at_ms, null);

// UI job -> created row (path ui_ask, key_type none, minted request_id, carried-over buyer)
const submit = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST', headers: userHeaders,
  body: JSON.stringify({ model: 'gemma3-27b', prompt: 'Say hello from the ledger test.' }),
}), origin);
assert.equal(submit.status, 202);
const submitted = await submit.json();
const created = ledgerRows('job_event').filter((r) => r.status === 'created');
assert.equal(created.length, 1);
assert.equal(created[0].job_id, submitted.id);
assert.equal(created[0].path, 'ui_ask');
assert.equal(created[0].key_type, 'none');
assert.match(created[0].request_id, /^req_/);
assert.equal(created[0].buyer_id, buyerEvents[0].buyer_id);
assert.equal(created[0].model_id, 'gemma3-27b');
assert.equal(buyerEvents.length === 1, true); // no second buyer_event

// guest key mint -> second buyer_event (separate buyer, no account merge)
const guestMint = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/guest-keys', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
}), origin);
assert.equal(guestMint.status, 201);
assert.equal(ledgerRows('buyer_event').length, 2);

// paid settle -> settled row with money block; replay writes no second row
const settleNow = Date.now();
const res = await network.recordPaidInferenceSettle({
  owner: 'ledger_owner', engine: 'community',
  usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 },
  cents: 8, jobId: 'job_ledgertest', requestId: 'req_ledgertest', model: 'qwen3-8b',
  latencyMs: 1500, replayKey: 'job:job_ledgertest', now: settleNow,
  ledger: { path: 'api', keyType: 'dsk_', providerId: creds.provider_id, createdAtMs: settleNow - 1500, buyerChargeCents: 5, creditUsedCents: 5, sessionId: null },
});
assert.equal(res.ok, true);
assert.equal(res.replay, false);
const settledRows = ledgerRows('job_event').filter((r) => r.status === 'settled');
assert.equal(settledRows.length, 1);
const srow = settledRows[0];
assert.equal(srow.receipt_id, res.receipt.id);
assert.equal(srow.job_id, 'job_ledgertest');
assert.equal(srow.provider_id, creds.provider_id);
assert.equal(srow.provider_payout_usd_micros, res.receipt.cents * 10_000); // per-row tie-out invariant
assert.equal(srow.buyer_charge_usd_micros, 50_000);
assert.equal(srow.pricing_version, '2026-09-alpha-1');
assert.equal(srow.duration_ms, 1500);
const resReplay = await network.recordPaidInferenceSettle({
  owner: 'ledger_owner', engine: 'community', usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 },
  cents: 8, jobId: 'job_ledgertest', requestId: 'req_ledgertest', model: 'qwen3-8b',
  latencyMs: 1500, replayKey: 'job:job_ledgertest', now: settleNow,
  ledger: { path: 'api', keyType: 'dsk_', providerId: creds.provider_id, createdAtMs: settleNow - 1500, buyerChargeCents: 5 },
});
assert.equal(resReplay.replay, true);
assert.equal(ledgerRows('job_event').filter((r) => r.status === 'settled').length, 1);

// refund -> new row pointing at the original receipt; originals untouched
rows.set('compute:credit-spend:ledger_owner:api:job_ledgertest', { cents: 5, reason: 'api-chat', createdAt: settleNow });
const refunded = await network.refundJobDebit({ id: 'job_ledgertest', owner: 'ledger_owner', debitRequestId: 'api:job_ledgertest', debitKeyId: minted.id, debitCents: 5, status: 'failed' }, settleNow + 1000, 'failed');
assert.equal(refunded.ok, true);
assert.equal(refunded.replay, false);
const refundRows = ledgerRows('job_event').filter((r) => r.status === 'refunded');
assert.equal(refundRows.length, 1);
assert.equal(refundRows[0].receipt_id, res.receipt.id);
assert.equal(refundRows[0].refund_usd_micros, 50_000);

// export endpoint: 404 without token, 401 wrong token, 200 + pagination with token
const noTokenNet = new ComputeNetwork({ storage }, { ...env, LEDGER_EXPORT_TOKEN: '' });
const notFound = await noTokenNet.fetch(new Request('https://lobby.getdasha.com/compute/api/ledger'), origin);
assert.equal(notFound.status, 404);
const wrongToken = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/ledger', { headers: { Authorization: 'Bearer nope' } }), origin);
assert.equal(wrongToken.status, 401);
const page1 = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/ledger?limit=3', { headers: { Authorization: 'Bearer ledger-test-token' } }), origin);
assert.equal(page1.status, 200);
const body1 = await page1.json();
assert.equal(body1.rows.length, 3);
assert.equal(body1.has_more, true);
const page2 = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/ledger?limit=100&after=${encodeURIComponent(body1.cursor)}`, { headers: { Authorization: 'Bearer ledger-test-token' } }), origin);
const body2 = await page2.json();
const total = ledgerRows('job_event').length + ledgerRows('buyer_event').length + ledgerRows('provider_event').length + ledgerRows('payout_event').length;
assert.equal(body1.rows.length + body2.rows.length, total);
assert.equal(body2.has_more, false);
const overlap = new Set([...body1.rows, ...body2.rows].map((r) => r.ledger_key));
assert.equal(overlap.size, total); // no duplicates across pages

console.log('dasha-compute-ledger: PASS');
