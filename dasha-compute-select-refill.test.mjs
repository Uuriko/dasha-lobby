#!/usr/bin/env node
/** Unified page prefills model options; no empty-select refill required. */
import assert from "node:assert/strict";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
assert.match(COMPUTE_PAGE_HTML, /<select id=["']model["']>/);
assert.match(COMPUTE_PAGE_HTML, /value=["']qwen3-8b["'] selected/);
assert.doesNotMatch(COMPUTE_PAGE_HTML, /<select id=["']model["']><\/select>/);
assert.doesNotMatch(COMPUTE_PAGE_HTML, /<select id=["']chip["']><\/select>/);
console.log("dasha-compute-select-refill: PASS");
