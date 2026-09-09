#!/usr/bin/env node
/**
 * Ask is easy: Start. first paint unchanged, one ink-on-acid primary,
 * Community run face is the run — not Hosted · live.
 * Disk == embed == worker.fetch. No wrangler. No invented tokens/prices.
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

function rgbOf(color) {
  const m = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function isInk(rgb) {
  return rgb && rgb[0] <= 40 && rgb[1] <= 40 && rgb[2] <= 40;
}
function isAcid(rgb) {
  return rgb && rgb[0] >= 180 && rgb[1] >= 220 && rgb[2] <= 80;
}
function isWhite(rgb) {
  return rgb && rgb[0] >= 240 && rgb[1] >= 240 && rgb[2] >= 240;
}

function assertAskEasy(html, label) {
  assert.match(html, /data-step=["']gate["']/, `${label} body starts on gate`);
  assert.match(html, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} Start. first paint`);
  assert.match(html, /id=["']pick-ask["'][^>]*>Ask</, `${label} Ask`);
  assert.match(html, /id=["']pick-provide["'][^>]*>Provide</, `${label} Provide`);
  assert.match(html, /id=["']pick-pay["'][^>]*>Pay</, `${label} Pay`);
  assert.match(html, /id=["']pick-credits["'][^>]*>Credits</, `${label} Credits`);
  assert.match(html, /id=["']step-ask["'][^>]*hidden/, `${label} ask hidden default`);
  assert.match(html, /placeholder=["']Write a function\. Fix a bug\. Do the thing\.["']/, `${label} code-range placeholder`);
  assert.doesNotMatch(html, /Welcome note/, `${label} no welcome-note toy`);
  assert.doesNotMatch(html, /hamburger/i, `${label} no hamburger`);
  assert.doesNotMatch(html, /overlay menu|dashboard/i, `${label} no overlay/dashboard`);
  assert.ok(html.includes("background:var(--acid);border-color:var(--acid);color:var(--ink)"), `${label} primary ink on acid`);
  assert.ok(html.includes(".tf-choice.primary:hover,.primary:hover"), `${label} primary hover stays ink on acid`);
  assert.ok(html.includes("#step-ask .primary:disabled,#step-ask .primary:disabled:hover{background:transparent;border-color:var(--line);color:var(--paper-muted);opacity:1}"), `${label} disabled readable`);
  assert.ok(html.includes(".ask-doors{display:grid"), `${label} Ask doors stack`);
  assert.ok(html.includes("#step-ask .ask-door-sep{display:none}"), `${label} no tiny · row`);
  assert.match(html, /#ask-starters\{[^}]*display:grid/, `${label} starters stack`);
  assert.match(html, /function threadSpeaker\(/, `${label} threadSpeaker`);
  assert.match(html, /return role==='user'\?'You':'Mac'/, `${label} You then the Mac`);
  assert.match(html, /\$\(['"]run-demo['"]\)\.textContent=askHasReply\(\)\?'Send':'Run'/, `${label} Run then Send`);
  assert.match(html, /function paintCommunityWorkingFace\(/, `${label} Community working face`);
  assert.match(html, /\$\(['"]answer['"]\)\.textContent='A Mac is working\.'/, `${label} A Mac is working.`);
  assert.match(html, /Hosted · live is Hosted engine status only/, `${label} Hosted · live Hosted-only`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertAskEasy(disk, "disk");
assertAskEasy(COMPUTE_PAGE_HTML, "embed");

const served = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get("x-dasha-edge"), "compute");
assertAskEasy(await served.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });

    const first = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      const ask = document.getElementById("pick-ask");
      const cs = ask ? getComputedStyle(ask) : null;
      return {
        step: document.body.dataset.step,
        gateQ: document.querySelector("#step-gate .tf-q")?.textContent || "",
        ask: vis(document.getElementById("pick-ask")),
        provide: vis(document.getElementById("pick-provide")),
        pay: vis(document.getElementById("pick-pay")),
        credits: vis(document.getElementById("pick-credits")),
        prompt: vis(document.getElementById("prompt")),
        run: vis(document.getElementById("run-demo")),
        hamburger: !!document.querySelector("[class*=hamburger], [id*=hamburger]"),
        color: cs?.color || "",
        bg: cs?.backgroundColor || "",
      };
    });
    assert.equal(first.step, "gate", "cold first paint Start.");
    assert.equal(first.gateQ, "Start.");
    assert.equal(first.ask, true);
    assert.equal(first.provide, true);
    assert.equal(first.pay, true);
    assert.equal(first.credits, true);
    assert.equal(first.prompt, false, "prompt not on Start.");
    assert.equal(first.run, false, "Run not on Start.");
    assert.equal(first.hamburger, false);
    const askInk = rgbOf(first.color);
    const askAcid = rgbOf(first.bg);
    assert.ok(isInk(askInk), "Ask primary text is ink");
    assert.ok(isAcid(askAcid), "Ask primary fill is acid");
    assert.ok(!isWhite(askInk), "Ask primary is not white-on-acid");

    await page.click("#pick-ask");
    const askPaint = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      const run = document.getElementById("run-demo");
      const login = document.getElementById("login");
      const doors = document.getElementById("ask-doors");
      const doorBox = doors ? doors.getBoundingClientRect() : null;
      const provide = document.getElementById("ask-provide");
      const ocm = document.getElementById("ask-ocm");
      const host = document.getElementById("ask-host");
      const stacked = !!(doorBox && provide && ocm && host &&
        provide.getBoundingClientRect().top < ocm.getBoundingClientRect().top &&
        ocm.getBoundingClientRect().top < host.getBoundingClientRect().top);
      const cs = login && vis(login) ? getComputedStyle(login) : (run ? getComputedStyle(run) : null);
      return {
        step: document.body.dataset.step,
        askQ: document.querySelector("#step-ask .tf-q")?.textContent || "",
        placeholder: document.getElementById("prompt")?.getAttribute("placeholder") || "",
        prompt: vis(document.getElementById("prompt")),
        login: vis(login),
        loginColor: login ? getComputedStyle(login).color : "",
        loginBg: login ? getComputedStyle(login).backgroundColor : "",
        runColor: run ? getComputedStyle(run).color : "",
        runBg: run ? getComputedStyle(run).backgroundColor : "",
        stacked,
        wrapDoors: doors ? getComputedStyle(doors).flexWrap : "",
        displayDoors: doors ? getComputedStyle(doors).display : "",
      };
    });
    assert.equal(askPaint.step, "ask");
    assert.equal(askPaint.askQ, "Ask.");
    assert.equal(askPaint.placeholder, "Write a function. Fix a bug. Do the thing.");
    assert.equal(askPaint.prompt, true);
    assert.equal(askPaint.login, true, "guest primary is Sign in");
    assert.equal(askPaint.displayDoors, "grid", "doors stack");
    assert.equal(askPaint.stacked, true, "Provide / Marketplace / Host stack");
    const loginInk = rgbOf(askPaint.loginColor);
    const loginAcid = rgbOf(askPaint.loginBg);
    assert.ok(isInk(loginInk), "Sign in text is ink");
    assert.ok(isAcid(loginAcid), "Sign in fill is acid");
    assert.ok(!isWhite(loginInk), "Sign in is not white-on-acid");

    const thread = await page.evaluate(() => {
      conversation = [
        { role: "user", content: "Write a sort in Python." },
        { role: "assistant", content: "def sort_xs(xs):\n    return sorted(xs)" },
      ];
      threadRoute = "community";
      $("engine").value = "community";
      $("prompt").value = "";
      renderConversation();
      updateRun();
      showTf("ask");
      return {
        step: document.body.dataset.step,
        thread: (document.getElementById("ask-thread")?.textContent || "").trim(),
        run: (document.getElementById("run-demo")?.textContent || "").trim(),
        clearHidden: document.getElementById("clear-chat")?.hidden === true,
        startersHidden: document.getElementById("ask-starters")?.hidden === true,
        youThenMac: false,
      };
    });
    assert.equal(thread.step, "ask", "reply stays on Ask");
    assert.match(thread.thread, /You\s+Write a sort in Python\./);
    assert.match(thread.thread, /Mac\s+def sort_xs/);
    assert.ok(thread.thread.indexOf("You") < thread.thread.indexOf("Mac"), "You, then the Mac");
    assert.equal(thread.run, "Send", "next message is Send");
    assert.equal(thread.clearHidden, false, "Clear quiet-visible");
    assert.equal(thread.startersHidden, true);

    const inflight = await page.evaluate(async () => {
      hostedChosenThisSession = false;
      loggedIn = true;
      hostedLive = true;
      providersOnline = 1;
      networkModels = new Set(["gemma3-27b"]);
      networkCapacity = [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 2.93 }];
      $("engine").value = "community";
      $("model").value = "gemma3-27b";
      $("prompt").value = "Keep going.";
      updateRun();
      const orig = window.fetch;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        if (href.includes("/compute/api/chat")) {
          return new Response(JSON.stringify({ answer: "hosted slip" }), {
            status: 200, headers: { "content-type": "application/json" },
          });
        }
        if (href.includes("/compute/api/jobs")) {
          return new Promise((_, reject) => {
            const fail = () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            };
            if (opts.signal?.aborted) { fail(); return; }
            if (opts.signal) opts.signal.addEventListener("abort", fail, { once: true });
          });
        }
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      };
      $("run-demo").disabled = false;
      $("run-demo").hidden = false;
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        if (($("answer")?.textContent || "").trim() === "A Mac is working.") break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      paintHonestyPanel();
      const snap = {
        answer: ($("answer")?.textContent || "").trim(),
        title: ($("answer-title")?.textContent || "").trim(),
        hostedChip: ($("honesty-hosted")?.textContent || "").trim(),
        hostedHidden: $("honesty-hosted")?.hidden === true,
      };
      if (runAbort) try { runAbort.abort(); } catch {}
      await new Promise((resolve) => setTimeout(resolve, 40));
      window.fetch = orig;
      return snap;
    });
    assert.equal(inflight.answer, "A Mac is working.", "Community in flight is the run");
    assert.notEqual(inflight.answer, "Hosted · live");
    assert.notEqual(inflight.title, "Hosted · live");
    assert.equal(inflight.hostedHidden, true, "Hosted · live hidden on Community run");
    assert.equal(inflight.hostedChip, "");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ask-easy: PASS");
