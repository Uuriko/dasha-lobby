#!/usr/bin/env node
/**
 * Product: /compute steal bundle — (1) try-it-now playground, (2) price on the
 * card, (3) fleet scorecards — all visible on the gate, honest when empty.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const computeDisk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(computeDisk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");
assert.ok(existsSync(join(root, "dasha-compute-page.mjs")), "page module exists");

const html = COMPUTE_PAGE_HTML;

// ---- steal 1: try-it-now ----
assert.match(html, /id=["']ux-tryit["']/, "tryit band present");
assert.match(html, /id=["']tryit-run["']/, "tryit run button present");
assert.match(html, /id=["']tryit-prompt["']/, "tryit prompt field present");
assert.match(html, /id=["']tryit-status["'][^>]*aria-live=["']polite["']/, "tryit status is a live region");
assert.match(html, /id=["']tryit-out["']/, "tryit answer output present");
assert.match(html, /\/compute\/api\/guest-keys/, "tryit mints a guest key");
assert.match(html, /No Macs online right now — check back soon/, "honest no-Mac copy");
assert.match(html, /no_mac_online/, "handles the no-mac-online decision");
assert.match(html, /3 free runs \/ 10 min/, "guest limits stated up front");
assert.doesNotMatch(html, /tryit-key|tryit-secret/, "guest key never rendered to the DOM");

// ---- steal 2: price on the card ----
assert.match(html, /id=["']ux-pricing["']/, "pricing band present");
assert.match(html, /id=["']price-rows["']/, "pricing rows mount present");
assert.match(html, /\$0\.05 per successful job/, "flat price visible above the fold");
assert.match(html, /≈100 jobs per \$5/, "per-$5 framing visible");
assert.match(html, /\$0\.0475 eff\./, "$dasha buyer effective price visible");
assert.match(html, /CREDIT_DISCOUNTS\.dasha=0\.05/, "$dasha 5% discount constant intact");
assert.match(html, /HOSTED_ASK_PRICE_CENTS=5/, "$0.05 job price constant intact");
assert.match(html, /<th scope=["']col["']>Model<\/th>.*<th scope=["']col["']>\$dasha<\/th>/s, "pricing table has Model … $dasha columns");

// ---- steal 3: fleet scorecards ----
assert.match(html, /id=["']ux-fleet["']/, "fleet band present");
assert.match(html, /id=["']fleet-rows["']/, "fleet rows mount present");
assert.match(html, /\/compute\/api\/v1\/fleet/, "fleet reads the public fleet endpoint");
assert.match(html, /uptime warming up/, "honest label while uptime history accumulates");
assert.match(html, /jobs served/, "jobs-served counted from the receipt chain");
assert.match(html, /Share yours and be the fleet/, "honest empty-fleet CTA");

// Bands sit on the gate (first paint), before the demo band.
{
  const gate = html.indexOf('id="step-gate"');
  const tryit = html.indexOf('id="ux-tryit"');
  const pricing = html.indexOf('id="ux-pricing"');
  const fleet = html.indexOf('id="ux-fleet"');
  const demo = html.indexOf('id="ux-demo"');
  assert.ok(gate > -1 && tryit > gate && pricing > tryit && fleet > pricing && demo > fleet,
    "tryit → pricing → fleet bands land on the gate before the demo band");
}

console.log("compute steals first paint: ok");
