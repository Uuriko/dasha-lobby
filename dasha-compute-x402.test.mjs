#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  X402_BILLING_DOCS, X402_CANARY_ROUTE, X402_SOLANA_NETWORK, X402_USDC_MINT,
  buildSolanaExactChallenge, buildX402Offer, canonicalX402ReceiptBinding,
  encodePaymentRequiredHeader, isComputeX402PocEnabled, maybeX402Challenge,
  parsePaymentSignatureHeader, x402BillingDocsLine, x402CanaryConfig,
  x402ExactAmountAtomic,
} from './dasha-compute-x402.mjs';

assert.equal(x402ExactAmountAtomic(undefined), null);
assert.equal(x402ExactAmountAtomic(0), null);
assert.equal(x402ExactAmountAtomic(5), '50000');
assert.equal(isComputeX402PocEnabled({}), false);
assert.equal(x402BillingDocsLine({}), X402_BILLING_DOCS);

const partial = x402CanaryConfig({ COMPUTE_X402_POC: '1' });
assert.equal(partial.ready, false);
assert.deepEqual(partial.reasons, ['price_unset', 'pay_to_unset', 'facilitator_unset', 'fee_payer_unset']);

const liveShaped = {
  COMPUTE_X402_POC: '1',
  COMPUTE_X402_ROUTE: X402_CANARY_ROUTE,
  COMPUTE_X402_AMOUNT_ATOMIC: '50000',
  COMPUTE_X402_PAY_TO: 'TreasuryOwnerDecisionPlaceholder',
  COMPUTE_X402_FACILITATOR_URL: 'https://facilitator.invalid',
  COMPUTE_X402_FEE_PAYER: 'FacilitatorFeePayerPlaceholder',
};
assert.equal(x402CanaryConfig(liveShaped).ready, true);
assert.equal(x402BillingDocsLine(liveShaped), 'canary_configured_unwired');
assert.equal(x402CanaryConfig({ ...liveShaped, COMPUTE_X402_ROUTE: '/compute/api/v1/chat/completions' }).ready, false);

assert.equal(buildSolanaExactChallenge(), null, 'challenge cannot invent price, payTo, or fee payer');
const challenge = buildSolanaExactChallenge({
  amountAtomic: '50000', payTo: 'TreasuryOwnerDecisionPlaceholder', feePayer: 'FacilitatorFeePayerPlaceholder', memo: 'dasha:x402:test',
});
assert.equal(challenge.x402Version, 2);
assert.equal(challenge.accepts[0].network, X402_SOLANA_NETWORK);
assert.equal(challenge.accepts[0].asset, X402_USDC_MINT);
assert.equal(challenge.accepts[0].amount, '50000');
assert.equal(challenge.accepts[0].extra.memo, 'dasha:x402:test');
assert.ok(encodePaymentRequiredHeader(challenge));

const payload = { x402Version: 2, accepted: challenge.accepts[0], payload: { transaction: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' } };
const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
assert.equal(parsePaymentSignatureHeader(encoded).ok, true);
assert.equal(parsePaymentSignatureHeader('').ok, false);

const optIn = new Request(`https://www.getdasha.com${X402_CANARY_ROUTE}`, { method: 'POST', headers: { Accept: 'application/x402+json' } });
assert.equal(maybeX402Challenge({}, optIn), null);
const blocked = maybeX402Challenge({ COMPUTE_X402_POC: '1' }, optIn);
assert.equal(blocked.status, 503);
assert.match(blocked.reasons.join(','), /pay_to_unset/);
const quoted = maybeX402Challenge(liveShaped, optIn);
assert.equal(quoted.status, 402);
assert.equal(quoted.challenge.accepts[0].amount, '50000');

const withSig = new Request(`https://www.getdasha.com${X402_CANARY_ROUTE}`, { method: 'POST', headers: { Accept: 'application/x402+json', 'PAYMENT-SIGNATURE': encoded } });
assert.equal(maybeX402Challenge(liveShaped, withSig).status, 501, 'valid-shaped payload never settles in stub');
const dual = new Request(`https://www.getdasha.com${X402_CANARY_ROUTE}`, { headers: { 'x-dasha-pay': 'x402', Authorization: 'Bearer dsk_test' } });
assert.equal(maybeX402Challenge(liveShaped, dual).status, 400);

const binding = canonicalX402ReceiptBinding({ receiptHash: 'abc', settlementTransaction: '5Txn', payer: 'payer', amountAtomic: '50000' });
assert.deepEqual(Object.keys(binding), ['schema', 'receipt_hash', 'settlement_transaction', 'network', 'payer', 'amount', 'asset']);
assert.equal(binding.receipt_hash, 'abc');
assert.equal(canonicalX402ReceiptBinding({}), null);
assert.equal(canonicalX402ReceiptBinding({ receiptHash: 'abc', settlementTransaction: '5Txn', amountAtomic: '0' }), null);

const offer = buildX402Offer({});
assert.equal(offer.enabled, false);
assert.equal(offer.payment.amount, null);
assert.equal(offer.payment.payTo, null);
assert.match(offer.blockers.join(','), /price_unset/);
const fixture = JSON.parse(readFileSync(new URL('./dasha-compute-x402-offer.json', import.meta.url)));
assert.equal(fixture.enabled, false);
assert.equal(fixture.payment.amount, null);
assert.equal(fixture.payment.payTo, null);

const src = readFileSync(new URL('./dasha-compute-x402.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(src, /debitCredits\s*\(|chargeApiKeySpend\s*\(/);
assert.doesNotMatch(src, /fetch\s*\(/);
const netSrc = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(netSrc, /maybeX402Challenge/);
console.log('dasha-compute-x402: PASS');
