#!/usr/bin/env node
/** Build is a disclosure, not a tab city. API base URL + curl stay. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(html, COMPUTE_PAGE_HTML);
assert.match(html, /details class=["']build["']/);
assert.match(html, /API · one base URL/);
assert.match(html, /id=["']gateway["']/);
assert.match(html, /https:\/\/lobby\.getdasha\.com\/compute\/api\/v1/);
assert.match(html, /id=["']create-api-key["']/);
const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.match(await res.text(), /details class=["']build["']/);
console.log("dasha-compute-build-live-chip: PASS");
