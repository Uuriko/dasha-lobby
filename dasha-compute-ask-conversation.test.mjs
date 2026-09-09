#!/usr/bin/env node
/**
 * Ask stays a conversation: follow-up payload keeps prior user+assistant turns;
 * copy no longer leads with the welcome-note toy.
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

function assertAskConversation(html, label) {
  assert.match(html, /function pendingMessages\(/, `${label} pendingMessages`);
  assert.match(html, /function paintAskThread\(/, `${label} paintAskThread`);
  assert.match(html, /function threadKeepsCommunity\(/, `${label} threadKeepsCommunity`);
  assert.match(html, /stayAskChat/, `${label} stayAskChat`);
  assert.match(html, /threadRoute/, `${label} threadRoute`);
  assert.match(html, /if\(stayAskChat\)showTf\(['"]ask['"]\)/, `${label} success stays on Ask`);
  assert.match(html, /id=["']ask-thread["']/, `${label} ask-thread`);
  assert.match(html, /<h1 class=["']tf-q["']>Ask\.<\/h1>/, `${label} Ask H1`);
  assert.match(html, /placeholder=["']Write a function\. Fix a bug\. Do the thing\.["']/, `${label} code-range placeholder`);
  assert.match(html, /id=["']ask-starter["'][^>]*>Write code</, `${label} Write code`);
  assert.match(html, /id=["']ask-starter-2["'][^>]*>Fix a bug</, `${label} Fix a bug`);
  assert.match(html, /id=["']ask-starter-3["'][^>]*>Do the thing</, `${label} Do the thing`);
  assert.doesNotMatch(html, /Welcome note/, `${label} no welcome-note chip`);
  assert.doesNotMatch(html, /welcome for a new teammate/, `${label} no welcome-note prompt`);
  assert.doesNotMatch(html, /Write a short welcome/, `${label} no welcome-note lead`);
  assert.match(html, /if\(threadKeepsCommunity\(\)\)/, `${label} Community thread lock`);
  assert.match(html, /hostedChosenThisSession/, `${label} Hosted stay`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertAskConversation(disk, "disk");
assertAskConversation(COMPUTE_PAGE_HTML, "embed");

const served = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get("x-dasha-edge"), "compute");
assertAskConversation(await served.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const firstPaint = await page.evaluate(() => {
      showTf("ask");
      return {
        h1: document.querySelector("#step-ask .tf-q")?.textContent || "",
        placeholder: document.getElementById("prompt")?.getAttribute("placeholder") || "",
        starter: (document.getElementById("ask-starter")?.textContent || "").trim(),
        threadHidden: document.getElementById("ask-thread")?.hidden === true,
        startersHidden: document.getElementById("ask-starters")?.hidden === true,
      };
    });
    assert.equal(firstPaint.h1, "Ask.", "first-paint H1 Ask.");
    assert.equal(firstPaint.placeholder, "Write a function. Fix a bug. Do the thing.");
    assert.equal(firstPaint.starter, "Write code");
    assert.equal(firstPaint.threadHidden, true, "thread hidden before reply");
    assert.equal(firstPaint.startersHidden, false, "starters visible first paint");
    assert.doesNotMatch(firstPaint.placeholder, /welcome/i);

    const followUp = await page.evaluate(() => {
      conversation = [
        { role: "user", content: "Write a sort in Python." },
        { role: "assistant", content: "def sort_xs(xs):\n    return sorted(xs)" },
      ];
      threadRoute = "community";
      $("engine").value = "community";
      $("prompt").value = "Now reverse it.";
      renderConversation();
      showTf("ask");
      const payload = pendingMessages();
      return {
        payload,
        step: document.body.dataset.step,
        thread: (document.getElementById("ask-thread")?.textContent || "").trim(),
        threadHidden: document.getElementById("ask-thread")?.hidden === true,
        startersHidden: document.getElementById("ask-starters")?.hidden === true,
        welcomeHidden: document.getElementById("ask-starter")?.hidden === true,
        clearHidden: document.getElementById("clear-chat")?.hidden === true,
        prompt: document.getElementById("prompt")?.value || "",
        engine: $("engine")?.value || "",
      };
    });
    assert.equal(followUp.step, "ask", "stay on Ask after first reply");
    assert.equal(followUp.payload.length, 3, "follow-up includes prior turns + new user");
    assert.deepEqual(
      followUp.payload.map((m) => m.role),
      ["user", "assistant", "user"],
      "user then assistant then follow-up",
    );
    assert.equal(followUp.payload[0].content, "Write a sort in Python.");
    assert.match(followUp.payload[1].content, /def sort_xs/);
    assert.equal(followUp.payload[2].content, "Now reverse it.");
    assert.match(followUp.thread, /You:\nWrite a sort in Python\./);
    assert.match(followUp.thread, /Assistant:\ndef sort_xs/);
    assert.equal(followUp.threadHidden, false, "thread visible");
    assert.equal(followUp.startersHidden, true, "starters hide once a thread exists");
    assert.equal(followUp.welcomeHidden, true, "Write code chip hides once a thread exists");
    assert.equal(followUp.clearHidden, false, "Clear quiet-visible");
    assert.equal(followUp.engine, "community");

    const stayCommunity = await page.evaluate(() => {
      hostedChosenThisSession = false;
      hostedLive = true;
      providersOnline = 0;
      networkModels = new Set();
      $("engine").value = "hosted";
      enterAskEngine(true);
      $("prompt").value = "Keep going.";
      return {
        engine: $("engine")?.value || "",
        step: document.body.dataset.step,
        payload: pendingMessages(),
      };
    });
    assert.equal(stayCommunity.engine, "community", "Community thread does not route follow-up to Hosted");
    assert.equal(stayCommunity.step, "ask");
    assert.equal(stayCommunity.payload[0].content, "Write a sort in Python.");
    assert.equal(stayCommunity.payload.at(-1).content, "Keep going.");

    const afterClear = await page.evaluate(() => {
      clearConversation();
      showTf("ask");
      return {
        threadHidden: document.getElementById("ask-thread")?.hidden === true,
        startersHidden: document.getElementById("ask-starters")?.hidden === true,
        starter: (document.getElementById("ask-starter")?.textContent || "").trim(),
        engine: $("engine")?.value || "",
        route: threadRoute,
        payloadLen: pendingMessages().length,
      };
    });
    assert.equal(afterClear.threadHidden, true, "Clear is the only reset");
    assert.equal(afterClear.startersHidden, false, "starters return after Clear");
    assert.equal(afterClear.starter, "Write code");
    assert.equal(afterClear.route, "");
    assert.equal(afterClear.payloadLen, 1, "Clear drops history");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ask-conversation: PASS");
