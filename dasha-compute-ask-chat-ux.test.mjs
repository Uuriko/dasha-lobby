#!/usr/bin/env node
/**
 * Ask chat UX — Claude/ChatGPT-minimal thread + sticky composer.
 * Cold Ask is an obvious chat. After first turn, thread dominates; doors sit in More.
 * Disk == embed == worker.fetch. No wrangler. No Designer. Never plugin.jup.ag.
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

function assertAskChatUx(html, label) {
  assert.match(html, /id=["']step-ask["'][^>]*hidden/, `${label} ask hidden default`);
  assert.match(html, /id=["']ask-composer["']/, `${label} composer`);
  assert.match(html, /id=["']ask-scroll["']/, `${label} scroll column`);
  assert.match(html, /id=["']ask-more["']/, `${label} More fold`);
  assert.match(html, /<h1 class=["']tf-q["']>Do\.<\/h1>/, `${label} Do H1 stays`);
  assert.match(html, /id=["']ask-thread["']/, `${label} ask-thread`);
  assert.match(html, /id=["']prompt["']/, `${label} #prompt`);
  assert.match(html, /id=["']run-demo["']/, `${label} Run`);
  assert.match(html, /id=["']login["']/, `${label} login`);
  assert.match(html, /id=["']clear-chat["']/, `${label} clear`);
  assert.match(html, /id=["']change-engine["']/, `${label} change-engine`);
  assert.match(html, /id=["']ask-model["']/, `${label} ask-model pill`);
  assert.match(html, /id=["']ask-greet["'][^>]*>What\.</, `${label} empty greeting`);
  assert.match(html, /function paintAskModel\(/, `${label} paintAskModel`);
  assert.match(html, /showTf\(['"]ask['"]\)/, `${label} Community stays on Ask`);
  assert.match(html, /id=["']ask-starters["']/, `${label} starters`);
  assert.match(html, /id=["']ask-starter["'][^>]*>Write code</, `${label} Write code`);
  assert.match(html, /id=["']ask-starter-2["'][^>]*>Fix a bug</, `${label} Fix a bug`);
  assert.match(html, /id=["']ask-starter-3["'][^>]*>Do the thing</, `${label} Do the thing`);
  assert.match(html, /id=["']ask-starter-4["'][^>]*>Explain this</, `${label} Explain this`);
  assert.match(html, /id=["']ask-think["']/, `${label} ask-think`);
  assert.match(html, /id=["']ask-run-chip["']/, `${label} ask-run-chip`);
  assert.match(html, /id=["']ask-receipt["']/, `${label} ask-receipt`);
  assert.match(html, /id=["']ask-mac-line["']/, `${label} ask-mac-line`);
  assert.match(html, /id=["']ask-free-fine["']/, `${label} ask-free-fine`);
  assert.match(html, /id=["']buyer-live-line["']/, `${label} buyer-live-line`);
  assert.match(html, /id=["']ask-provide["'][^>]*>Provide</, `${label} Provide`);
  assert.match(html, /id=["']ask-ocm["'][^>]*>Marketplace</, `${label} Marketplace`);
  assert.match(html, /id=["']ask-host["'][^>]*>Host</, `${label} Host`);
  assert.match(html, /function sizeAskPrompt\(/, `${label} sizeAskPrompt`);
  assert.match(html, /function paintAskThread\(/, `${label} paintAskThread`);
  assert.match(html, /body\.classList\.toggle\(['"]has-chat['"]/, `${label} has-chat`);
  assert.match(html, /#step-ask \.ask-composer\{[^}]*position:sticky/, `${label} sticky composer`);
  assert.match(html, /#change-engine(?:,#ask-model)?\{[^}]*border-radius:999px/, `${label} engine pill`);
  assert.match(html, /#ask-starters\{[^}]*display:flex;flex-wrap:wrap/, `${label} starter chips wrap`);
  assert.match(html, /\.ask-said\{[^}]*Arial,Helvetica,sans-serif/, `${label} Claude sans turns`);
  assert.match(html, /body\.has-chat #step-ask \.tf-q\{/, `${label} hide Do. after first turn`);
  assert.match(html, /body\[data-step=ask\] \.shell\{[^}]*52rem/, `${label} 52rem chat column`);
  assert.match(html, /body\[data-step=ask\] #tf-progress\{display:none!important\}/, `${label} no Typeform progress on Ask`);
  assert.match(html, /#step-ask #guide\{display:none!important\}/, `${label} no How-guide on Ask`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /Ask Dasha/, `${label} no dual Ask Dasha`);
}

assertAskChatUx(disk, "disk");
assertAskChatUx(COMPUTE_PAGE_HTML, "embed");

const served = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get("x-dasha-edge"), "compute");
assertAskChatUx(await served.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });

    const gate = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      return {
        step: document.body.dataset.step,
        gateQ: document.querySelector("#step-gate .tf-q")?.textContent || "",
        prompt: vis(document.getElementById("prompt")),
      };
    });
    assert.equal(gate.step, "gate", "Start. first");
    assert.equal(gate.gateQ, "Start.");
    assert.equal(gate.prompt, false, "composer not on Start.");

    await page.click("#pick-ask");
    const cold = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      const prompt = document.getElementById("prompt");
      const composer = document.getElementById("ask-composer");
      const greet = document.querySelector("#step-ask .tf-q");
      const provide = document.getElementById("ask-provide");
      const more = document.getElementById("ask-more");
      return {
        step: document.body.dataset.step,
        askQ: greet?.textContent || "",
        greetClip: greet ? getComputedStyle(greet).position : "",
        emptyGreet: vis(document.getElementById("ask-greet")),
        emptyGreetText: (document.getElementById("ask-greet")?.textContent || "").trim(),
        progress: vis(document.getElementById("tf-progress")),
        prompt: vis(prompt),
        login: vis(document.getElementById("login")),
        change: vis(document.getElementById("change-engine")),
        askModel: vis(document.getElementById("ask-model")),
        starters: vis(document.getElementById("ask-starters")),
        threadHidden: document.getElementById("ask-thread")?.hidden === true,
        composerBottom: composer ? composer.getBoundingClientRect().bottom : 0,
        promptTop: prompt ? prompt.getBoundingClientRect().top : 0,
        provide: vis(provide),
        moreOpen: more?.hasAttribute("open") === true,
        engineRadius: parseFloat(getComputedStyle(document.getElementById("change-engine")).borderRadius) || 0,
        promptFont: parseFloat(getComputedStyle(prompt).fontSize) || 0,
        viewport: window.innerHeight,
      };
    });
    assert.equal(cold.step, "ask");
    assert.equal(cold.askQ, "Do.");
    assert.equal(cold.greetClip, "absolute", "Do. is not a Typeform H1 on first paint");
    assert.equal(cold.emptyGreet, true, "quiet What. greeting");
    assert.equal(cold.emptyGreetText, "What.");
    assert.equal(cold.progress, false, "no progress dots on Ask");
    assert.equal(cold.prompt, true, "composer prompt visible");
    assert.equal(cold.login, true, "Sign in in composer");
    assert.equal(cold.change, true, "engine pill near composer");
    assert.equal(cold.askModel, false, "Hosted hides model pill");
    assert.equal(cold.starters, true, "starter chips on empty");
    assert.equal(cold.threadHidden, true);
    assert.equal(cold.provide, true, "doors visible as quiet footer");
    assert.equal(cold.moreOpen, true, "More open on empty");
    assert.ok(cold.engineRadius >= 12, "engine is a pill");
    assert.ok(cold.promptFont <= 22, "composer type is chat-sized");
    assert.ok(cold.composerBottom > cold.promptTop, "composer holds the prompt");
    assert.ok(cold.composerBottom > cold.viewport * 0.55, "composer sits in the lower half");

    const community = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      providersOnline = 2;
      networkModels = new Set(["qwen3-4b", "gemma3-27b"]);
      networkCapacity = [{ model: "qwen3-4b", measured_providers: 1, tokens_per_second: 46.5 }];
      cameFromHow = true;
      setEngine("community", true);
      const pill = document.getElementById("ask-model");
      return {
        step: document.body.dataset.step,
        modelStep: vis(document.getElementById("step-model")),
        which: (document.querySelector("#step-model .tf-q")?.textContent || "").trim(),
        prompt: vis(document.getElementById("prompt")),
        askModel: vis(pill),
        askModelValue: pill?.value || "",
        engine: document.getElementById("engine")?.value || "",
        change: (document.getElementById("change-engine")?.textContent || "").trim(),
      };
    });
    assert.equal(community.step, "ask", "Community stays on Ask");
    assert.equal(community.modelStep, false, "Which model? step stays off");
    assert.equal(community.which, "Which model?");
    assert.equal(community.prompt, true, "composer stays");
    assert.equal(community.askModel, true, "model pill on composer");
    assert.equal(community.engine, "community");
    assert.ok(community.askModelValue === "qwen3-4b" || community.askModelValue === "gemma3-27b", "pill has a live model");
    assert.match(community.change, /Community/, "engine pill names Community");

    await page.evaluate(() => {
      const pill = document.getElementById("ask-model");
      if (!pill) return;
      pill.value = "gemma3-27b";
      pill.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const picked = await page.evaluate(() => ({
      step: document.body.dataset.step,
      model: document.getElementById("model")?.value || "",
      pill: document.getElementById("ask-model")?.value || "",
    }));
    assert.equal(picked.step, "ask", "picking a model does not leave Ask");
    assert.equal(picked.model, "gemma3-27b");
    assert.equal(picked.pill, "gemma3-27b");

    await page.evaluate(() => {
      setEngine("hosted", false);
      $('engine').value = "hosted";
      paintAskEngine();
    });

    const afterTurn = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      conversation = [
        { role: "user", content: "Write a sort in Python." },
        { role: "assistant", content: "def sort_xs(xs):\n    return sorted(xs)" },
      ];
      threadRoute = "hosted";
      $("engine").value = "hosted";
      renderConversation();
      showTf("ask");
      const greet = document.querySelector("#step-ask .tf-q");
      const greetCs = greet ? getComputedStyle(greet) : null;
      return {
        hasChat: document.body.classList.contains("has-chat"),
        threadHidden: document.getElementById("ask-thread")?.hidden === true,
        startersHidden: document.getElementById("ask-starters")?.hidden === true,
        clearHidden: document.getElementById("clear-chat")?.hidden === true,
        moreOpen: document.getElementById("ask-more")?.hasAttribute("open") === true,
        provide: vis(document.getElementById("ask-provide")),
        greetClipped: !!(greetCs && (greetCs.position === "absolute" || greetCs.clip !== "auto")),
        who: [...document.querySelectorAll("#ask-thread .ask-who")].map((el) => el.textContent.trim()),
        saidFont: getComputedStyle(document.querySelector("#ask-thread .ask-said")).fontFamily,
        change: vis(document.getElementById("change-engine")),
        login: vis(document.getElementById("login")),
      };
    });
    assert.equal(afterTurn.hasChat, true, "has-chat after first turn");
    assert.equal(afterTurn.threadHidden, false, "thread dominates");
    assert.equal(afterTurn.startersHidden, true, "chips hide");
    assert.equal(afterTurn.clearHidden, false, "Clear quiet-visible");
    assert.equal(afterTurn.moreOpen, false, "doors fold into More");
    assert.equal(afterTurn.provide, false, "Provide not fighting the thread");
    assert.equal(afterTurn.greetClipped, true, "Do. recedes once focused");
    assert.deepEqual(afterTurn.who, ["You", "Hosted"]);
    assert.match(afterTurn.saidFont, /Arial|Helvetica|sans-serif/i, "assistant is sans");
    assert.equal(afterTurn.change, true, "engine pill stays");
    assert.equal(afterTurn.login, true, "login/send stays");

    const afterClear = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      clearConversation();
      showTf("ask");
      return {
        hasChat: document.body.classList.contains("has-chat"),
        threadHidden: document.getElementById("ask-thread")?.hidden === true,
        starters: vis(document.getElementById("ask-starters")),
        moreOpen: document.getElementById("ask-more")?.hasAttribute("open") === true,
        provide: vis(document.getElementById("ask-provide")),
      };
    });
    assert.equal(afterClear.hasChat, false);
    assert.equal(afterClear.threadHidden, true);
    assert.equal(afterClear.starters, true, "chips return after Clear");
    assert.equal(afterClear.moreOpen, true);
    assert.equal(afterClear.provide, true);

    await page.setViewport({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      const composer = document.getElementById("ask-composer");
      return {
        prompt: vis(document.getElementById("prompt")),
        login: vis(document.getElementById("login")),
        composerBottom: composer ? composer.getBoundingClientRect().bottom : 0,
        viewport: window.innerHeight,
      };
    });
    assert.equal(mobile.prompt, true, "mobile composer");
    assert.equal(mobile.login, true, "mobile Sign in");
    assert.ok(mobile.composerBottom > mobile.viewport * 0.5, "mobile composer stays low");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ask-chat-ux: PASS");
