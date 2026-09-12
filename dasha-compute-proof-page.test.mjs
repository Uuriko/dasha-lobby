#!/usr/bin/env node
/**
 * /compute/proof + /compute/proof.json: the six-section live proof page.
 * Pins: both routes registered in the worker, every section present, all
 * numbers sourced from live public endpoints or linked external docs, and
 * the honesty invariants (0 renders as 0, dark windows shown, no invented
 * uptime SLA, DeepSeek Sep 14 repricing called out, one-provider wall).
 * No wrangler. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPUTE_PROOF_PAGE_HTML } from './dasha-compute-proof-page.mjs';

const worker = readFileSync(new URL('./dasha-lobby-worker.mjs', import.meta.url), 'utf8');
const html = COMPUTE_PROOF_PAGE_HTML;

// Routes registered in the main worker.
assert.equal(worker.split("url.pathname === '/compute/proof'").length - 1, 2, 'proof route at both dispatch sites');
assert.equal(worker.split("url.pathname === '/compute/proof.json'").length - 1, 2, 'proof.json route at both dispatch sites');
assert.match(worker, /url\.pathname === '\/compute\/proof\.json'/);
assert.match(worker, /computeProofPageResponse/);
assert.match(worker, /computeProofJsonResponse/);
assert.match(worker, /dasha-compute-proof-page\.mjs/);

// Six sections, spec order.
assert.match(html, /1\. Right now/);
assert.match(html, /2\. Every job, signed/);
assert.match(html, /3\. Ask the network/);
assert.match(html, /4\. Fail loud/);
assert.match(html, /5\. What it costs/);
assert.match(html, /6\. The provider wall/);

// Live sources the page reads (the one-click rule).
for (const ep of ['/compute/api/network', '/compute/api/readyz', '/compute/api/verify', '/compute/api/chain', '/compute/api/metrics', '/compute/api/pricing', '/keys.json', '/compute/llms.txt', '/compute/proof.json']) {
  assert.ok(html.includes(ep), 'page references ' + ep);
}

// Honesty invariants.
assert.match(html, /providers_online/);                 // gauge is live
assert.match(html, /one Mac, stated as one Mac/);       // one provider said as one
assert.match(html, /dark/);                             // dark windows rendered
assert.match(html, /not an SLA/);                       // no invented uptime percentage
assert.match(html, /no_mac_online/);                    // fail-loud contract shown
assert.match(html, /Sep 14, 2026/);                     // DeepSeek repricing called out
assert.match(html, /api-docs\.deepseek\.com\/quick_start\/pricing/);
assert.match(html, /founding provider/);
assert.match(html, /\$0\.05\/job \+ \$0\.01\/1k completion/); // published provider terms

// proof.json aggregates the same endpoints server-side with explicit sources.
assert.match(worker, /schema: 'proof\.compute\.v0'/);
assert.match(worker, /receipt_format: origin \+ '\/compute\/llms\.txt'/);
assert.match(worker, /no_mac_online/);

// House rules.
assert.doesNotMatch(html, /plugin\.jup\.ag/);
const proofBlock = worker.slice(worker.indexOf('function computeProofPageResponse'), worker.indexOf('function computeKitResponse'));
assert.doesNotMatch(proofBlock, /potter[_-]?key|DASHA_POTTER|people-data/i);

console.log('dasha-compute-proof-page: ok');
