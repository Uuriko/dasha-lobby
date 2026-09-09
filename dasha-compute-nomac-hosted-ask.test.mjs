#!/usr/bin/env node
/**
 * Community/Mixture Ask miss → Hosted. No Mac / model not advertised.
 * Face: "No Mac online. Hosted." Receipt Hosted. Mac advertising stays jobs POST.
 * Self stays fail-closed. Does not rewrite #122 stream resume.
 * Disk == embed == worker.fetch. No wrangler. No invented tokens/tok/s.
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

function assertNoMacHosted(html, label) {
  assert.match(html, /function communityMacAdvertisesSelected\(/, `${label} communityMacAdvertisesSelected`);
  assert.match(html, /function paintNoMacHostedFace\(/, `${label} paintNoMacHostedFace`);
  assert.match(html, /function adoptHostedNoMacFallback\(/, `${label} adoptHostedNoMacFallback`);
  assert.match(html, /function runHostedAsk\(/, `${label} runHostedAsk`);
  assert.match(html, /No Mac online\. Hosted\./, `${label} No Mac online. Hosted.`);
  assert.match(html, /await refreshCommunityOnline\(\)/, `${label} refresh network before Community/Mixture Ask`);
  assert.match(html, /if\(!communityMacAdvertisesSelected\(\)\)/, `${label} miss checks advertise`);
  assert.match(html, /Your Mac is offline\./, `${label} self fail-closed`);
  assert.match(html, /function recoverCommunityStream\(/, `${label} #122 resume stays`);
  assert.match(html, /Never Hosted \/compute\/api\/chat/, `${label} resume never Hosted chat`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertNoMacHosted(disk, "disk");
assertNoMacHosted(COMPUTE_PAGE_HTML, "embed");

const served = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get("x-dasha-edge"), "compute");
assertNoMacHosted(await served.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    async function runAsk(setup) {
      return page.evaluate(async (cfg) => {
        hostedChosenThisSession = false;
        loggedIn = true;
        hostedLive = true;
        noMacHostedFallback = false;
        threadRoute = "";
        stayAskChat = false;
        conversation = [];
        lastPaidReceipt = null;
        sent = 0;
        if ($("answer-title")) $("answer-title").textContent = "Answer.";
        if ($("answer")) $("answer").textContent = "";
        renderConversation();
        providersOnline = cfg.providersOnline;
        networkModels = new Set(cfg.models);
        networkCapacity = cfg.capacity || [];
        ownMacOnline = cfg.ownMacOnline || 0;
        ownMacModels = new Set(cfg.ownMacModels || []);
        $("engine").value = cfg.engine;
        $("model").value = cfg.model;
        $("prompt").value = cfg.prompt;
        updateRun();
        if (cfg.keepModel) $("model").value = cfg.model;
        if (cfg.keepEngine) $("engine").value = cfg.engine;
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
            return new Response(JSON.stringify({ answer: "hosted floor", model: "gpt-oss-20b" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (href.includes("/compute/api/network")) {
            return new Response(JSON.stringify({
              providers_online: cfg.netProviders,
              models_available: cfg.netModels,
              capacity: cfg.capacity || [],
            }), { status: 200, headers: { "content-type": "application/json" } });
          }
          if (href.includes("/compute/api/jobs")) {
            window.__dashaJobsCalled = true;
            return new Response(JSON.stringify({ error: "No Mac is online." }), {
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
          const title = ($("answer-title")?.textContent || "");
          const answer = ($("answer")?.textContent || "");
          const chats = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/chat"));
          const jobs = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/jobs") && row.method === "POST");
          if (cfg.waitOffline && answer.includes("Your Mac is offline.")) break;
          if (cfg.waitJobs && jobs.length >= 1) break;
          if (chats.length >= 1 && title.includes("No Mac online. Hosted.")) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        window.fetch = orig;
        const jobs = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/jobs") && row.method === "POST");
        const chats = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/chat"));
        const nets = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/network"));
        return {
          engine: $("engine")?.value || "",
          model: $("model")?.value || "",
          title: ($("answer-title")?.textContent || "").trim(),
          answer: ($("answer")?.textContent || "").trim(),
          receipt: ($("answer-receipt")?.textContent || "").trim(),
          chatCalled: window.__dashaChatCalled === true,
          jobsCalled: window.__dashaJobsCalled === true,
          chats: chats.length,
          jobs: jobs.length,
          nets: nets.length,
          fallback: noMacHostedFallback === true,
        };
      }, setup);
    }

    const zero = await runAsk({
      engine: "community",
      model: "gemma3-27b",
      prompt: "hello from an empty fleet",
      providersOnline: 0,
      models: [],
      netProviders: 0,
      netModels: [],
    });
    assert.equal(zero.engine, "hosted", "0 Macs → Hosted engine");
    assert.equal(zero.model, "gpt-oss-20b", "Hosted model after miss");
    assert.equal(zero.title, "No Mac online. Hosted.", "buyer face");
    assert.match(zero.answer, /hosted floor/, "runs Hosted chat");
    assert.equal(zero.chatCalled, true, "POST /compute/api/chat");
    assert.ok(zero.chats >= 1, "Hosted chat called");
    assert.equal(zero.jobs, 0, "no jobs POST when no Mac");
    assert.equal(zero.jobsCalled, false, "no Community jobs on empty fleet");
    assert.ok(zero.nets >= 1, "refreshes /compute/api/network");
    assert.doesNotMatch(zero.receipt, /Community/, "receipt is not Community");
    assert.equal(zero.fallback, true);

    const missing = await runAsk({
      engine: "mixture",
      model: "qwen3-8b",
      prompt: "hello from a missing model",
      providersOnline: 1,
      models: ["gemma3-27b"],
      netProviders: 1,
      netModels: ["gemma3-27b"],
      capacity: [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }],
      keepModel: true,
    });
    assert.equal(missing.engine, "hosted", "model missing → Hosted");
    assert.equal(missing.title, "No Mac online. Hosted.", "model-miss face");
    assert.match(missing.answer, /hosted floor/);
    assert.equal(missing.chatCalled, true);
    assert.equal(missing.jobs, 0, "no jobs POST when model not advertised");
    assert.doesNotMatch(missing.receipt, /Community|Mixture/, "receipt stays Hosted");

    const live = await page.evaluate(async () => {
      hostedChosenThisSession = false;
      loggedIn = true;
      hostedLive = true;
      noMacHostedFallback = false;
      threadRoute = "";
      stayAskChat = false;
      conversation = [];
      lastPaidReceipt = null;
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b"]);
      networkCapacity = [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }];
      $("engine").value = "community";
      $("model").value = "gemma3-27b";
      $("prompt").value = "stay on the Mac";
      updateRun();
      window.__dashaFetchLog = [];
      window.__dashaChatCalled = false;
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
            status: "complete",
            answer: "pong from the Mac",
            model: "gemma3-27b",
            route: "community",
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (href.includes("/compute/api/jobs")) {
          return new Response("", {
            status: 200,
            headers: { "content-type": "text/event-stream", "X-Dasha-Job": "job_live1" },
          });
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      };
      $("run-demo").disabled = false;
      $("run-demo").hidden = false;
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const answer = ($("answer")?.textContent || "");
        if (answer.includes("pong from the Mac") || answer.includes("No reply.")) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      window.fetch = orig;
      const jobs = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/jobs") && row.method === "POST");
      const chats = (window.__dashaFetchLog || []).filter((row) => row.url.includes("/compute/api/chat"));
      let jobBody = null;
      try { jobBody = jobs[0]?.body ? JSON.parse(jobs[0].body) : null; } catch { jobBody = null; }
      return {
        engine: $("engine")?.value || "",
        title: ($("answer-title")?.textContent || "").trim(),
        answer: ($("answer")?.textContent || "").trim(),
        chatCalled: window.__dashaChatCalled === true,
        chats: chats.length,
        jobs: jobs.length,
        jobBody,
        fallback: noMacHostedFallback === true,
      };
    });
    assert.equal(live.engine, "community", "Mac advertising stays Community");
    assert.equal(live.chatCalled, false, "Mac online does not steal Hosted");
    assert.equal(live.chats, 0, "no /compute/api/chat");
    assert.ok(live.jobs >= 1, "still POST /compute/api/jobs");
    assert.equal(live.jobBody?.route, "community");
    assert.equal(live.fallback, false);
    assert.doesNotMatch(live.title, /No Mac online\. Hosted\./, "live Mac does not paint miss face");

    const selfOff = await runAsk({
      engine: "self",
      model: "qwen3-8b",
      prompt: "my mac please",
      providersOnline: 0,
      models: [],
      netProviders: 0,
      netModels: [],
      ownMacOnline: 0,
      ownMacModels: [],
      waitOffline: true,
      keepEngine: true,
    });
    assert.equal(selfOff.engine, "self", "self stays self");
    assert.equal(selfOff.answer, "Your Mac is offline.");
    assert.equal(selfOff.chatCalled, false, "self does not Hosted-steal");
    assert.equal(selfOff.chats, 0);
    assert.equal(selfOff.jobs, 0);
    assert.equal(selfOff.fallback, false);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-nomac-hosted-ask: PASS");
