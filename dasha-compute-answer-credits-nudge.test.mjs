#!/usr/bin/env node
/**
 * Inspire X5 — quiet #answer-credits after rate-limit / credits 402 only.
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

function assertAnswerCredits(html, label) {
  assert.match(html, /id=["']after-answer["']/, `${label} after-answer`);
  assert.match(
    html,
    /id=["']answer-credits["'][^>]*class=["']tf-quiet["']|class=["']tf-quiet["'][^>]*id=["']answer-credits["']/,
    `${label} answer-credits tf-quiet`
  );
  assert.match(html, /id=["']answer-credits["'][^>]*hidden/, `${label} hidden until paint`);
  assert.match(html, /function paintAnswerMoney\(/, `${label} paintAnswerMoney`);
  assert.match(html, /function clearAnswerMoney\(/, `${label} clearAnswerMoney`);
  assert.match(html, /lastAskFailKind/, `${label} lastAskFailKind`);
  assert.match(html, /lastAskFailKind=["']credits["']/, `${label} credits fail kind`);
  assert.match(html, /lastAskFailKind=["']rate["']/, `${label} rate fail kind`);
  assert.match(html, /lastAskFailKind==='credits'\?'Top up':'Credits'/, `${label} Top up / Credits labels`);
  assert.match(html, /top up\|credits\|insufficient/i, `${label} credits error match`);
  assert.match(html, /rate\.?limit\|limit reached\|try again shortly/i, `${label} rate error match`);
  assert.match(html, /showTf\(["']pay-buy["']\)/, `${label} Top up → pay-buy`);
  assert.match(html, /paintAnswerMoney\(\)/, `${label} paintAnswerMoney called`);
  assert.match(html, /clearAnswerMoney\(\)/, `${label} clearAnswerMoney called`);
  // Prefer stay on Answer — no yank to Credits on top-up error
  assert.doesNotMatch(
    html,
    /Top up credits\.[\s\S]{0,120}showTf\(["']credits["']\)/,
    `${label} no mid-read yank to Credits on top-up`
  );
  // Happy path must not set fail kind
  assert.match(html, /onFirstToken\(\);clearAnswerMoney\(\)/, `${label} clear on success`);
}

assertAnswerCredits(disk, "disk");
assertAnswerCredits(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"));
assert.equal(res.status, 200);
const workerHtml = await res.text();
assertAnswerCredits(workerHtml, "worker");

console.log("dasha-compute-answer-credits-nudge: PASS");
