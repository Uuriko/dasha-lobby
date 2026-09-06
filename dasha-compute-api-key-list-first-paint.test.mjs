#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const computeDisk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(computeDisk, COMPUTE_PAGE_HTML);

function assertFill(html, label) {
  assert.match(html, /id=["']api-key-list["'][\s\S]{0,80}Sign in to create a developer key/, `${label} list`);
  assert.match(html, /id=["']api-key-output["'][\s\S]{0,40}Sign in to create a developer key/, `${label} output`);
  assert.match(html, /async function loadApiKeys\(\)/, `${label} loadApiKeys`);
  assert.match(html, /list\.replaceChildren\(\)/, `${label} replaceChildren`);
  assert.match(html, /if\(!loggedIn\)return/, `${label} gated`);
}
assertFill(computeDisk, "disk");
const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assertFill(await res.text(), "served");
console.log("dasha-compute-api-key-list-first-paint: PASS");
