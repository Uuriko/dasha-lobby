#!/usr/bin/env node
/**
 * Live Worker c7c798d9: Caution Phase0 honesty receipt
 * (CAUTION-RECEIPT-PHASE0-SHIP-2026-09-06).
 * publicPhase0Receipt + honestyFieldsFrom; #answer-receipt-note
 * "no enclave · attestation N/A"; attestation always null.
 * Never invent tok/s. No Caution-verifiable badge.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import {
  ComputeNetwork,
  measuredTokPerSecForModel,
  publicJobSettle,
  publicPhase0Receipt,
} from "./dasha-compute-network.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { COOKIE, createSessionToken } from "./dasha-lobby-x.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
const networkSrc = readFileSync(join(root, "dasha-compute-network.mjs"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertPhase0(html, label) {
  assert.match(html, /function honestyFieldsFrom\(/, `${label} honestyFieldsFrom`);
  assert.match(html, /id=["']answer-receipt-note["']/, `${label} answer-receipt-note`);
  assert.match(html, /no enclave · attestation N\/A/, `${label} no enclave copy`);
  assert.match(html, /attestation always null/, `${label} attestation always null`);
  assert.match(html, /never invent tok\/s, cents, or attestation/, `${label} never invent`);
  assert.doesNotMatch(html, /Caution-verifiable/, `${label} no Caution-verifiable`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertPhase0(disk, "disk");
assertPhase0(COMPUTE_PAGE_HTML, "embed");

const servedRes = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(servedRes.status, 200);
assertPhase0(await servedRes.text(), "worker.fetch");

assert.match(networkSrc, /export function publicPhase0Receipt\(/);
assert.match(networkSrc, /export function publicJobSettle\(/);
assert.match(networkSrc, /export function measuredTokPerSecForModel\(/);
assert.match(networkSrc, /attestation: null/);
assert.match(networkSrc, /\.\.\.\(receipt \? \{ receipt \} : \{\}\)/);
assert.doesNotMatch(networkSrc, /Caution-verifiable/);
assert.doesNotMatch(networkSrc, /dasha-compute-x402/);

assert.equal(publicPhase0Receipt(null), null);
const bare = publicPhase0Receipt({ id: "job_a", model: "qwen3-8b", route: "community" });
assert.equal(bare.attestation, null);
assert.equal(bare.job_id, "job_a");
assert.equal(bare.model_id, "qwen3-8b");
assert.equal(bare.provider_class, "community");
assert.equal("tokens_per_second" in bare, false, "never invent tok/s");
assert.equal("settled" in bare, false);

const measured = publicPhase0Receipt(
  { id: "job_b", model: "gemma3-27b", route: "community" },
  { capacity: [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }] },
);
assert.equal(measured.tokens_per_second, 2.93);
assert.equal(measured.attestation, null);

const unmeasured = publicPhase0Receipt(
  { id: "job_c", model: "qwen3-8b", route: "community" },
  { capacity: [{ model: "qwen3-8b", measured_providers: 0, tokens_per_second: 42 }] },
);
assert.equal("tokens_per_second" in unmeasured, false, "unmeasured capacity omitted");

assert.equal(measuredTokPerSecForModel([{ model: "qwen3-8b", measured_providers: 1, tokens_per_second: 3.1 }], "qwen3-8b"), 3.1);
assert.equal(measuredTokPerSecForModel([{ model: "qwen3-8b", measured_providers: 0, tokens_per_second: 42 }], "qwen3-8b"), null);
assert.equal(measuredTokPerSecForModel([], "qwen3-8b"), null);

assert.deepEqual(publicJobSettle({ settle_cents: 6, settle_state: "pending_operator" }), { cents: 6, state: "pending_operator" });
assert.equal(publicJobSettle({ settle_cents: 6 }), null);

const withSettle = publicPhase0Receipt({
  id: "job_d", model: "qwen3-8b", route: "mixture",
  settle_cents: 6, settle_state: "pending_operator",
});
assert.deepEqual(withSettle.settled, { cents: 6, state: "pending_operator" });
assert.equal(withSettle.attestation, null);

const env = { LOBBY_SESSION_SECRET: "phase0-receipt-secret", AI: { run: async () => ({ response: "ok" }) } };
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === "object") for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = "" } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const now = Date.now();
const session = await createSessionToken(env, { xId: "phase0-owner", handle: "phase0_rx" });
const cookie = { Cookie: `${COOKIE}=${session}` };

const doneId = "job_phase0_ok";
await storage.put(`compute:job:${doneId}`, {
  id: doneId, owner: "x:phase0-owner", status: "complete", model: "qwen3-8b",
  route: "community", answer: "hi",
  usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
  settle_cents: 6, settle_state: "pending_operator",
  completedAt: now,
  createdAt: now, expiresAt: now + 5 * 60_000, providerId: "mac_1",
});
const done = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${doneId}`, { headers: cookie }));
assert.equal(done.status, 200);
const doneBody = await done.json();
assert.equal(doneBody.route, "community");
assert.deepEqual(doneBody.settle, { cents: 6, state: "pending_operator" });
assert.ok(doneBody.receipt && typeof doneBody.receipt === "object");
assert.equal(doneBody.receipt.attestation, null);
assert.equal(doneBody.receipt.job_id, doneId);
assert.equal(doneBody.receipt.model_id, "qwen3-8b");
assert.equal(doneBody.receipt.provider_class, "community");
assert.deepEqual(doneBody.receipt.settled, { cents: 6, state: "pending_operator" });
assert.equal("Caution-verifiable" in doneBody.receipt, false);

const sseJob = {
  id: "job_phase0_sse", owner: "x:phase0-owner", status: "complete", model: "qwen3-8b",
  route: "community", stream: true, chunks: ["hi"],
  usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
  settle_cents: 6, settle_state: "pending_operator",
  completedAt: now,
  createdAt: now, expiresAt: now + 5 * 60_000,
};
await storage.put(`compute:job:${sseJob.id}`, sseJob);
const sseText = await network.streamResponse(sseJob).text();
const stopChunk = [...sseText.matchAll(/^data: (\{.*\})\s*$/gm)]
  .map((m) => JSON.parse(m[1]))
  .find((c) => c?.choices?.[0]?.finish_reason === "stop");
assert.ok(stopChunk, "SSE stop chunk");
assert.deepEqual(stopChunk.usage, { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 });
assert.deepEqual(stopChunk.settle, { cents: 6, state: "pending_operator" });
assert.equal(stopChunk.receipt?.attestation, null);
assert.equal(stopChunk.receipt?.job_id, sseJob.id);
assert.equal(stopChunk.receipt?.provider_class, "community");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const painted = await page.evaluate(() => {
      const merged = honestyFieldsFrom({
        job_id: "job_abc",
        model_id: "gemma3-27b",
        provider_class: "community",
        tokens_per_second: 2.93,
        attestation: null,
        settled: { cents: 6, state: "pending_operator" },
      });
      lastPaidReceipt = {
        tokens: 40, cents: 0, engine: "community", job_id: "job_abc123xyz",
        model: "gemma3-27b", ...merged,
      };
      paintAnswerReceipt();
      const note = document.getElementById("answer-receipt-note");
      const el = document.getElementById("answer-receipt");
      return {
        merged,
        note: (note?.textContent || "").trim(),
        noteHidden: note?.hidden === true,
        text: (el?.textContent || "").trim(),
      };
    });
    assert.equal(painted.merged.attestation, null);
    assert.equal(painted.merged.model, "gemma3-27b");
    assert.equal(painted.merged.tokens_per_second, 2.93);
    assert.equal(painted.merged.settle_cents, 6);
    assert.equal(painted.note, "no enclave · attestation N/A");
    assert.equal(painted.noteHidden, false);
    assert.match(painted.text, /Community · gemma3-27b/);
    assert.doesNotMatch(painted.text, /Caution-verifiable/);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-phase0-honesty-receipt: PASS");
