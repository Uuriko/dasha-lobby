#!/usr/bin/env node
/** Night: no chrome door/tab on first paint; queue offer exists but stays hidden; Night is a step. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(html, COMPUTE_PAGE_HTML);
assert.doesNotMatch(html, /id=["']night-list["']/);
assert.doesNotMatch(html, /Schedule Night Shift/);
assert.doesNotMatch(html, /id=["']tab-night["']/);
assert.doesNotMatch(html, /id=["']pick-night["']/);
assert.match(html, /id=["']eng-mixture["'][^>]*>Mixture</);
assert.match(html, /sub-24GB specialists/);
assert.match(html, /id=["']night-offer["'] hidden/);
assert.match(html, /id=["']queue-night["'][^>]*>Queue</);
assert.doesNotMatch(html, /Queue for when a Mac is up/);
assert.match(html, /showTf\(['"]night['"]\)|data-tf=["']night["']/);
assert.match(html, /showNightOffer/);
console.log("dasha-compute-night-check-first-paint: PASS");
