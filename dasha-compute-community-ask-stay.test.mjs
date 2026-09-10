#!/usr/bin/env node
/**
 * Community Ask stay — Mac online must not slip onto Hosted /compute/api/chat.
 * Locks: Ask defaults to Community when providers_online≥1 (prefer gemma3-27b);
 * explicit Hosted stays; Community POST /compute/api/jobs includes route community;
 * Community/Mixture/self never call /compute/api/chat; empty Community completion
 * does not paint Hosted as the receipt (Community · model + No reply.).
 * In-flight Community face is A Mac is working. — never Hosted · live as the run receipt.
 * Disk == embed == worker.fetch. No wrangler. No invented Macs/prices.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertCommunityStay(html, label) {
  assert.match(html, /hostedChosenThisSession/, `${label} hostedChosenThisSession`);
  assert.match(html, /function preferAdvertisedCommunityModel\(/, `${label} preferAdvertisedCommunityModel`);
  assert.match(html, /networkModels\.has\(['"]gemma3-27b['"]\)/, `${label} prefer gemma3-27b`);
  assert.match(html, /function defaultAskEngine\(/, `${label} defaultAskEngine`);
  assert.match(html, /function enterAskEngine\(/, `${label} enterAskEngine`);
  assert.match(html, /function maybeAdoptCommunityDefault\(/, `${label} maybeAdoptCommunityDefault`);
  assert.match(html, /function paintHowEngineDoors\(/, `${label} paintHowEngineDoors`);
  assert.match(html, /if\(eng==='hosted'&&!hostedChosenThisSession\)/, `${label} warm Hosted Run adopts Community`);
  assert.match(html, /function paintCommunityWorkingFace\(/, `${label} paintCommunityWorkingFace`);
  assert.match(html, /function paintCommunityMissFace\(/, `${label} paintCommunityMissFace`);
  assert.match(html, /A Mac is working\./, `${label} A Mac is working.`);
  assert.match(html, /function scheduleSameEngineRetry\(/, `${label} scheduleSameEngineRetry`);
  assert.match(html, /else body\.route='community'/, `${label} Community job body route community`);
  assert.match(html, /if\(lastPreferAttempted\)body\.prefer_self=true/, `${label} prefer_self only when Prefer`);
  assert.match(html, /Explicit Hosted Ask only/, `${label} Hosted chat is Hosted-only`);
  assert.match(html, /Never auto-retry an empty Community completion onto Hosted/, `${label} no Hosted empty retry`);
  assert.match(html, /Hosted · live is Hosted engine status only/, `${label} Hosted · live not Community receipt`);
  assert.match(html, /bits=\['Community'\]/, `${label} Community miss title`);
  assert.match(html, /\$\(['"]answer['"]\)\.textContent='No reply\.'/, `${label} Community miss No reply.`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertCommunityStay(disk, "disk");
assertCommunityStay(COMPUTE_PAGE_HTML, "embed");

const served = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get("x-dasha-edge"), "compute");
assertCommunityStay(await served.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const adopted = await page.evaluate(() => {
      hostedChosenThisSession = false;
      hostedLive = true;
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b", "qwen3-8b"]);
      networkCapacity = [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }];
      showTf("ask");
      updateRun();
      paintHonestyPanel();
      return {
        engine: $("engine")?.value || "",
        model: $("model")?.value || "",
        change: ($("change-engine")?.textContent || "").trim(),
        hostedChip: ($("honesty-hosted")?.textContent || "").trim(),
        hostedHidden: $("honesty-hosted")?.hidden === true,
        howComPrimary: $("eng-community")?.classList.contains("primary") === true,
        howHostSecondary: $("eng-hosted")?.classList.contains("secondary") === true,
        askHosted: $("ask-hosted")?.hidden !== true,
      };
    });
    assert.equal(adopted.engine, "community", "Mac online → Community default");
    assert.equal(adopted.model, "gemma3-27b", "prefer advertised gemma3-27b");
    assert.equal(adopted.change, "Community · gemma3-27b");
    assert.equal(adopted.howComPrimary, true, "How Community ink-on-acid primary");
    assert.equal(adopted.howHostSecondary, true, "How Hosted quieter secondary");
    assert.equal(adopted.askHosted, true, "Ask Hosted quieter door");
    assert.equal(adopted.hostedHidden, true, "Hosted · live hidden on Community");
    assert.equal(adopted.hostedChip, "", "Hosted chip text cleared on Community");

    const explicit = await page.evaluate(() => {
      hostedChosenThisSession = true;
      $("engine").value = "hosted";
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b"]);
      updateRun();
      paintHonestyPanel();
      return {
        engine: $("engine")?.value || "",
        model: $("model")?.value || "",
        hostedHidden: $("honesty-hosted")?.hidden === true,
        hostedChip: ($("honesty-hosted")?.textContent || "").trim(),
      };
    });
    assert.equal(explicit.engine, "hosted", "explicit Hosted stays");
    assert.equal(explicit.model, "gpt-oss-20b");
    assert.equal(explicit.hostedHidden, false, "Hosted chip is Hosted engine status");
    assert.equal(explicit.hostedChip, "Hosted · live");

    const inflight = await page.evaluate(async () => {
      hostedChosenThisSession = false;
      loggedIn = true;
      hostedLive = true;
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b"]);
      networkCapacity = [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }];
      $("engine").value = "community";
      $("model").value = "gemma3-27b";
      $("prompt").value = "Stay on the Mac.";
      updateRun();
      window.__dashaFetchLog = [];
      window.__dashaChatCalled = false;
      const orig = window.fetch;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        window.__dashaFetchLog.push({ url: href });
        if (href.includes("/compute/api/chat")) {
          window.__dashaChatCalled = true;
          return new Response(JSON.stringify({ answer: "hosted slip", model: "gpt-4o-mini" }), {
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
        if (href.includes("/compute/api/jobs")) {
          return new Promise((_, reject) => {
            const signal = opts.signal;
            const fail = () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            };
            if (signal?.aborted) { fail(); return; }
            if (signal) signal.addEventListener("abort", fail, { once: true });
          });
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      };
      $("run-demo").disabled = false;
      $("run-demo").hidden = false;
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const answer = ($("answer")?.textContent || "").trim();
        if (answer === "A Mac is working.") break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      paintHonestyPanel();
      const chats = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/chat"));
      const snap = {
        engine: $("engine")?.value || "",
        title: ($("answer-title")?.textContent || "").trim(),
        answer: ($("answer")?.textContent || "").trim(),
        receipt: ($("answer-receipt")?.textContent || "").trim(),
        hostedChip: ($("honesty-hosted")?.textContent || "").trim(),
        hostedHidden: $("honesty-hosted")?.hidden === true,
        chatCalled: window.__dashaChatCalled === true,
        chats: chats.length,
      };
      if (runAbort) try { runAbort.abort(); } catch {}
      await new Promise((resolve) => setTimeout(resolve, 40));
      window.fetch = orig;
      return snap;
    });
    assert.equal(inflight.engine, "community", "in-flight stays Community");
    assert.equal(inflight.answer, "A Mac is working.", "in-flight face is the run");
    assert.equal(inflight.title, "Community · gemma3-27b", "in-flight title is Community · model");
    assert.equal(inflight.chatCalled, false, "in-flight does not call Hosted chat");
    assert.equal(inflight.chats, 0, "in-flight no /compute/api/chat");
    assert.doesNotMatch(inflight.receipt, /Hosted/, "in-flight receipt is not Hosted");
    assert.equal(inflight.hostedHidden, true, "Hosted · live is not the in-flight receipt");
    assert.notEqual(inflight.answer, "Hosted · live");
    assert.notEqual(inflight.title, "Hosted · live");
    assert.equal(inflight.hostedChip, "", "Hosted chip text cleared while Community runs");

    const run = await page.evaluate(async () => {
      hostedChosenThisSession = false;
      loggedIn = true;
      hostedLive = true;
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b"]);
      networkCapacity = [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }];
      $("engine").value = "community";
      $("model").value = "gemma3-27b";
      $("prompt").value = "Stay on the Mac.";
      updateRun();
      window.__dashaFetchLog = [];
      window.__dashaChatCalled = false;
      window.__dashaEmptyRetryOnce = false;
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
          return new Response(JSON.stringify({ answer: "hosted slip", model: "gpt-4o-mini" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (href.includes("/compute/api/jobs/") && /\/jobs\/[^/?]+/.test(href)) {
          return new Response(JSON.stringify({ status: "complete", answer: "", model: "gemma3-27b", route: "community" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (href.includes("/compute/api/jobs")) {
          return new Response("", {
            status: 200,
            headers: { "content-type": "text/event-stream", "X-Dasha-Job": "job_empty1" },
          });
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      };
      $("run-demo").disabled = false;
      $("run-demo").hidden = false;
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const title = ($("answer-title")?.textContent || "");
        const answer = ($("answer")?.textContent || "");
        if (title.includes("Community") && answer.includes("No reply.") && window.__dashaEmptyRetryOnce === false) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      window.fetch = orig;
      paintHonestyPanel();
      const jobs = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/jobs") && !/\/jobs\/[^/?]+/.test(row.url));
      const chats = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/chat"));
      let jobBody = null;
      try { jobBody = jobs[0]?.body ? JSON.parse(jobs[0].body) : null; } catch { jobBody = null; }
      return {
        engine: $("engine")?.value || "",
        title: ($("answer-title")?.textContent || "").trim(),
        answer: ($("answer")?.textContent || "").trim(),
        receipt: ($("answer-receipt")?.textContent || "").trim(),
        hostedChip: ($("honesty-hosted")?.textContent || "").trim(),
        hostedHidden: $("honesty-hosted")?.hidden === true,
        chatCalled: window.__dashaChatCalled === true,
        chats: chats.length,
        jobs: jobs.length,
        jobBody,
      };
    });
    assert.equal(run.engine, "community", "Community-selected run stays Community");
    assert.equal(run.chatCalled, false, "Community run does not call hosted chat");
    assert.equal(run.chats, 0, "no /compute/api/chat from Community");
    assert.ok(run.jobs >= 1, "Community POST /compute/api/jobs");
    assert.equal(run.jobBody?.route, "community", "job body route community");
    assert.equal(run.jobBody?.stream, true, "job body stream true");
    assert.equal(run.jobBody?.model, "gemma3-27b", "job body live model");
    assert.equal(run.jobBody?.prefer_self, undefined, "prefer_self off unless Prefer");
    assert.equal(run.title, "Community · gemma3-27b", "miss face says Community · model");
    assert.equal(run.answer, "No reply.", "miss face No reply.");
    assert.doesNotMatch(run.receipt, /Hosted/, "receipt is not Hosted");
    assert.equal(run.hostedHidden, true, "Hosted · live is not the answer receipt");
    assert.notEqual(run.answer, "Hosted · live");
    assert.notEqual(run.title, "Hosted · live");

    const warm = await page.evaluate(async () => {
      hostedChosenThisSession = false;
      noMacHostedFallback = false;
      loggedIn = true;
      hostedLive = true;
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b"]);
      networkCapacity = [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }];
      $("engine").value = "hosted";
      $("model").value = "gpt-oss-20b";
      $("prompt").value = "Use the warm Mac.";
      showTf("ask");
      updateRun();
      window.__dashaFetchLog = [];
      window.__dashaChatCalled = false;
      window.__dashaJobsCalled = false;
      const orig = window.fetch;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        let body = opts.body;
        if (typeof body !== "string") {
          try { body = body ? JSON.stringify(body) : ""; } catch { body = ""; }
        }
        window.__dashaFetchLog.push({ url: href, method: String(opts.method || "GET").toUpperCase(), body: String(body || "") });
        if (href.includes("/compute/api/chat")) {
          window.__dashaChatCalled = true;
          return new Response(JSON.stringify({ answer: "hosted slip", model: "gpt-oss-20b" }), {
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
        if (href.includes("/compute/api/jobs")) {
          window.__dashaJobsCalled = true;
          return new Response(JSON.stringify({ error: "No reply." }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      };
      $("run-demo").disabled = false;
      $("run-demo").hidden = false;
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        if (window.__dashaJobsCalled || window.__dashaChatCalled) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      window.fetch = orig;
      const jobs = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/jobs") && row.method === "POST");
      let jobBody = null;
      try { jobBody = jobs[0]?.body ? JSON.parse(jobs[0].body) : null; } catch { jobBody = null; }
      return {
        engine: $("engine")?.value || "",
        chatCalled: window.__dashaChatCalled === true,
        jobs: jobs.length,
        jobBody,
      };
    });
    assert.equal(warm.engine, "community", "warm Hosted Run adopts Community");
    assert.equal(warm.chatCalled, false, "warm Run does not quietly Hosted chat");
    assert.ok(warm.jobs >= 1, "warm Run POSTs Community jobs");
    assert.equal(warm.jobBody?.route, "community", "warm Run job route community");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-community-ask-stay: PASS");
