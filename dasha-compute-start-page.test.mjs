#!/usr/bin/env node
/**
 * /compute/start - the canonical evaluator path (evaluator-journey P0s).
 * Pins: route registered at both dispatch sites, the Run once / Verify the
 * receipt / Check the anchor block, exact copy-paste commands (guest key
 * capture, first call on a live-advertised model, one exact receipt lookup
 * by job_id, signed-head anchor check), the four failure scripts
 * (no-capacity / receipt-pending / not-yet-anchored / verifier-failed),
 * /caps preflight, kit-version honesty note, canonical Telegram invite with
 * anti-impersonation copy, and quiet links from the /compute gate and
 * /compute/proof.
 * No wrangler. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPUTE_START_PAGE_HTML } from './dasha-compute-start-page.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COMPUTE_PROOF_PAGE_HTML } from './dasha-compute-proof-page.mjs';

const worker = readFileSync(new URL('./dasha-lobby-worker.mjs', import.meta.url), 'utf8');
const routes = readFileSync(new URL('./ROUTES.md', import.meta.url), 'utf8');
const html = COMPUTE_START_PAGE_HTML;

// Route registered in the worker at both dispatch sites.
assert.equal(worker.split('return computeStartPageResponse(request);').length - 1, 2, 'start route at both dispatch sites');
assert.match(worker, /url\.pathname === '\/compute\/start'/);
assert.match(worker, /dasha-compute-start-page\.mjs/);
assert.match(worker, /compute-start/); // X-Dasha-Edge

// Sitemap parity (worker const + static-gen const carry the URL).
assert.match(worker, /https:\/\/www\.getdasha\.com\/compute\/start/);
const gen = readFileSync(new URL('./dasha-lobby-static-gen.mjs', import.meta.url), 'utf8');
assert.match(gen, /https:\/\/www\.getdasha\.com\/compute\/start/);

// ROUTES.md contract row.
assert.ok(routes.includes('`/compute/start`'), 'ROUTES.md documents /compute/start');

// The canonical block, spec order.
assert.match(html, /Run once\. Verify the receipt\. Check the anchor\./);
assert.ok(html.indexOf('1. Capture a guest key') < html.indexOf('2. Make the first call'), 'key before call');
assert.ok(html.indexOf('2. Make the first call') < html.indexOf('3. Verify your receipt'), 'call before verify');
assert.ok(html.indexOf('3. Verify your receipt') < html.indexOf('4. Check the anchor'), 'verify before anchor');

// Exact commands against live endpoints.
assert.match(html, /POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/);
assert.match(html, /jq -r \.api_key/);                                  // one-command capture
assert.match(html, /models_available\[0\]/);                            // live-advertised model, not hard-coded
assert.match(html, /\/compute\/api\/v1\/chat\/completions/);
assert.match(html, /jq -r \.job_id/);                                   // stable correlation id from the call
assert.match(html, /\/compute\/api\/verify\?hash=\$JOB/);               // one exact receipt lookup
assert.match(html, /\/heads\/checkpoint/);                              // signed-head anchor check
assert.match(html, /ANCHORED/);

// Rewrite boundary, one sentence.
assert.match(html, /Rewrite boundary/);
assert.match(html, /invalidating the signer's published signature/);

// Four failure scripts.
assert.match(html, /no_mac_online/);                                    // no-capacity
assert.match(html, /pending_operator/);                                 // receipt-pending
assert.match(html, /not yet been issued|next signed checkpoint has not been issued/i); // not-yet-anchored
assert.match(html, /Verifier failed\./);                                // verifier-failed

// Preflight: /caps redirect check + kit-version honesty.
assert.match(html, /curl -sSI https:\/\/www\.getdasha\.com\/caps/);
assert.match(html, /kit_versions/);

// Live numbers strip fetched client-side from /compute/api/network.
assert.match(html, /fetch\('\/compute\/api\/network'\)/);
assert.match(html, /providers_online/);
assert.match(html, /jobs_queued/);

// Canonical Telegram invite + anti-impersonation copy.
assert.match(html, /https:\/\/t\.me\/\+ck9pUjL2ncNiZjRh/);
assert.match(html, /only official Dasha invite - ignore lookalike groups/);
assert.ok(!html.includes('xB7S8mIQaKFiZjRh'), 'no stale Telegram invite');

// Quiet links from the /compute gate and /compute/proof.
assert.match(COMPUTE_PAGE_HTML, /id="gate-start" href="\/compute\/start"/);
assert.match(COMPUTE_PROOF_PAGE_HTML, /href="\/compute\/start"/);

console.log('compute-start page: ok');
