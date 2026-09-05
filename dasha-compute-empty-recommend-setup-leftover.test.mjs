#!/usr/bin/env node
/**
 * Unified /compute supersedes this leftover. Strip helper stays exported for history;
 * live page no longer emits the leftover marker. Fixture unit coverage preserved where useful.
 * recommend empty mount cut; setup prefilled
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { stripComputeLeftoverEmptyRecommendSetup } from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const computeDisk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
assert.match(workerSrc, /export function stripComputeLeftoverEmptyRecommendSetup/);
assert.equal(computeDisk, COMPUTE_PAGE_HTML);

assert.match(computeDisk, /Mixture · sub-24GB/);
assert.doesNotMatch(computeDisk, /id=["']tab-sponsor["']/);
assert.doesNotMatch(computeDisk, /Exact claim/);
assert.equal(stripComputeLeftoverEmptyRecommendSetup(COMPUTE_PAGE_HTML), COMPUTE_PAGE_HTML, "strip no-ops on unified page");

const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get("x-dasha-edge"), "compute");
const html = await res.text();
assert.match(html, /Mixture · sub-24GB/);
assert.match(html, /id=["']ocm-door["']/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);
assert.doesNotMatch(html, /id=["']tab-use["']/);

console.log("dasha-compute-empty-recommend-setup-leftover: PASS");
