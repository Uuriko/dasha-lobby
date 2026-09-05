#!/usr/bin/env node
/** Unified /compute Typeform gate first paint contract. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML);

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get("x-dasha-edge"), "compute");
const html = await res.text();

assert.match(html, /<h1 class=["']tf-q["']>Start\.<\/h1>/);
assert.match(html, /id=["']pick-ask["'][^>]*>Ask</);
assert.match(html, /id=["']prompt["']/);
assert.match(html, /id=["']run-demo["']/);
assert.match(html, />Run</);
assert.match(html, /id=["']eng-mixture["'][^>]*>Mixture</);
assert.match(html, /sub-24GB specialists/);
assert.doesNotMatch(html, /id=["']ocm-door["']/);
assert.match(html, /id=["']pick-pay["'][^>]*>Pay</);
assert.match(html, /id=["']pick-credits["'][^>]*>Credits</);
assert.match(html, /id=["']pick-provide["']/);
assert.doesNotMatch(html, /id=["']tab-use["']|id=["']tab-sponsor["']|Exact claim|Sponsor the fleet/);
assert.doesNotMatch(html, /ollama pull raptor/i);
assert.doesNotMatch(html, /id=["']tab-night["']|id=["']pick-night["']|Schedule Night Shift/);
assert.match(html, /id=["']night-offer["'] hidden/);
assert.match(html, /id=["']queue-night["'][^>]*>Queue</);
assert.doesNotMatch(html, /Queue for when a Mac is up/);
assert.match(html, /Start\. Ask\. Provide\. Pay\. Credits\./);
assert.match(html, /value=["']qwen3-8b["'] selected/);
assert.match(html, /route=['"]mixture['"]|route:"mixture"/);
assert.doesNotMatch(html, /Hosted when idle/);
assert.doesNotMatch(html, /id=["']split["']|id=["']route-note["']|id=["']count["']|id=["']demo-auth["']/);

console.log("dasha-compute-unified-first-paint: PASS");
