#!/usr/bin/env node
/**
 * Community Ask stream resume — dropped SSE (~30–45s / Failed to fetch) is not
 * "the network is down" while GET /compute/api/network still lists the Mac.
 * Same community job once. Never Hosted /compute/api/chat. No reply. + job id.
 * Disk == embed == worker.fetch. No wrangler. No invented tok/s.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import {
  ComputeNetwork,
  SSE_BUYER_HOLD_MS,
  keepBuyerJobOnStreamDrop,
} from "./dasha-compute-network.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertStreamResume(html, label) {
  assert.match(html, /function isAskNetworkDrop\(/, `${label} isAskNetworkDrop`);
  assert.match(html, /function resumeSameCommunityJob\(/, `${label} resumeSameCommunityJob`);
  assert.match(html, /function recoverCommunityStream\(/, `${label} recoverCommunityStream`);
  assert.match(html, /function paintCommunityStillOnline\(/, `${label} paintCommunityStillOnline`);
  assert.match(html, /function paintCommunityNoReply\(/, `${label} paintCommunityNoReply`);
  assert.match(html, /Still online\./, `${label} Still online.`);
  assert.match(html, /No reply\.\\n'\+job/, `${label} No reply. + job id`);
  assert.match(html, /code==='stream_drop'/, `${label} stream_drop`);
  assert.match(html, /Never Hosted \/compute\/api\/chat/, `${label} never Hosted chat`);
  assert.match(html, /Dropped Community SSE is not "the network is down"/, `${label} not network-down`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertStreamResume(disk, "disk");
assertStreamResume(COMPUTE_PAGE_HTML, "embed");

const served = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get("x-dasha-edge"), "compute");
assertStreamResume(await served.text(), "worker.fetch");

assert.equal(SSE_BUYER_HOLD_MS, 35_000, "buyer SSE hold sits in the 30–45s window");

const now = Date.now();
const fresh = [{ lastSeenAt: now, models: ["gemma3-27b"] }];
const stale = [{ lastSeenAt: now - 60_000, models: ["gemma3-27b"] }];
const queued = { id: "job_hold1", status: "queued", model: "gemma3-27b" };
const leased = { id: "job_hold2", status: "leased", model: "gemma3-27b" };
assert.equal(keepBuyerJobOnStreamDrop(queued, fresh, now), true);
assert.equal(keepBuyerJobOnStreamDrop(leased, fresh, now), true);
assert.equal(keepBuyerJobOnStreamDrop(queued, stale, now), false, "stale Mac is not advertising");
assert.equal(keepBuyerJobOnStreamDrop({ ...queued, status: "complete" }, fresh, now), false);
assert.equal(keepBuyerJobOnStreamDrop(queued, [], now), false);

function memoryStorage(rows = new Map()) {
  return {
    rows,
    async get(key) { return rows.get(key); },
    async put(key, value) {
      if (typeof key === "object") for (const [name, item] of Object.entries(key)) rows.set(name, item);
      else rows.set(key, value);
    },
    async delete(key) { rows.delete(key); },
    async list({ prefix = "" } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
  };
}

{
  const rows = new Map();
  const storage = memoryStorage(rows);
  const job = {
    id: "job_freshdrop",
    owner: "x:ask",
    model: "gemma3-27b",
    route: "community",
    stream: true,
    status: "leased",
    messages: [{ role: "user", content: "warm ping" }],
    chunks: [],
    createdAt: now,
    expiresAt: now + 60_000,
  };
  rows.set(`compute:job:${job.id}`, structuredClone(job));
  rows.set("compute:provider:mac_live", { id: "mac_live", lastSeenAt: now, models: ["gemma3-27b"] });
  const reader = new ComputeNetwork({ storage }, {}).streamResponse(job).body.getReader();
  await reader.cancel();
  const kept = rows.get(`compute:job:${job.id}`);
  assert.equal(kept.status, "leased", "fresh Mac: cancel must keep the leased job");
  assert.equal(kept.messages?.[0]?.content, "warm ping");
}

{
  const rows = new Map();
  const storage = memoryStorage(rows);
  const job = {
    id: "job_staledrop",
    owner: "x:ask",
    model: "gemma3-27b",
    stream: true,
    status: "leased",
    messages: [{ role: "user", content: "forget me" }],
    chunks: ["partial"],
    createdAt: now,
    expiresAt: now + 60_000,
  };
  rows.set(`compute:job:${job.id}`, structuredClone(job));
  const reader = new ComputeNetwork({ storage }, {}).streamResponse(job).body.getReader();
  await reader.cancel();
  const stored = rows.get(`compute:job:${job.id}`);
  assert.equal(stored.status, "cancelled", "no advertising Mac: disconnect still cancels");
}

{
  const rows = new Map();
  const storage = memoryStorage(rows);
  const job = {
    id: "job_hold35",
    owner: "x:ask",
    model: "gemma3-27b",
    route: "community",
    stream: true,
    status: "queued",
    chunks: [],
    createdAt: now,
    expiresAt: now + 60_000,
  };
  rows.set(`compute:job:${job.id}`, structuredClone(job));
  rows.set("compute:provider:mac_live", { id: "mac_live", lastSeenAt: Date.now(), models: ["gemma3-27b"] });
  const text = await new ComputeNetwork({ storage }, {}).streamResponse(job, null, {}, { holdMs: 20, keepaliveMs: 0 }).text();
  assert.match(text, /: keepalive/, "first-byte keepalive so idle SSE is not silent");
  assert.match(text, /"resume":true/);
  assert.match(text, /"id":"job_hold35"/);
  assert.doesNotMatch(text, /request timed out/);
  assert.doesNotMatch(text, /Failed to fetch/);
  const kept = rows.get(`compute:job:${job.id}`);
  assert.equal(kept.status, "queued", "hold close must leave the job queued");
}

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const recovered = await page.evaluate(async () => {
      hostedChosenThisSession = false;
      loggedIn = true;
      hostedLive = true;
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b"]);
      networkCapacity = [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }];
      $("engine").value = "community";
      $("model").value = "gemma3-27b";
      $("prompt").value = "warm ping";
      updateRun();
      window.__dashaFetchLog = [];
      window.__dashaChatCalled = false;
      window.__dashaStreamResumeOnce = false;
      const orig = window.fetch;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        let body = opts.body;
        if (typeof body !== "string") {
          try { body = body ? JSON.stringify(body) : ""; } catch { body = ""; }
        }
        window.__dashaFetchLog.push({ url: href, body: String(body || "") });
        if (href.includes("/compute/api/chat")) {
          window.__dashaChatCalled = true;
          return new Response(JSON.stringify({ answer: "hosted slip" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (href.includes("/compute/api/network")) {
          return new Response(JSON.stringify({
            providers_online: 1,
            models_available: ["gemma3-27b"],
            capacity: [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (href.includes("/compute/api/jobs/") && /\/jobs\/[^/?]+/.test(href)) {
          return new Response(JSON.stringify({
            id: "job_live44",
            status: "complete",
            answer: "pong from the Mac",
            model: "gemma3-27b",
            route: "community",
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (href.includes("/compute/api/jobs")) {
          const method = String(opts.method || "GET").toUpperCase();
          if (method === "GET" || method === "HEAD") {
            return new Response(JSON.stringify({
              jobs: [{ id: "job_live44", status: "queued", model: "gemma3-27b" }],
            }), { status: 200, headers: { "content-type": "application/json" } });
          }
          const err = new Error("Failed to fetch");
          err.name = "TypeError";
          throw err;
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      };
      $("run-demo").disabled = false;
      $("run-demo").hidden = false;
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const answer = ($("answer")?.textContent || "");
        if (answer.includes("pong from the Mac")) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      window.fetch = orig;
      const jobsPost = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/jobs") && !/\/jobs\/[^/?]+/.test(row.url));
      const jobsGet = (window.__dashaFetchLog || []).filter((row) => /\/compute\/api\/jobs\/[^/?]+/.test(row.url));
      const chats = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/chat"));
      return {
        engine: $("engine")?.value || "",
        title: ($("answer-title")?.textContent || "").trim(),
        answer: ($("answer")?.textContent || "").trim(),
        chatCalled: window.__dashaChatCalled === true,
        chats: chats.length,
        jobsPost: jobsPost.length,
        jobsGet: jobsGet.length,
        resumed: window.__dashaStreamResumeOnce === true,
      };
    });
    assert.equal(recovered.engine, "community", "stays Community");
    assert.equal(recovered.chatCalled, false, "no Hosted chat");
    assert.equal(recovered.chats, 0, "no /compute/api/chat");
    assert.ok(recovered.jobsPost >= 1, "first POST /compute/api/jobs");
    assert.ok(recovered.jobsGet >= 1, "resume GET same job");
    assert.equal(recovered.resumed, true, "same-job resume once");
    assert.match(recovered.answer, /pong from the Mac/, "resumed Community answer");
    assert.doesNotMatch(recovered.answer, /Failed to fetch|network error/i, "no network-error face while Mac online");

    const missed = await page.evaluate(async () => {
      hostedChosenThisSession = false;
      loggedIn = true;
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b"]);
      $("engine").value = "community";
      $("model").value = "gemma3-27b";
      $("prompt").value = "warm ping";
      window.__dashaFetchLog = [];
      window.__dashaChatCalled = false;
      window.__dashaStreamResumeOnce = false;
      const orig = window.fetch;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        window.__dashaFetchLog.push({ url: href });
        if (href.includes("/compute/api/chat")) {
          window.__dashaChatCalled = true;
          return new Response(JSON.stringify({ answer: "hosted slip" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (href.includes("/compute/api/network")) {
          return new Response(JSON.stringify({
            providers_online: 1,
            models_available: ["gemma3-27b"],
            capacity: [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (href.includes("/compute/api/jobs/") && /\/jobs\/[^/?]+/.test(href)) {
          const err = new Error("Failed to fetch");
          err.name = "TypeError";
          throw err;
        }
        if (href.includes("/compute/api/jobs")) {
          return new Response("", {
            status: 200,
            headers: { "content-type": "text/event-stream", "X-Dasha-Job": "job_live44" },
          });
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      };
      $("run-demo").disabled = false;
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const answer = ($("answer")?.textContent || "");
        if (answer.includes("No reply.") && answer.includes("job_live44")) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      window.fetch = orig;
      const chats = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/chat"));
      return {
        engine: $("engine")?.value || "",
        title: ($("answer-title")?.textContent || "").trim(),
        answer: ($("answer")?.textContent || "").trim(),
        chats: chats.length,
        chatCalled: window.__dashaChatCalled === true,
      };
    });
    assert.equal(missed.engine, "community", "miss stays Community");
    assert.equal(missed.chatCalled, false, "miss does not steal Hosted");
    assert.equal(missed.chats, 0);
    assert.equal(missed.title, "Community · gemma3-27b");
    assert.match(missed.answer, /No reply\./);
    assert.match(missed.answer, /job_live44/);
    assert.doesNotMatch(missed.answer, /Failed to fetch|network error/i);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-community-ask-stream-resume: PASS");
