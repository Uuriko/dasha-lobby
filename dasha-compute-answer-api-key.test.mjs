#!/usr/bin/env node
/**
 * Inspire X7 — quiet #answer-api after first successful Answer (progressive API key).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertAnswerApi(html, label) {
  assert.match(html, /id=["']after-answer["']/, `${label} after-answer`);
  assert.match(
    html,
    /id=["']answer-api["'][^>]*class=["']tf-quiet["']|class=["']tf-quiet["'][^>]*id=["']answer-api["']/,
    `${label} answer-api tf-quiet`
  );
  assert.match(html, /id=["']answer-api["'][^>]*hidden/, `${label} hidden until paint`);
  assert.match(html, /id=["']answer-api["'][^>]*>API key</, `${label} API key label`);
  assert.match(html, /href=["']\/login\?return=\/compute%23build["']/, `${label} login return build`);
  assert.match(html, /function paintAnswerApi\(/, `${label} paintAnswerApi`);
  assert.match(html, /function hasSuccessfulAnswer\(/, `${label} hasSuccessfulAnswer`);
  assert.match(html, /sent>=1\|\|conversation\.some/, `${label} sent/assistant gate`);
  assert.match(html, /loggedIn&&apiKeyCount>0/, `${label} quiet when keys exist`);
  assert.match(html, /el\.textContent='Sign in'/, `${label} guest Sign in`);
  assert.match(html, /el\.textContent='API key'/, `${label} logged-in API key`);
  assert.match(html, /showTf\(['"]build['"]\)/, `${label} jumps to Build`);
  assert.match(html, /create-api-key[\s\S]{0,80}btn\.focus|btn\.focus\(\)/, `${label} focus create key`);
  assert.match(html, /paintAnswerApi\(\)/, `${label} paintAnswerApi called`);
  assert.match(html, /apiKeyCount/, `${label} apiKeyCount`);
  assert.doesNotMatch(html, /id=["']pick-build["']/, `${label} no pick-build`);
  assert.match(html, /id=["']create-api-key["']/, `${label} create-api-key still on Build`);
}

assertAnswerApi(disk, "disk");
assertAnswerApi(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"));
assert.equal(res.status, 200);
const workerHtml = await res.text();
assertAnswerApi(workerHtml, "worker");

console.log("dasha-compute-answer-api-key: PASS");
