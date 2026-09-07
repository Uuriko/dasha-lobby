#!/usr/bin/env node
/**
 * Live Worker 00708579: per-job settle receipt (Phase 0 honest Receipt Event).
 * Community/mixture job complete accrues first, then stamps settle_cents +
 * settle_state:'pending_operator'. GET /jobs/:id and final SSE stop chunk
 * include settle:{cents,state} when known; omit when unknown. Self-route
 * never invents. Ask receipt paints · M¢ · pending operator settle (or settled)
 * only when both fields known — fail closed. Never show provider-earn as user $.
 * No Nitro claim.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { ComputeNetwork, publicJobSettle } from "./dasha-compute-network.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { COOKIE, createSessionToken } from "./dasha-lobby-x.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
const networkSrc = readFileSync(join(root, "dasha-compute-network.mjs"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertSettleReceipt(html, label) {
  assert.match(html, /function settleFieldsFrom\(/, `${label} settleFieldsFrom`);
  assert.match(html, /lastSseSettle=null/, `${label} lastSseSettle`);
  assert.match(html, /if\(payload\?\.settle&&typeof payload\.settle==='object'\)lastSseSettle=payload\.settle/, `${label} capture SSE settle`);
  assert.match(html, /never invent cents/, `${label} never invent cents`);
  assert.match(html, /Quiet settle face only when job\/usage JSON provided settle_cents \+ settle_state \(fail closed\)/, `${label} fail closed`);
  assert.match(html, /never show provider-earn cents as user \$/, `${label} never provider-earn as user $`);
  assert.match(html, /pending operator settle/, `${label} pending operator settle`);
  assert.match(html, /settleState==='settled'\|\|settleState==='paid'\?'settled':'pending operator settle'/, `${label} settled vs pending`);
  assert.match(html, /lastPaidReceipt=\{tokens:tok,cents:5,engine:'hosted',settle_cents:5,settle_state:'settled'\}/, `${label} hosted charged settled`);
  assert.match(html, /Advertising only \(providers_online\)/, `${label} honesty advertising only`);
  assert.match(html, /never pad enrolled OCM/, `${label} never pad enrolled OCM`);
  assert.doesNotMatch(html, /Nitro/, `${label} no Nitro claim`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertSettleReceipt(disk, "disk");
assertSettleReceipt(COMPUTE_PAGE_HTML, "embed");

const servedRes = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(servedRes.status, 200);
assertSettleReceipt(await servedRes.text(), "worker.fetch");

assert.match(networkSrc, /export function publicJobSettle\(/);
assert.match(networkSrc, /settle_state: 'pending_operator'/);
assert.match(networkSrc, /const accrued = await accrueProviderEarn/);
assert.match(networkSrc, /job\.route !== 'self'/);
assert.match(networkSrc, /\.\.\.\(settle \? \{ settle \} : \{\}\)/);
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/);

assert.deepEqual(publicJobSettle({ settle_cents: 6, settle_state: "pending_operator" }), { cents: 6, state: "pending_operator" });
assert.deepEqual(publicJobSettle({ settle_cents: 5, settle_state: "settled" }), { cents: 5, state: "settled" });
assert.equal(publicJobSettle({ settle_cents: 6 }), null, "cents without state omitted");
assert.equal(publicJobSettle({ settle_state: "pending_operator" }), null, "state without cents omitted");
assert.equal(publicJobSettle({ settle_cents: 0, settle_state: "pending_operator" }), null, "zero cents omitted");
assert.equal(publicJobSettle({}), null);
assert.equal(publicJobSettle(null), null);

const env = { LOBBY_SESSION_SECRET: "job-settle-receipt-secret", AI: { run: async () => ({ response: "ok" }) } };
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
const session = await createSessionToken(env, { xId: "settle-owner", handle: "settle_rx" });
const cookie = { Cookie: `${COOKIE}=${session}` };
const origin = "https://www.getdasha.com";
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, "Content-Type": "application/json" };

const knownId = "job_settle_ok";
await storage.put(`compute:job:${knownId}`, {
  id: knownId, owner: "x:settle-owner", status: "complete", model: "qwen3-8b",
  route: "community", answer: "hi",
  usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
  settle_cents: 6, settle_state: "pending_operator",
  createdAt: now, expiresAt: now + 5 * 60_000, providerId: "mac_1",
});
const known = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${knownId}`, { headers: cookie }));
assert.equal(known.status, 200);
const knownBody = await known.json();
assert.deepEqual(knownBody.settle, { cents: 6, state: "pending_operator" });
assert.equal(knownBody.route, "community");

const unknownId = "job_settle_no";
await storage.put(`compute:job:${unknownId}`, {
  id: unknownId, owner: "x:settle-owner", status: "complete", model: "qwen3-8b",
  route: "community", answer: "ok",
  usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const unknown = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${unknownId}`, { headers: cookie }))).json();
assert.equal("settle" in unknown, false, "unknown settle omitted");

const zeroId = "job_settle_zero";
await storage.put(`compute:job:${zeroId}`, {
  id: zeroId, owner: "x:settle-owner", status: "complete", model: "qwen3-8b",
  route: "mixture", answer: "z",
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  settle_cents: 0, settle_state: "pending_operator",
  createdAt: now, expiresAt: now + 5 * 60_000,
});
assert.equal("settle" in await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${zeroId}`, { headers: cookie }))).json(), false, "zero cents omitted");

const selfStoredId = "job_self_stored";
await storage.put(`compute:job:${selfStoredId}`, {
  id: selfStoredId, owner: "x:settle-owner", status: "complete", model: "qwen3-8b",
  route: "self", answer: "own",
  usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const selfStored = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${selfStoredId}`, { headers: cookie }))).json();
assert.equal(selfStored.route, "self");
assert.equal("settle" in selfStored, false, "self stored without settle omits");

const sseJob = {
  id: "job_sse_settle", owner: "x:settle-owner", status: "complete", model: "qwen3-8b",
  route: "community", stream: true, chunks: ["hi"],
  usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
  settle_cents: 6, settle_state: "pending_operator",
  createdAt: now, expiresAt: now + 5 * 60_000,
};
await storage.put(`compute:job:${sseJob.id}`, sseJob);
const sseRes = network.streamResponse(sseJob);
assert.match(sseRes.headers.get("content-type") || "", /text\/event-stream/);
const sseText = await sseRes.text();
const stopChunk = [...sseText.matchAll(/^data: (\{.*\})\s*$/gm)]
  .map((m) => JSON.parse(m[1]))
  .find((c) => c?.choices?.[0]?.finish_reason === "stop");
assert.ok(stopChunk, "SSE stop chunk");
assert.deepEqual(stopChunk.usage, { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 });
assert.deepEqual(stopChunk.settle, { cents: 6, state: "pending_operator" });

const sseBare = {
  id: "job_sse_bare", owner: "x:settle-owner", status: "complete", model: "qwen3-8b",
  route: "self", stream: true, chunks: ["yo"],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  createdAt: now, expiresAt: now + 5 * 60_000,
};
await storage.put(`compute:job:${sseBare.id}`, sseBare);
const bareText = await network.streamResponse(sseBare).text();
const bareStop = [...bareText.matchAll(/^data: (\{.*\})\s*$/gm)]
  .map((m) => JSON.parse(m[1]))
  .find((c) => c?.choices?.[0]?.finish_reason === "stop");
assert.ok(bareStop);
assert.equal("settle" in bareStop, false, "SSE omits settle when unknown");

const register = await network.fetch(new Request("https://lobby.getdasha.com/compute/api/providers/register", {
  method: "POST", headers: userHeaders, body: JSON.stringify({ name: "Settle Mac", models: ["qwen3-8b"] }),
}), origin);
assert.equal(register.status, 201);
const credentials = await register.json();
const providerHeaders = { Authorization: `Bearer ${credentials.provider_token}`, "Content-Type": "application/json" };

const accrueId = "job_accrue_first";
await storage.put(`compute:job:${accrueId}`, {
  id: accrueId, owner: "x:settle-owner", model: "qwen3-8b", route: "community", stream: false,
  status: "leased", providerId: credentials.provider_id,
  leaseExpiresAt: now + 60_000, expiresAt: now + 120_000, createdAt: now, messages: null,
});
assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${accrueId}/result`, {
  method: "POST", headers: providerHeaders,
  body: JSON.stringify({
    provider_id: credentials.provider_id,
    content: "accrue then stamp",
    usage: { prompt_tokens: 10, completion_tokens: 1000, total_tokens: 1010 },
  }),
}), origin)).status, 202);
const accruedJob = await storage.get(`compute:job:${accrueId}`);
assert.equal(accruedJob.settle_cents, 6, "accrue first then stamp cents");
assert.equal(accruedJob.settle_state, "pending_operator");
assert.equal((await storage.get(`compute:provider-earn:${credentials.provider_id}`)).usdc_cents, 6);
const accruedGet = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${accrueId}`, { headers: cookie }))).json();
assert.deepEqual(accruedGet.settle, { cents: 6, state: "pending_operator" });

const mixId = "job_mix_chunk";
await storage.put(`compute:job:${mixId}`, {
  id: mixId, owner: "x:settle-owner", model: "qwen3-8b", route: "mixture", stream: true,
  status: "leased", providerId: credentials.provider_id, chunks: [],
  leaseExpiresAt: now + 60_000, expiresAt: now + 120_000, createdAt: now, messages: null,
});
assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${mixId}/chunk`, {
  method: "POST", headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, delta: "mix ", done: false }),
}), origin)).status, 202);
assert.equal("settle_cents" in (await storage.get(`compute:job:${mixId}`)), false, "mid-stream no settle");
assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${mixId}/chunk`, {
  method: "POST", headers: providerHeaders,
  body: JSON.stringify({
    provider_id: credentials.provider_id, delta: "ok", done: true,
    usage: { prompt_tokens: 2, completion_tokens: 0, total_tokens: 2 },
  }),
}), origin)).status, 202);
const mixJob = await storage.get(`compute:job:${mixId}`);
assert.equal(mixJob.settle_cents, 5);
assert.equal(mixJob.settle_state, "pending_operator");

const selfId = "job_self_no_invent";
await storage.put(`compute:job:${selfId}`, {
  id: selfId, owner: "x:settle-owner", model: "qwen3-8b", route: "self", stream: false,
  status: "leased", providerId: credentials.provider_id,
  leaseExpiresAt: now + 60_000, expiresAt: now + 120_000, createdAt: now, messages: null,
});
assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${selfId}/result`, {
  method: "POST", headers: providerHeaders,
  body: JSON.stringify({
    provider_id: credentials.provider_id,
    content: "own mac",
    usage: { prompt_tokens: 4, completion_tokens: 8, total_tokens: 12 },
  }),
}), origin)).status, 202);
const selfJob = await storage.get(`compute:job:${selfId}`);
assert.equal("settle_cents" in selfJob, false, "self-route never invents settle_cents");
assert.equal("settle_state" in selfJob, false, "self-route never invents settle_state");
const selfGet = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${selfId}`, { headers: cookie }))).json();
assert.equal(selfGet.route, "self");
assert.equal("settle" in selfGet, false, "self GET omits settle");

const failId = "job_fail_no_settle";
await storage.put(`compute:job:${failId}`, {
  id: failId, owner: "x:settle-owner", model: "qwen3-8b", route: "community", stream: false,
  status: "leased", providerId: credentials.provider_id,
  leaseExpiresAt: now + 60_000, expiresAt: now + 120_000, createdAt: now, messages: null,
});
assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${failId}/result`, {
  method: "POST", headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, error: "provider failed" }),
}), origin)).status, 202);
assert.equal("settle_cents" in (await storage.get(`compute:job:${failId}`)), false, "failed job omits settle");

const lobby = {
  idFromName: () => "public",
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
const viaWorker = await worker.fetch(new Request(`https://www.getdasha.com/compute/api/jobs/${accrueId}`, { headers: cookie }), workerEnv);
assert.equal(viaWorker.status, 200);
assert.deepEqual((await viaWorker.json()).settle, { cents: 6, state: "pending_operator" });

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
      const read = () => {
        const el = document.getElementById("answer-receipt");
        return { hidden: el?.hidden === true, text: (el?.textContent || "").trim() };
      };
      const run = (receipt) => {
        lastPaidReceipt = receipt;
        paintAnswerReceipt();
        return read();
      };
      return {
        fromFn: settleFieldsFrom({ cents: 6, state: "pending_operator" }),
        fromNested: settleFieldsFrom({ settle_cents: 6, settle_state: "settled" }),
        omitCents: settleFieldsFrom({ state: "pending_operator" }),
        omitState: settleFieldsFrom({ cents: 6 }),
        omitZero: settleFieldsFrom({ cents: 0, state: "pending_operator" }),
        communityEarn: run({ tokens: 40, cents: 100, engine: "community", job_id: "job_abc123xyz", model: "gemma3-27b" }),
        pending: run({ tokens: 40, cents: 100, engine: "community", job_id: "job_abc123xyz", model: "gemma3-27b", settle_cents: 6, settle_state: "pending_operator" }),
        settled: run({ tokens: 12, cents: 7, engine: "mixture", job_id: "job_mix_1", model: "gemma3-12b", settle_cents: 5, settle_state: "settled" }),
        paid: run({ tokens: 9, cents: 50, engine: "self", job_id: "job_self_1", model: "qwen3-8b", settle_cents: 5, settle_state: "paid" }),
        hosted: run({ tokens: 33, cents: 5, engine: "hosted", settle_cents: 5, settle_state: "settled" }),
      };
    });

    assert.deepEqual(painted.fromFn, { settle_cents: 6, settle_state: "pending_operator" });
    assert.deepEqual(painted.fromNested, { settle_cents: 6, settle_state: "settled" });
    assert.deepEqual(painted.omitCents, {});
    assert.deepEqual(painted.omitState, {});
    assert.deepEqual(painted.omitZero, {});

    assert.equal(painted.communityEarn.text, "Community · gemma3-27b · 40 tok · job_abc123xyz");
    assert.doesNotMatch(painted.communityEarn.text, /\$|¢|pending operator settle/);

    assert.equal(painted.pending.text, "Community · gemma3-27b · 40 tok · job_abc123xyz · 6¢ · pending operator settle");
    assert.doesNotMatch(painted.pending.text, /\$/);

    assert.equal(painted.settled.text, "Mixture · gemma3-12b · 12 tok · job_mix_1 · 5¢ · settled");
    assert.equal(painted.paid.text, "Your Mac · qwen3-8b · 9 tok · job_self_1 · 5¢ · settled");
    assert.doesNotMatch(painted.paid.text, /\$/);

    assert.equal(painted.hosted.text, "Settled · 33 tok · $0.05");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-job-settle-receipt: PASS");
