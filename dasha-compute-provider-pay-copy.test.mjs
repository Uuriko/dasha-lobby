#!/usr/bin/env node
/** Honest provider pay schedule surfaces (no fake balances). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { PROVIDE_SKILL_MD } from './dasha-compute-skills.mjs';
import {
  PROVIDER_JOB_CENTS,
  PROVIDER_TOKEN_CENTS_PER_1K,
  PROVIDER_MIN_PAYOUT_CENTS,
  earningsCatalog,
} from './dasha-compute-provider-earn.mjs';

const html = readFileSync(new URL('./dasha-compute.html', import.meta.url), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html \u2194 page.mjs sync');

assert.match(html, /id="earn-rates">\$0\.05\/job \+ \$0\.01\/1k completion \u00b7 min \$1 \u00b7 pending operator settle/);
assert.match(html, /id="provide-earn-fine">\$0\.05\/job \+ \$0\.01\/1k completion \u00b7 min \$1 \u00b7 pending operator settle/);
assert.match(html, /function formatEarnRatesLine/);
assert.match(html, /paintEarnRates\(earnRates\)/);
assert.match(html, /earnRates=null/);

assert.equal(PROVIDER_JOB_CENTS, 5);
assert.equal(PROVIDER_TOKEN_CENTS_PER_1K, 1);
assert.equal(PROVIDER_MIN_PAYOUT_CENTS, 100);

const cat = earningsCatalog({});
assert.equal(cat.rates.job_cents, 5);
assert.equal(cat.rates.token_cents_per_1k, 1);
assert.equal(cat.rates.min_payout_cents, 100);
assert.equal(cat.payout_mode, 'pending');
assert.equal(cat.total_usdc_cents, 0);

assert.match(PROVIDE_SKILL_MD, /\$0\.05\/job \+ \$0\.01\/1k completion tokens/);
assert.match(PROVIDE_SKILL_MD, /pending operator settle · not auto/);
assert.match(PROVIDE_SKILL_MD, /never invent balances/);
assert.match(html, /Pay \(community jobs\): \$0\.05\/job/);

console.log('ok provider-pay-copy');
