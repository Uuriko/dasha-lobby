#!/usr/bin/env node
/**
 * Live Worker e094f268: Ask Community capacity when providersOnline≥1.
 * Quiet #ask-community door (Community · N), measured model/tok/s on How
 * #eng-community title, #how-floor-fine live capacity.
 * Community is the Ask default when providersOnline≥1; Hosted is a quieter door.
 * How: Community ink-on-acid primary when Macs up; Hosted secondary.
 * Warm/keepalive Hosted Run adopts Community unless Hosted was chosen. Explicit Hosted stays.
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
  assert.match(html, /id=["']ask-hosted["'][^>]*hidden[^>]*>Hosted</, `${label} quiet #ask-hosted hidden first paint`);
  assert.match(html, /id=["']ask-hosted-sep["'][^>]*hidden/, `${label} ask-hosted-sep hidden`);
  assert.match(html, /function paintAskCommunity\(/, `${label} paintAskCommunity`);
  assert.match(html, /function paintAskHosted\(/, `${label} paintAskHosted`);
  assert.match(html, /function paintHowEngineDoors\(/, `${label} paintHowEngineDoors`);
  assert.match(html, /communityPrimary=macs&&!hostedChosenThisSession/, `${label} Community How primary when Macs`);
  assert.match(html, /if\(eng==='hosted'&&!hostedChosenThisSession\)/, `${label} Hosted Run reconsider Community`);
  assert.match(html, /if\(!onGate\)updateRun\(\)/, `${label} honesty adopt via updateRun`);
  assert.match(html, /chip\.textContent=`Community · \$\{providersOnline\}`/, `${label} Community · N`);
  assert.match(html, /function paintHowFloorFine\(/, `${label} paintHowFloorFine`);
  assert.match(html, /id=["']how-floor-fine["'][^>]*>Local Macs \+ Hosted floor\.</, `${label} how-floor-fine idle copy`);
  assert.match(html, /el\.textContent=`\$\{n\} · \$\{model\} · \$\{tpsLabel\} tok\/s · Hosted floor\.`/, `${label} how-floor-fine measured`);
  assert.match(html, /function fleetMeasuredLabel\(/, `${label} fleetMeasuredLabel`);
  assert.match(html, /engCom\.title=tpsLabel\?\(model\?`\$\{model\} · \$\{tpsLabel\} tok\/s measured`/, `${label} How #eng-community measured title`);
  assert.match(html, /paintAskEngine\(\);paintAskMyMac\(\);paintAskCommunity\(\);paintHowFloorFine\(\);paintAskFreeFine\(\)/, `${label} paint chain`);
  assert.match(html, /else if\(id==='ask'\)\{setComputeIntent\('ask'\);enterAskEngine\(true\)\}/, `${label} #ask enterAskEngine`);
  assert.match(html, /function enterAskEngine\(/, `${label} enterAskEngine`);
  assert.match(html, /function maybeAdoptCommunityDefault\(/, `${label} maybeAdoptCommunityDefault`);
  assert.match(html, /id=["']change-engine["'][^>]*>Hosted</, `${label} change-engine Hosted`);
  assert.match(html, /ask-community['"]\)\?\.addEventListener\(['"]click['"],\(\)=>\{if\(providersOnline<1\)return/, `${label} door requires providersOnline≥1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertCapacity(disk, "disk");
assertCapacity(COMPUTE_PAGE_HTML, "embed");
assert.match(USE_SKILL_MD, /Ask defaults to Community and the live advertised model/);
assert.match(USE_SKILL_MD, /Hosted stays a quieter door/);
assert.match(USE_SKILL_MD, /Explicit Hosted click stays Hosted/);

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
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
    await page.click("#pick-ask");
    const idle = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      hostedLive = true;
      providersOnline = 0;
      networkModels = new Set();
      networkCapacity = [];
      updateRun();
      return {
        engine: document.getElementById("engine")?.value || "",
        door: vis(document.getElementById("ask-community")),
        doorText: (document.getElementById("ask-community")?.textContent || "").trim(),
        hostDoor: vis(document.getElementById("ask-hosted")),
        change: (document.getElementById("change-engine")?.textContent || "").trim(),
        howHostPrimary: document.getElementById("eng-hosted")?.classList.contains("primary") === true,
        howComPrimary: document.getElementById("eng-community")?.classList.contains("primary") === true,
      };
    });
    assert.equal(idle.engine, "hosted", "Hosted default at 0 Macs");
    assert.equal(idle.door, false, "Community door hidden at 0");
    assert.equal(idle.hostDoor, false, "Hosted door hidden at 0");
    assert.equal(idle.doorText, "Community");
    assert.equal(idle.change, "Hosted");
    assert.equal(idle.howHostPrimary, true, "How Hosted is the one primary at 0 Macs");
    assert.equal(idle.howComPrimary, false, "How Community not primary at 0 Macs");

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
        model: document.getElementById("model")?.value || "",
      };
    });
    assert.equal(live.engine, "community", "Macs up + no Hosted click → Community");
    assert.equal(live.model, "qwen3-8b", "selects live advertised model");
    assert.equal(live.door, false, "Community door lives on Ask, not How");
    assert.equal(live.doorText, "Community · 2");
    assert.match(live.doorTitle, /qwen3-8b · 42\.5 tok\/s measured/);
    assert.equal(live.howText, "Community · 2");
    assert.match(live.howTitle, /qwen3-8b · 42\.5 tok\/s measured/);
    assert.equal(live.floor, "2 · qwen3-8b · 42.5 tok/s · Hosted floor.");

    const onAsk = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      hostedChosenThisSession = false;
      providersOnline = 2;
      networkModels = new Set(["qwen3-8b"]);
      networkCapacity = [{ model: "qwen3-8b", measured_providers: 1, tokens_per_second: 42.5 }];
      showTf("ask");
      updateRun();
      const com = document.getElementById("ask-community");
      const host = document.getElementById("ask-hosted");
      return {
        engine: document.getElementById("engine")?.value || "",
        comDoor: vis(com),
        comHidden: com?.hidden === true,
        hostDoor: vis(host),
        hostHidden: host?.hidden === true,
        hostText: (host?.textContent || "").trim(),
        howComPrimary: document.getElementById("eng-community")?.classList.contains("primary") === true,
        howHostSecondary: document.getElementById("eng-hosted")?.classList.contains("secondary") === true,
        n: providersOnline,
      };
    });
    assert.equal(onAsk.n, 2);
    assert.equal(onAsk.engine, "community", "Ask prefers Community when Macs up");
    assert.equal(onAsk.comHidden, true, "Community door hidden when already Community");
    assert.equal(onAsk.comDoor, false, "Community door not a second primary");
    assert.equal(onAsk.hostHidden, false, "Hosted door not hidden attr");
    assert.equal(onAsk.hostDoor, true, "Hosted quieter door on Community Ask");
    assert.equal(onAsk.hostText, "Hosted");
    assert.equal(onAsk.howComPrimary, true, "How Community is the one primary");
    assert.equal(onAsk.howHostSecondary, true, "How Hosted is secondary");

    await page.evaluate(() => {
      hostedChosenThisSession = false;
      providersOnline = 2;
      networkModels = new Set(["qwen3-8b"]);
      showTf("gate");
    });
    await page.click("#pick-ask");
    const fromGate = await page.evaluate(() => ({
      engine: document.getElementById("engine")?.value || "",
      step: document.body.dataset.step,
      change: (document.getElementById("change-engine")?.textContent || "").trim(),
    }));
    assert.equal(fromGate.step, "ask");
    assert.equal(fromGate.engine, "community", "Start → Ask lands Community when Macs up");
    assert.match(fromGate.change, /Community/);

    const explicit = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      hostedChosenThisSession = true;
      $("engine").value = "hosted";
      providersOnline = 2;
      networkModels = new Set(["gemma3-27b", "qwen3-8b"]);
      updateRun();
      return {
        engine: document.getElementById("engine")?.value || "",
        comDoor: vis(document.getElementById("ask-community")),
        hostDoor: vis(document.getElementById("ask-hosted")),
        howHostPrimary: document.getElementById("eng-hosted")?.classList.contains("primary") === true,
        howComSecondary: document.getElementById("eng-community")?.classList.contains("secondary") === true,
      };
    });
    assert.equal(explicit.engine, "hosted", "explicit Hosted click stays Hosted");
    assert.equal(explicit.comDoor, true, "Community door on explicit Hosted");
    assert.equal(explicit.hostDoor, false, "Hosted door hidden when already Hosted");
    assert.equal(explicit.howHostPrimary, true, "How Hosted primary after explicit click");
    assert.equal(explicit.howComSecondary, true, "How Community secondary after explicit Hosted");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ask-community-capacity: PASS");
