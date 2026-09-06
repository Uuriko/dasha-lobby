#!/usr/bin/env node
/**
 * Live Worker e094f268: Ask Community capacity when providersOnline≥1.
 * Quiet #ask-community door (Community · N), measured model/tok/s on How
 * #eng-community title, #how-floor-fine live capacity, Hosted stays default.
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

function assertCapacity(html, label) {
  assert.match(html, /id=["']ask-community["'][^>]*hidden[^>]*>Community</, `${label} quiet #ask-community hidden first paint`);
  assert.match(html, /id=["']ask-community-sep["'][^>]*hidden/, `${label} ask-community-sep hidden`);
  assert.match(html, /function paintAskCommunity\(/, `${label} paintAskCommunity`);
  assert.match(html, /chip\.textContent=`Community · \$\{providersOnline\}`/, `${label} Community · N`);
  assert.match(html, /function paintHowFloorFine\(/, `${label} paintHowFloorFine`);
  assert.match(html, /id=["']how-floor-fine["'][^>]*>Local Macs \+ Hosted floor\.</, `${label} how-floor-fine idle copy`);
  assert.match(html, /el\.textContent=`\$\{n\} · \$\{model\} · \$\{tpsLabel\} tok\/s · Hosted floor\.`/, `${label} how-floor-fine measured`);
  assert.match(html, /function fleetMeasuredLabel\(/, `${label} fleetMeasuredLabel`);
  assert.match(html, /engCom\.title=tpsLabel\?\(model\?`\$\{model\} · \$\{tpsLabel\} tok\/s measured`/, `${label} How #eng-community measured title`);
  assert.match(html, /paintAskEngine\(\);paintAskMyMac\(\);paintAskCommunity\(\);paintHowFloorFine\(\);paintAskFreeFine\(\)/, `${label} paint chain`);
  assert.match(html, /else if\(id==='ask'\)\{cameFromHow=false;cameFromGate=true;setComputeIntent\('ask'\);setEngine\('hosted',true\)\}/, `${label} #ask Hosted default`);
  assert.match(html, /id=["']change-engine["'][^>]*>Hosted</, `${label} change-engine Hosted`);
  assert.match(html, /ask-community['"]\)\?\.addEventListener\(['"]click['"],\(\)=>\{if\(providersOnline<1\)return/, `${label} door requires providersOnline≥1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertCapacity(disk, "disk");
assertCapacity(COMPUTE_PAGE_HTML, "embed");
assert.match(USE_SKILL_MD, /quiet Community · N door/);
assert.match(USE_SKILL_MD, /Hosted stays the default/);

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get("x-dasha-edge"), "compute");
const served = await res.text();
assertCapacity(served, "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.click("#pick-ask");
    const idle = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      providersOnline = 0;
      networkModels = new Set();
      networkCapacity = [];
      updateRun();
      return {
        engine: document.getElementById("engine")?.value || "",
        door: vis(document.getElementById("ask-community")),
        doorText: (document.getElementById("ask-community")?.textContent || "").trim(),
        change: (document.getElementById("change-engine")?.textContent || "").trim(),
      };
    });
    assert.equal(idle.engine, "hosted", "Hosted stays default");
    assert.equal(idle.door, false, "Community door hidden at 0");
    assert.equal(idle.doorText, "Community");
    assert.equal(idle.change, "Hosted");

    const live = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      providersOnline = 2;
      networkModels = new Set(["qwen3-8b"]);
      networkCapacity = [{ model: "qwen3-8b", measured_providers: 1, tokens_per_second: 42.5 }];
      updateRun();
      showTf("how");
      const com = document.getElementById("eng-community");
      return {
        door: vis(document.getElementById("ask-community")),
        doorText: (document.getElementById("ask-community")?.textContent || "").trim(),
        doorTitle: document.getElementById("ask-community")?.title || "",
        howTitle: com?.title || "",
        howText: (com?.textContent || "").trim(),
        floor: (document.getElementById("how-floor-fine")?.textContent || "").trim(),
        engine: document.getElementById("engine")?.value || "",
      };
    });
    assert.equal(live.engine, "hosted", "capacity paint does not yank Hosted");
    assert.equal(live.door, false, "Community door lives on Ask, not How");
    assert.equal(live.doorText, "Community · 2");
    assert.match(live.doorTitle, /qwen3-8b · 42\.5 tok\/s measured/);
    assert.equal(live.howText, "Community · 2");
    assert.match(live.howTitle, /qwen3-8b · 42\.5 tok\/s measured/);
    assert.equal(live.floor, "2 · qwen3-8b · 42.5 tok/s · Hosted floor.");

    await page.evaluate(() => { showTf("ask"); updateRun(); });
    const onAsk = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      return {
        door: vis(document.getElementById("ask-community")),
        text: (document.getElementById("ask-community")?.textContent || "").trim(),
      };
    });
    assert.equal(onAsk.door, true, "Community door on Ask when Macs up");
    assert.equal(onAsk.text, "Community · 2");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ask-community-capacity: PASS");
