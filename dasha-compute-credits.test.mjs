#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CREDIT_DEST,
  CREDIT_PACKS,
  DASHA_MINT,
  USDC_MINT,
  amountUiFromRaw,
  dashaAmountRaw,
  generateReference,
  priceFor,
  solanaPayUrl,
  usdcAmountRaw,
  verifyCreditTx,
  HOSTED_ASK_PRICE_CENTS,
  applyCreditDebit,
} from './dasha-compute-credits.mjs';

function packBy(id) {
  return CREDIT_PACKS.find((p) => p.id === id);
}

assert.deepEqual(CREDIT_PACKS.map((p) => p.id), ['5', '20', '50']);

const u5 = priceFor('usdc', packBy('5'));
assert.equal(u5.charge_cents, 485);
assert.equal(u5.face_cents, 500);
assert.equal(String(usdcAmountRaw(u5.charge_cents)), '4850000');
assert.equal(amountUiFromRaw(4850000n), '4.85');

const u20 = priceFor('usdc', packBy('20'));
assert.equal(u20.charge_cents, 1940);
assert.equal(String(usdcAmountRaw(u20.charge_cents)), '19400000');

const u50 = priceFor('usdc', packBy('50'));
assert.equal(u50.charge_cents, 4850);

const d5 = priceFor('dasha', packBy('5'));
assert.equal(d5.charge_cents, 475);
assert.equal(String(dashaAmountRaw(475, 0.0001)), '47500000000');
assert.equal(dashaAmountRaw(475, 0), null);
assert.equal(dashaAmountRaw(475, NaN), null);
assert.equal(priceFor('card', packBy('5')), null);

const ref = await generateReference();
assert.match(ref, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const url = solanaPayUrl({ dest: CREDIT_DEST, amount: '4.85', mint: USDC_MINT, reference: ref, label: 'Dasha Compute' });
assert.match(url, new RegExp(`^solana:${CREDIT_DEST}\\?`));
assert.match(url, /amount=4.85/);
assert.match(url, new RegExp(`spl-token=${USDC_MINT}`));
assert.match(url, new RegExp(`reference=${ref}`));
assert.doesNotMatch(url, /DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb/);

function mkTx({ dest = CREDIT_DEST, mint = USDC_MINT, pre = null, post = '4850000', keys = [], err = null } = {}) {
  const preTokenBalances = pre == null ? [] : [{ owner: dest, mint, uiTokenAmount: { amount: String(pre) } }];
  const postTokenBalances = post == null ? [] : [{ owner: dest, mint, uiTokenAmount: { amount: String(post) } }];
  return {
    meta: { err, preTokenBalances, postTokenBalances },
    transaction: { message: { accountKeys: keys } },
  };
}

const ok = verifyCreditTx(mkTx({ keys: ['payer', CREDIT_DEST, ref], pre: null, post: '4850000' }), {
  dest: CREDIT_DEST,
  mint: USDC_MINT,
  amountRaw: 4850000n,
  reference: ref,
});
assert.equal(ok.ok, true);
assert.equal(String(ok.amountRaw), '4850000');

assert.equal(verifyCreditTx(mkTx({ keys: ['payer'], post: '4850000' }), {
  dest: CREDIT_DEST, mint: USDC_MINT, amountRaw: 4850000n, reference: ref,
}).ok, false);

assert.equal(verifyCreditTx(mkTx({ keys: ['payer', ref], post: '100' }), {
  dest: CREDIT_DEST, mint: USDC_MINT, amountRaw: 4850000n, reference: ref,
}).ok, false);

assert.equal(verifyCreditTx(mkTx({ keys: [ref], post: '4850000', mint: DASHA_MINT }), {
  dest: CREDIT_DEST, mint: USDC_MINT, amountRaw: 4850000n, reference: ref,
}).ok, false);

assert.equal(verifyCreditTx(mkTx({ keys: [ref], err: { InstructionError: [0, 'x'] }, post: '4850000' }), {
  dest: CREDIT_DEST, mint: USDC_MINT, amountRaw: 4850000n, reference: ref,
}).ok, false);

const delta = verifyCreditTx(mkTx({ keys: [ref], pre: '1000000', post: '5850000' }), {
  dest: CREDIT_DEST, mint: USDC_MINT, amountRaw: 4850000n, reference: ref,
});
assert.equal(delta.ok, true);

assert.equal(HOSTED_ASK_PRICE_CENTS, 5);
assert.equal(applyCreditDebit(10, 5).balance_cents, 5);
assert.equal(applyCreditDebit(3, 5).ok, false);

console.log('dasha-compute-credits: PASS');
