#!/usr/bin/env node
/**
 * COMPUTE_X402_POC flag-off skeleton — challenge builder + OFF is noop.
 * No facilitator. No live settle. No credit/key debit on x402 path.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CREDIT_DEST,
  HOSTED_ASK_PRICE_CENTS,
  USDC_MINT,
} from './dasha-compute-credits.mjs';
import {
  X402_BILLING_DOCS,
  X402_SOLANA_NETWORK,
  X402_VERSION,
  buildSolanaExactChallenge,
  encodePaymentRequiredHeader,
  isComputeX402PocEnabled,
  maybeX402Challenge,
  parsePaymentSignatureHeader,
  wantsX402Pay,
  x402BillingDocsLine,
  x402ExactAmountAtomic,
} from './dasha-compute-x402.mjs';

assert.equal(HOSTED_ASK_PRICE_CENTS, 5);
assert.equal(x402ExactAmountAtomic(5), '50000');
assert.equal(x402ExactAmountAtomic(HOSTED_ASK_PRICE_CENTS), '50000');

// --- flag OFF by default ---
assert.equal(isComputeX402PocEnabled(undefined), false);
assert.equal(isComputeX402PocEnabled({}), false);
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: '' }), false);
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: '0' }), false);
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: 'false' }), false);
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: 'off' }), false);
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: 'no' }), false);
assert.equal(x402BillingDocsLine({}), X402_BILLING_DOCS);
assert.equal(X402_BILLING_DOCS, 'flag_off');

// --- flag ON only for explicit truthy ---
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: '1' }), true);
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: 'true' }), true);
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: 'YES' }), true);
assert.equal(isComputeX402PocEnabled({ COMPUTE_X402_POC: 'on' }), true);

// --- Solana exact $0.05 challenge shape ---
const challenge = buildSolanaExactChallenge();
assert.ok(challenge);
assert.equal(challenge.x402_version, X402_VERSION);
assert.equal(challenge.x402Version, X402_VERSION);
assert.equal(challenge.accepts.length, 1);
const acc = challenge.accepts[0];
assert.equal(acc.scheme, 'exact');
assert.equal(acc.network, X402_SOLANA_NETWORK);
assert.equal(acc.amount, '50000');
assert.equal(acc.asset, USDC_MINT);
assert.equal(acc.payTo, CREDIT_DEST);
assert.match(acc.network, /^solana:/);
assert.equal(acc.asset, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
assert.ok(acc.extra);
assert.equal(acc.extra.settle, 'not_enabled');
assert.equal(challenge.amount_cents, 5);

const hdr = encodePaymentRequiredHeader(challenge);
assert.ok(hdr && hdr.length > 20);
assert.doesNotMatch(hdr, /\s/);

// --- PAYMENT-SIGNATURE shape parse (no settle) ---
const goodPayload = {
  x402Version: 2,
  payload: { transaction: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
};
const goodB64 = Buffer.from(JSON.stringify(goodPayload)).toString('base64');
const parsed = parsePaymentSignatureHeader(goodB64);
assert.equal(parsed.ok, true);
assert.ok(parsed.payload);

assert.equal(parsePaymentSignatureHeader('').ok, false);
assert.equal(parsePaymentSignatureHeader('%%%').ok, false);
assert.equal(parsePaymentSignatureHeader(Buffer.from('{}').toString('base64')).ok, false);

// --- OFF is noop for maybeX402Challenge (even with opt-in headers) ---
const optIn = new Request('https://www.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Accept: 'application/x402+json',
    'x-dasha-pay': 'x402',
    'Content-Type': 'application/json',
  },
  body: '{}',
});
assert.equal(wantsX402Pay(optIn), true);
assert.equal(maybeX402Challenge({}, optIn), null);
assert.equal(maybeX402Challenge({ COMPUTE_X402_POC: '0' }, optIn), null);
assert.equal(maybeX402Challenge({ COMPUTE_X402_POC: 'false' }, optIn), null);

// Flag ON + opt-in + no bearer → challenge (still no settle / no Worker wire)
const onCh = maybeX402Challenge({ COMPUTE_X402_POC: '1' }, optIn);
assert.equal(onCh.status, 402);
assert.equal(onCh.challenge.accepts[0].amount, '50000');

// Dual-auth reject shape
const dual = new Request('https://www.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer dsk_test',
    'x-dasha-pay': 'x402',
  },
});
const dualRes = maybeX402Challenge({ COMPUTE_X402_POC: '1' }, dual);
assert.equal(dualRes.status, 400);
assert.equal(dualRes.error, 'dual_auth');

// Signature present → 501 verify not enabled (no debit path)
const withSig = new Request('https://www.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Accept: 'application/x402+json',
    'PAYMENT-SIGNATURE': goodB64,
  },
});
const sigRes = maybeX402Challenge({ COMPUTE_X402_POC: '1' }, withSig);
assert.equal(sigRes.status, 501);
assert.equal(sigRes.error, 'x402_verify_not_enabled');

// --- Source locks: no Worker chat wire this hop; no debit on x402 module ---
const x402Src = readFileSync(new URL('./dasha-compute-x402.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(x402Src, /debitCredits\s*\(|chargeApiKeySpend\s*\(/);
assert.doesNotMatch(x402Src, /fetch\([^)]*\/settle|fetch\([^)]*\/verify|facilitatorUrl|FACILITATOR_/);
assert.match(x402Src, /flag OFF by default|No facilitator|Never debit/i);
assert.match(x402Src, /not_enabled|verify_not_enabled/);

const netSrc = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(netSrc, /x402BillingDocsLine|X402_BILLING_DOCS|billing\.x402|x402:/);
// Chat path must not call maybeX402Challenge yet (risky ON wire held).
assert.doesNotMatch(netSrc, /maybeX402Challenge/);
assert.doesNotMatch(netSrc, /PAYMENT-SIGNATURE|PAYMENT-REQUIRED/);

// Prepaid OpenAI 402 strings still present (unchanged collision surface)
assert.match(netSrc, /top up credits/);
assert.match(netSrc, /key spend limit reached/);

// billing docs honesty: flag_off not "live"
assert.match(netSrc, /flag_off|planned/);

// /x402 stays intentional skip (not pretty-pathed) — worker comment lock
const workerSrc = readFileSync(new URL('./dasha-lobby-worker.mjs', import.meta.url), 'utf8');
assert.match(workerSrc, /\/x402/);

console.log('dasha-compute-x402: PASS');
