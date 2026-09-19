#!/usr/bin/env node
/**
 * $dasha bonus headline (2026-09-19, John direction; 5% provider bonus).
 * $dasha must be unmistakable in pricing/earn copy:
 * - pricing band compares pay-with-USDC vs pay-with-$dasha and receive +5%;
 * - Earn step carries a $dasha +5% callout and the payout method button says +5%;
 * - static $4.75/$4.85 prices must match CREDIT_DISCOUNTS (usdc 3%, dasha 5% off);
 * - server-side PROVIDER_DASHA_BONUS must be 1.05 to match the advertised +5%.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDER_DASHA_BONUS, PROVIDER_DASHA_BONUS_FRAC } from './dasha-compute-provider-earn.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');

// Pricing band comparison (buyer side + provider side).
const line = html.match(/id="ux-dasha-line"[^>]*>([^<]*)</);
assert.ok(line, 'ux-dasha-line exists');
assert.match(line[1], /\$dasha wins both ways/, 'headline framing');
assert.match(line[1], /\$4\.75 with \$dasha vs \$4\.85 with USDC/, 'pay comparison uses live prices');
assert.match(line[1], /providers earn \+5% when paid in \$dasha/, 'receive +5% headline');

// Static prices match the discount constants.
const disc = html.match(/const CREDIT_DISCOUNTS=\{usdc:([\d.]+),dasha:([\d.]+)\}/);
assert.ok(disc, 'page discount constants found');
const usdcCents = Math.round(500 * (1 - Number(disc[1])));
const dashaCents = Math.round(500 * (1 - Number(disc[2])));
assert.equal(usdcCents, 485, 'USDC $5 pack = $4.85');
assert.equal(dashaCents, 475, '$dasha $5 pack = $4.75');

// Earn step: callout + method button.
assert.match(html, /id="earn-dasha-callout"[^>]*>Take payouts in \$dasha: \+5% on every payout\./, 'earn callout');
assert.match(html, /id="earn-dasha"[^>]*>\$dasha · \+5%</, 'earn method button +5%');

// No stale +10% bonus copy anywhere user-facing.
assert.doesNotMatch(html, /dasha payout \+10%/, 'no stale +10% payout copy');
assert.doesNotMatch(html, /\$dasha · \+10%/, 'no stale +10% button label');

// Server-side bonus matches the advertised +5%.
assert.equal(PROVIDER_DASHA_BONUS, 1.05, 'server bonus is 1.05');
assert.equal(PROVIDER_DASHA_BONUS_FRAC, 0.05, 'server bonus frac is 0.05');

console.log('dasha-compute-dasha-bonus-headline: PASS');
