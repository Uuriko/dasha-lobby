#!/usr/bin/env node
/**
 * Ask v3 quiet shell — P0 chrome subtraction on tip #246/#249.
 * Disk == embed == worker.fetch. No wrangler. No Designer. Never plugin.jup.ag.
 *
 * Empty: 1 line + ≤4 chips. Model chip in composer. Hover actions.
 * One-word stream + Stop. Acid only on Send/active. 42rem column. New top-right.
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

function assertAskQuietShell(html, label) {
  assert.match(html, /id=["']step-ask["']/, `${label} #step-ask`);
  assert.match(html, /id=["']ask-input["']/, `${label} #ask-input`);
  assert.match(html, /id=["']ask-send["']/, `${label} #ask-send`);
  assert.match(html, /id=["']ask-model["']/, `${label} #ask-model`);
  assert.match(html, /id=["']prompt["']/, `${label} #prompt`);
  assert.match(html, /id=["']run-demo["']/, `${label} #run-demo`);
  assert.match(html, /id=["']ask-thread["']/, `${label} #ask-thread`);
  assert.match(html, /id=["']ask-think["']/, `${label} think chip`);
  assert.match(html, /id=["']ask-run-chip["']/, `${label} run chip`);
  assert.match(html, /function stopAskRun\(/, `${label} stopAskRun`);
  assert.match(html, /function beginAskLive\(/, `${label} beginAskLive`);
  assert.match(html, /function setAskRunChip\(/, `${label} setAskRunChip`);
  assert.match(html, /function regenerateLastAsk\(/, `${label} regen`);
  assert.match(html, /function copyAskText\(/, `${label} copy`);
  assert.match(html, /function editLastUserAsk\(/, `${label} edit`);
  assert.match(html, /function renderAskMarkdown\(/, `${label} markdown`);
  assert.match(html, /id=["']ask-greet["'][^>]*>What\.</, `${label} one empty line`);
  assert.match(html, /id=["']ask-starter["'][^>]*>Write code</, `${label} chip 1`);
  assert.match(html, /id=["']ask-starter-4["'][^>]*>Explain this</, `${label} chip 4`);
  assert.doesNotMatch(html, /id=["']ask-starter-5["']/, `${label} no 5th chip`);
  assert.doesNotMatch(html, /id=["']ask-starter-6["']/, `${label} no 6th chip`);
  assert.match(html, /id=["']ask-nav["']/, `${label} quiet nav`);
  assert.match(html, /id=["']ask-provide["'][^>]*>Provide</, `${label} Provide nav`);
  assert.match(html, /id=["']ask-ocm["'][^>]*>OCM console</, `${label} OCM console nav`);
  assert.match(html, /id=["']ask-host["'][^>]*>Host</, `${label} Host nav`);
  assert.match(html, /<details class=["']ask-more["'] id=["']ask-more["']>/, `${label} More starts closed`);
  assert.match(html, /id=["']ask-top["']|#step-ask \.ask-top|#clear-chat/, `${label} New top control`);
  assert.match(html, /#step-ask \.ask-top #clear-chat\{/, `${label} New lives in ask-top`);
  assert.match(html, /body\[data-step=ask\] \.shell\{[^}]*42rem/, `${label} 42rem column`);
  assert.match(html, /\.ask-turn:hover \.ask-acts/, `${label} hover actions`);
  assert.match(html, /content:' Thinking…'/, `${label} one-word stream`);
  assert.doesNotMatch(html, /content:' · streaming'/, `${label} no streaming essay`);
  assert.doesNotMatch(html, /content:' · thinking'/, `${label} no · thinking rail`);
  assert.match(html, /#step-ask \.ask-composer-box\{[^}]*border:0/, `${label} composer no border`);
  assert.match(html, /#change-engine,#ask-model\{[^}]*border:0/, `${label} quiet model chip`);
  assert.match(html, /if\(askBusy\)\$\(['"]run-demo['"]\)\.textContent=['"]Stop['"]/, `${label} Stop primary`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /Ask Dasha/, `${label} no dual Ask Dasha`);
}

assertAskQuietShell(disk, "disk");
assertAskQuietShell(COMPUTE_PAGE_HTML, "embed");

const served = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get("x-dasha-edge"), "compute");
assertAskQuietShell(await served.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.click("#pick-ask");

    const cold = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      const starters = [...document.querySelectorAll("#ask-starters [data-prompt]")];
      const greet = document.getElementById("ask-greet");
      const shell = document.querySelector(".shell");
      const send = document.getElementById("run-demo") || document.getElementById("login");
      return {
        step: document.body.dataset.step,
        greet: vis(greet),
        greetText: (greet?.textContent || "").trim(),
        range: vis(document.getElementById("ask-range")),
        chips: starters.map((el) => el.textContent.trim()),
        chipCount: starters.length,
        provide: vis(document.getElementById("ask-provide")),
        market: vis(document.getElementById("ask-ocm")),
        host: vis(document.getElementById("ask-host")),
        skill: vis(document.getElementById("copy-skill-use")),
        moreOpen: document.getElementById("ask-more")?.open === true,
        askInput: !!document.getElementById("ask-input"),
        askSend: !!document.getElementById("ask-send"),
        askModel: !!document.getElementById("ask-model"),
        prompt: vis(document.getElementById("prompt")),
        modelInComposer: !!document.getElementById("ask-composer")?.contains(document.getElementById("ask-model")),
        newTop: !!document.querySelector("#step-ask .ask-top #clear-chat"),
        newInComposer: !!document.querySelector("#ask-composer #clear-chat"),
        shellMax: shell ? parseFloat(getComputedStyle(shell).maxWidth) : 0,
        sendBg: send ? getComputedStyle(send).backgroundColor : "",
        composerBorder: getComputedStyle(document.querySelector("#step-ask .ask-composer-box")).borderWidth,
        engineBorder: getComputedStyle(document.getElementById("change-engine")).borderWidth,
      };
    });
    assert.equal(cold.step, "ask");
    assert.equal(cold.greet, true, "one empty prompt line");
    assert.equal(cold.greetText, "What.");
    assert.equal(cold.range, false, "range line is not on the canvas");
    assert.equal(cold.chipCount, 4, "≤4 starter chips");
    assert.deepEqual(cold.chips, ["Write code", "Fix a bug", "Do the thing", "Explain this"]);
    assert.equal(cold.provide, true, "Provide quiet nav");
    assert.equal(cold.market, true, "OCM console quiet nav");
    assert.equal(cold.host, true, "Host quiet nav");
    assert.equal(cold.skill, false, "Copy AI skill not on empty canvas");
    assert.equal(cold.moreOpen, false);
    assert.equal(cold.askInput, true);
    assert.equal(cold.askSend, true);
    assert.equal(cold.askModel, true);
    assert.equal(cold.prompt, true);
    assert.equal(cold.modelInComposer, true, "model chip in composer");
    assert.equal(cold.newTop, true, "New is a quiet top control");
    assert.equal(cold.newInComposer, false, "New left the composer row");
    assert.ok(cold.shellMax <= 672, "message column ~42rem");
    assert.equal(cold.composerBorder, "0px", "composer has no border");
    assert.equal(cold.engineBorder, "0px", "engine/model chip has no border");

    const community = await page.evaluate(() => {
      providersOnline = 2;
      networkModels = new Set(["qwen3-4b", "gemma3-27b"]);
      cameFromHow = true;
      setEngine("community", true);
      const pill = document.getElementById("ask-model");
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      return {
        step: document.body.dataset.step,
        which: vis(document.getElementById("step-model")),
        engine: (document.getElementById("change-engine")?.textContent || "").trim(),
        modelVis: vis(pill),
        modelInBar: !!document.getElementById("ask-composer")?.contains(pill),
      };
    });
    assert.equal(community.step, "ask", "Community stays on Ask");
    assert.equal(community.which, false, "no loud Which model? row");
    assert.equal(community.engine, "Community", "engine chip is quiet");
    assert.equal(community.modelVis, true, "model chip visible");
    assert.equal(community.modelInBar, true);

    const painted = await page.evaluate(() => {
      conversation = [
        { role: "user", content: "Write a sort." },
        { role: "assistant", content: "Use **sorted**.", state: "complete" },
      ];
      threadRoute = "hosted";
      $("engine").value = "hosted";
      renderConversation();
      showTf("ask");
      const asst = document.querySelector("#ask-thread .ask-turn.mac");
      const acts = asst?.querySelector(".ask-acts");
      const rest = acts ? getComputedStyle(acts) : null;
      return {
        hasChat: document.body.classList.contains("has-chat"),
        provide: !!(document.getElementById("ask-provide")?.offsetParent),
        newHidden: document.getElementById("clear-chat")?.hidden === true,
        newTop: !!document.querySelector("#step-ask .ask-top #clear-chat"),
        actOpacity: rest ? rest.opacity : "",
        actPointer: rest ? rest.pointerEvents : "",
        thread: (document.getElementById("ask-thread")?.textContent || ""),
        after: asst ? getComputedStyle(asst.querySelector(".ask-who"), "::after").content : "",
      };
    });
    assert.equal(painted.hasChat, true);
    assert.equal(painted.provide, false, "Provide leaves the thread");
    assert.equal(painted.newHidden, false, "New shows after a turn");
    assert.equal(painted.newTop, true);
    assert.equal(painted.actOpacity, "0", "actions hidden until hover");
    assert.equal(painted.actPointer, "none");
    assert.doesNotMatch(painted.thread, /tok\/s/i, "no tok/s in thread");
    assert.doesNotMatch(painted.after, /streaming/i, "no streaming essay");

    await page.hover("#ask-thread .ask-turn.mac");
    const hovered = await page.evaluate(() => {
      const acts = document.querySelector("#ask-thread .ask-turn.mac .ask-acts");
      return acts ? getComputedStyle(acts).opacity : "";
    });
    assert.equal(hovered, "1", "actions appear on hover");

    const stream = await page.evaluate(() => {
      conversation = [{ role: "user", content: "Go.", state: "complete" }];
      askLive = { user: "Go.", assistant: "", state: "thinking" };
      askBusy = true;
      renderConversation();
      const turn = document.querySelector("#ask-thread .ask-turn.mac");
      const who = turn?.querySelector(".ask-who");
      return {
        state: turn?.dataset.state || "",
        after: who ? getComputedStyle(who, "::after").content : "",
        thread: (document.getElementById("ask-thread")?.textContent || ""),
      };
    });
    assert.equal(stream.state, "thinking");
    assert.match(stream.after, /Thinking/i, "one quiet word");
    assert.doesNotMatch(stream.after, /tok\/s|provider|streaming/i);
    assert.doesNotMatch(stream.thread, /tok\/s/i);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ask-quiet-shell: PASS");
