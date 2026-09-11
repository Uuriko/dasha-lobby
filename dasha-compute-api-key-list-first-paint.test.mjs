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
  assert.match(html, /id=["']api-key-list["'][\s\S]{0,80}POST \/compute\/api\/guest-keys/, `${label} list`);
  assert.match(html, /id=["']api-key-output["'][\s\S]{0,40}POST \/compute\/api\/guest-keys/, `${label} output`);
  assert.match(html, /id=["']mint-guest-key["'][^>]*>Guest key</, `${label} guest mint`);
  assert.match(html, /api\(['"]\/compute\/api\/guest-keys['"]/, `${label} guest mint POST`);
  assert.match(html, /async function loadApiKeys\(\)/, `${label} loadApiKeys`);
  assert.match(html, /list\.replaceChildren\(\)/, `${label} replaceChildren`);
  assert.match(html, /if\(!loggedIn\)\{apiKeyCount=0/, `${label} gated`);
}
assertFill(computeDisk, "disk");
const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assertFill(await res.text(), "served");
console.log("dasha-compute-api-key-list-first-paint: PASS");
