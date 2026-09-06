#!/usr/bin/env node
/**
 * Live Worker 114f0e02: Community/Mixture/self job receipt UX + visibility.
 * After Community/Mixture/self Ask, #answer-receipt stays visible
 * (keep Answer open; removeAttribute hidden; CSS display:block).
 * Paints Community|Mixture|Your Mac · model · N tok · job…
 * Never paints provider-earn cents as user $. Hosted paid settle unchanged.
 * Job GET returns honest usage + route when present.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { ComputeNetwork } from "./dasha-compute-network.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { COOKIE, createSessionToken } from "./dasha-lobby-x.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertReceiptUx(html, label) {
  assert.match(html, /id=["']answer-receipt["'][^>]*aria-live=["']polite["']/, `${label} #answer-receipt aria-live`);
  assert.match(html, /#answer-receipt:not\(\[hidden\]\)\{display:block!important\}/, `${label} receipt CSS override`);
  assert.match(html, /\.panel\[hidden\],\[hidden\]\{display:none!important\}/, `${label} hidden CSS`);
  assert.match(html, /function paintAnswerReceipt\(/, `${label} paintAnswerReceipt`);
  assert.match(html, /Keep Answer step open so receipt is actually visible/, `${label} keep-open comment`);
  assert.match(html, /if\(tfStep!=='answer'\)showTf\('answer'\)/, `${label} keep Answer step open`);
  assert.match(html, /el\.removeAttribute\(['"]hidden['"]\)/, `${label} removeAttribute hidden`);
  assert.match(html, /el\.setAttribute\(['"]hidden['"],['"]['"]\)/, `${label} setAttribute hidden`);
  assert.match(html, /paintAnswerMoney\(\);paintAnswerReceipt\(\);updateRun\(\)/, `${label} finally re-paint`);
  assert.match(html, /never show provider-earn cents as user \$/, `${label} never provider-earn cents as user $`);
  assert.match(html, /selected\/routed model id from client\/job only \(never trust answer self-description\)/, `${label} never trust answer self-description`);
  assert.match(html, /const model=String\(r\.model\|\|\$\(['"]model['"]\)\?\.value\|\|''\)\.trim\(\)/, `${label} model from receipt or select`);
  assert.match(html, /const label=eng==='mixture'\?'Mixture':eng==='self'\?'Your Mac':'Community'/, `${label} Community|Mixture|Your Mac`);
  assert.match(html, /parts\.join\(' · '\)/, `${label} · joined receipt`);
  assert.match(html, /if\(eng==='community'\|\|eng==='mixture'\|\|eng==='self'\)/, `${label} community/mixture/self branch`);
  assert.match(html, /Hosted paid settle only \(user charged\)/, `${label} hosted paid settle comment`);
  assert.match(html, /Settled \u00b7 '\+formatSettledTok\(tok\)\+' tok \u00b7 '\+formatUsdCents\(cents\)/, `${label} hosted Settled · tok · $`);
  assert.match(html, /lastPaidReceipt=\{tokens:tok,cents:0,engine:eng,job_id:String\(activeJob\|\|''\),model:String\(\$\(['"]model['"]\)\.value\|\|''\)\}/, `${label} SSE community receipt cents:0`);
  assert.match(html, /lastPaidReceipt=\{tokens:tok,cents:0,engine:eng,job_id:String\(activeJob\|\|job\.id\|\|''\),model:String\(\$\(['"]model['"]\)\.value\|\|''\)\}/, `${label} poll community receipt cents:0`);
  assert.doesNotMatch(html, /data\?\.model\|\|\$\(['"]model['"]\)\.value/, `${label} never trust data?.model`);
  assert.match(html, /lastPaidReceipt=\{tokens:tok,cents:5,engine:'hosted'\}/, `${label} hosted paid cents:5`);
  assert.match(html, /const u=data\?\.usage&&typeof data\.usage==='object'\?data\.usage:null/, `${label} poll reads job usage`);
  assert.match(html, /const u=lastSseUsage/, `${label} SSE reads lastSseUsage`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertReceiptUx(disk, "disk");
assertReceiptUx(COMPUTE_PAGE_HTML, "embed");

const servedRes = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(servedRes.status, 200);
assert.equal(servedRes.headers.get("x-dasha-edge"), "compute");
const served = await servedRes.text();
assertReceiptUx(served, "worker.fetch");

const env = { LOBBY_SESSION_SECRET: "job-receipt-ux-secret", AI: { run: async () => ({ response: "ok" }) } };
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
const session = await createSessionToken(env, { xId: "receipt-owner", handle: "receipt_ux" });
const cookie = { Cookie: `${COOKIE}=${session}` };

const queuedId = "job_queued";
await storage.put(`compute:job:${queuedId}`, {
  id: queuedId, owner: "x:receipt-owner", status: "queued", model: "qwen3-8b",
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const queued = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${queuedId}`, { headers: cookie }));
assert.equal(queued.status, 200);
const queuedBody = await queued.json();
assert.equal(queuedBody.id, queuedId);
assert.equal("usage" in queuedBody, false, "queued job omits empty usage");
assert.equal("route" in queuedBody, false, "queued job omits missing route");

const doneId = "job_done_mix";
await storage.put(`compute:job:${doneId}`, {
  id: doneId, owner: "x:receipt-owner", status: "complete", model: "qwen3-8b",
  route: "mixture", answer: "hi",
  usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
  createdAt: now, expiresAt: now + 5 * 60_000, providerId: "mac_1",
});
const done = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${doneId}`, { headers: cookie }));
assert.equal(done.status, 200);
const doneBody = await done.json();
assert.equal(doneBody.route, "mixture");
assert.deepEqual(doneBody.usage, { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 });
assert.equal(doneBody.model, "qwen3-8b");
assert.equal(doneBody.answer, "hi");

const zeroId = "job_zero_use";
await storage.put(`compute:job:${zeroId}`, {
  id: zeroId, owner: "x:receipt-owner", status: "complete", model: "gemma3-12b",
  route: "community", answer: "ok",
  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const zero = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${zeroId}`, { headers: cookie }));
assert.equal(zero.status, 200);
const zeroBody = await zero.json();
assert.equal(zeroBody.route, "community");
assert.equal("usage" in zeroBody, false, "zero usage omitted");

const selfId = "job_self_ok";
await storage.put(`compute:job:${selfId}`, {
  id: selfId, owner: "x:receipt-owner", status: "complete", model: "qwen3-8b",
  route: "self", answer: "own",
  usage: { prompt_tokens: 3, completion_tokens: 7, total_tokens: 10 },
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const selfJob = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${selfId}`, { headers: cookie }));
assert.equal((await selfJob.json()).route, "self");

const bogusId = "job_bogus_rt";
await storage.put(`compute:job:${bogusId}`, {
  id: bogusId, owner: "x:receipt-owner", status: "complete", model: "qwen3-8b",
  route: "hosted", answer: "nope",
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const bogus = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${bogusId}`, { headers: cookie }))).json();
assert.equal("route" in bogus, false, "invented route omitted");
assert.deepEqual(bogus.usage, { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 });

const lobby = {
  idFromName: () => "public",
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
const viaWorker = await worker.fetch(new Request(`https://www.getdasha.com/compute/api/jobs/${doneId}`, { headers: cookie }), workerEnv);
assert.equal(viaWorker.status, 200);
const viaBody = await viaWorker.json();
assert.equal(viaBody.route, "mixture");
assert.deepEqual(viaBody.usage, { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 });

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
        const visible = !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
        return { hidden: el?.hidden === true, text: (el?.textContent || "").trim(), visible };
      };
      const run = (receipt) => {
        lastPaidReceipt = receipt;
        paintAnswerReceipt();
        return read();
      };
      return {
        none: run(null),
        communityEarn: run({ tokens: 40, cents: 100, engine: "community", job_id: "job_abc123xyz", model: "gemma3-27b" }),
        mixture: run({ tokens: 12, cents: 7, engine: "mixture", job_id: "job_mix_1", model: "gemma3-12b" }),
        self: run({ tokens: 9, cents: 50, engine: "self", job_id: "job_self_1", model: "qwen3-8b" }),
        communityBare: (() => {
          const modelEl = document.getElementById("model");
          const prev = modelEl.value;
          modelEl.value = "";
          const out = run({ tokens: 0, cents: 25, engine: "community" });
          modelEl.value = prev;
          return out;
        })(),
        longJob: run({ tokens: 128, cents: 9, engine: "community", job_id: "job_abcdefghijklmno", model: "qwen3-8b" }),
        hostedPaid: run({ tokens: 33, cents: 5, engine: "hosted" }),
        hostedTokOnly: run({ tokens: 8, cents: 0, engine: "hosted" }),
        hostedFree: run({ tokens: 0, cents: 0, engine: "hosted" }),
      };
    });

    assert.equal(painted.none.hidden, true, "empty receipt hidden");
    assert.equal(painted.none.text, "");

    assert.equal(painted.communityEarn.hidden, false);
    assert.equal(painted.communityEarn.visible, true, "Community receipt actually visible");
    assert.equal(painted.communityEarn.text, "Community · gemma3-27b · 40 tok · job_abc123xyz");
    assert.doesNotMatch(painted.communityEarn.text, /\$/);
    assert.doesNotMatch(painted.communityEarn.text, /1\.00|Settled/);

    assert.equal(painted.mixture.hidden, false);
    assert.equal(painted.mixture.text, "Mixture · gemma3-12b · 12 tok · job_mix_1");
    assert.doesNotMatch(painted.mixture.text, /\$/);

    assert.equal(painted.self.hidden, false);
    assert.equal(painted.self.text, "Your Mac · qwen3-8b · 9 tok · job_self_1");
    assert.doesNotMatch(painted.self.text, /\$/);

    assert.equal(painted.communityBare.hidden, true, "Community with only label hides");
    assert.equal(painted.communityBare.text, "");

    assert.equal(painted.longJob.hidden, false);
    assert.equal(painted.longJob.text, "Community · qwen3-8b · 128 tok · job_abcdefghij…");
    assert.doesNotMatch(painted.longJob.text, /\$/);

    assert.equal(painted.hostedPaid.hidden, false);
    assert.equal(painted.hostedPaid.text, "Settled · 33 tok · $0.05");
    assert.equal(painted.hostedTokOnly.hidden, false);
    assert.equal(painted.hostedTokOnly.text, "Settled · 8 tok");
    assert.equal(painted.hostedFree.hidden, true, "hosted free floor stays quiet");
    assert.equal(painted.hostedFree.text, "");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-job-receipt-ux: PASS");
