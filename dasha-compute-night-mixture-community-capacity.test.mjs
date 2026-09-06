#!/usr/bin/env node
/**
 * Live Worker 681ec575: Night Mixture → Community capacity honesty.
 * Mixture empty (no SUB24) + Community Macs → Night offers Community · N
 * (measured tok/s in title) → Ask with preferred live model.
 * Mixture dim title: No Mixture Mac · Community · N online.
 * Change-engine on Mixture-empty hints Community capacity.
 * Hidden at providers_online:0.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { USE_SKILL_MD } from "./dasha-compute-skills.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertNightCommunity(html, label) {
  assert.match(html, /id=["']night-use-community["'][^>]*hidden[^>]*>Community</, `${label} #night-use-community hidden first paint`);
  assert.match(html, /Honest capacity: Mixture \(or wrong-model\) Night still offers live Community Macs/, `${label} honest capacity comment`);
  assert.match(html, /const com=\$\(['"]night-use-community['"]\)/, `${label} paintNightAuth Community door`);
  assert.match(html, /com\.textContent=`Community · \$\{providersOnline\}`/, `${label} Night Community · N`);
  assert.match(html, /com\.title=title/, `${label} Night Community measured title`);
  assert.match(html, /engMix\.title=`No Mixture Mac · Community · \$\{providersOnline\} online`/, `${label} Mixture dim Community · N online`);
  assert.match(html, /engMix\.title='No Mixture Mac · opens Night'/, `${label} Mixture dim opens Night at 0`);
  assert.match(html, /if\(providersOnline>=1&&\(eng==='hosted'\|\|\(eng==='mixture'&&fleetEmpty\('mixture'\)\)\)\)/, `${label} change-engine hints Community on Mixture-empty`);
  assert.match(html, /night-use-community['"]\)\?\.addEventListener\(['"]click['"],\(\)=>\{if\(providersOnline<1\)return/, `${label} door requires providersOnline≥1`);
  assert.match(html, /preferOnlineModel\(\$\(['"]model['"]\),false\);setEngine\(['"]community['"],false\);showTf\(['"]ask['"]\)/, `${label} Ask preferred live Community model`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertNightCommunity(disk, "disk");
assertNightCommunity(COMPUTE_PAGE_HTML, "embed");
assert.match(USE_SKILL_MD, /If Mixture is empty but Community has Macs, Night offers Community · N/);
assert.match(USE_SKILL_MD, /Hosted stays available/);

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get("x-dasha-edge"), "compute");
const served = await res.text();
assertNightCommunity(served, "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const zero = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      providersOnline = 0;
      networkModels = new Set();
      networkCapacity = [];
      $("engine").value = "mixture";
      showNightEmpty();
      updateRun();
      const com = document.getElementById("night-use-community");
      const mix = document.getElementById("eng-mixture");
      return {
        hidden: com?.hidden === true,
        door: vis(com),
        text: (com?.textContent || "").trim(),
        mixTitle: mix?.title || "",
        changeTitle: document.getElementById("change-engine")?.title || "",
        h1: document.querySelector("#step-night .tf-q")?.textContent || "",
      };
    });
    assert.equal(zero.hidden, true, "Community door hidden at providers_online:0");
    assert.equal(zero.door, false, "Community door not visible at 0");
    assert.equal(zero.text, "Community");
    assert.equal(zero.mixTitle, "No Mixture Mac · opens Night");
    assert.equal(zero.changeTitle, "Change engine");
    assert.equal(zero.h1, "No Mac online.");

    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
    await page.click("#pick-ask");
    await page.evaluate(() => {
      providersOnline = 2;
      networkModels = new Set(["gemma3-27b"]);
      networkCapacity = [{ model: "gemma3-27b", measured_providers: 1, tokens_per_second: 31.2 }];
      updateRun();
    });
    await page.click("#change-engine");
    await page.click("#eng-mixture");
    const mixEmpty = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      const com = document.getElementById("night-use-community");
      const mix = document.getElementById("eng-mixture");
      return {
        step: document.body.dataset.step,
        q: document.querySelector("#step-night .tf-q")?.textContent || "",
        door: vis(com),
        hidden: com?.hidden === true,
        text: (com?.textContent || "").trim(),
        title: com?.title || "",
        aria: com?.getAttribute("aria-label") || "",
        mixDim: mix?.classList.contains("is-dim"),
        mixTitle: mix?.title || "",
        changeTitle: document.getElementById("change-engine")?.title || "",
        engine: document.getElementById("engine")?.value || "",
      };
    });
    assert.equal(mixEmpty.step, "night", "mixture no SUB24 → night");
    assert.equal(mixEmpty.q, "No Mixture Mac.");
    assert.equal(mixEmpty.engine, "mixture");
    assert.equal(mixEmpty.hidden, false, "Community door shown when Macs up");
    assert.equal(mixEmpty.door, true, "Night offers Community · N");
    assert.equal(mixEmpty.text, "Community · 2");
    assert.equal(mixEmpty.title, "gemma3-27b · 31.2 tok/s measured");
    assert.equal(mixEmpty.aria, "Community · 2 · 31.2 tok/s");
    assert.equal(mixEmpty.mixDim, true);
    assert.equal(mixEmpty.mixTitle, "No Mixture Mac · Community · 2 online");
    assert.equal(mixEmpty.changeTitle, "Change engine · Community · 2 · gemma3-27b · 31.2 tok/s available");

    await page.click("#night-use-community");
    const asked = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      return {
        step: document.body.dataset.step,
        engine: document.getElementById("engine")?.value || "",
        model: document.getElementById("model")?.value || "",
        ask: vis(document.getElementById("step-ask")),
        change: (document.getElementById("change-engine")?.textContent || "").trim(),
      };
    });
    assert.equal(asked.step, "ask", "Community door → Ask");
    assert.equal(asked.engine, "community", "preferred Community engine");
    assert.equal(asked.model, "gemma3-27b", "preferred live model");
    assert.equal(asked.ask, true);
    assert.equal(asked.change, "Community · 2");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-night-mixture-community-capacity: PASS");
