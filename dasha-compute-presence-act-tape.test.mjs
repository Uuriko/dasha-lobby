#!/usr/bin/env node
/**
 * Live Worker 96798503: presence-strip / Act tape (PRESENCE-ACT-TAPE-SHIP-2026-09-06).
 * Gate Start. shows #presence-act-boot (No Mac advertising / N advertising)
 * + enrolled from ocm healthz + #act-tape-boot via formatSettledLine.
 * Post-Start wraps macs+enrolled in #presence-strip and settled in #act-tape.
 * paintPresenceActBoot + paintHonestyPanel mutual exclusion.
 * Enrolled ≠ advertising. Never invent tok/s or host counts.
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

function assertPresenceAct(html, label) {
  assert.match(html, /id=["']presence-act-boot["']/, `${label} presence-act-boot`);
  assert.match(html, /id=["']presence-strip["']/, `${label} presence-strip`);
  assert.match(html, /id=["']act-tape["']/, `${label} act-tape`);
  assert.match(html, /id=["']presence-community["'][^>]*>No Mac advertising</, `${label} No Mac advertising`);
  assert.match(html, /id=["']presence-enrolled-boot["']/, `${label} presence-enrolled-boot`);
  assert.match(html, /id=["']act-tape-boot["']/, `${label} act-tape-boot`);
  assert.match(html, /function paintPresenceActBoot\(/, `${label} paintPresenceActBoot`);
  assert.match(html, /n\+' advertising'/, `${label} N advertising`);
  assert.match(html, /No Mac advertising/, `${label} zero advertising copy`);
  assert.match(html, /Community advertising ≠ OCM enrolled/, `${label} advertising ≠ enrolled`);
  assert.match(html, /OCM enrolled · not the same as advertising/, `${label} enrolled ≠ advertising`);
  assert.match(html, /never pad enrolled OCM/, `${label} never pad enrolled`);
  assert.match(html, /boot\.hidden=!onGate/, `${label} boot hidden off gate`);
  assert.match(html, /panel\.hidden=onGate/, `${label} panel hidden on gate`);
  assert.match(html, /paintPresenceActBoot\(\)/, `${label} paintPresenceActBoot call`);
  assert.match(html, /refreshHonesty[\s\S]*?const onGate=tfStep==='gate'/, `${label} refreshHonesty runs on gate`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /\/room|Project Room/, `${label} no Project Room`);
}

assertPresenceAct(disk, "disk");
assertPresenceAct(COMPUTE_PAGE_HTML, "embed");

const servedRes = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(servedRes.status, 200);
assert.equal(servedRes.headers.get("x-dasha-edge"), "compute");
assertPresenceAct(await servedRes.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const gate = await page.evaluate(() => {
      paintPresenceActBoot();
      const boot = document.getElementById("presence-act-boot");
      const panel = document.getElementById("honesty-panel");
      const community = document.getElementById("presence-community");
      const enrolled = document.getElementById("presence-enrolled-boot");
      return {
        bootHidden: boot?.hidden === true,
        panelHidden: panel?.hidden === true,
        community: (community?.textContent || "").trim(),
        enrolledHidden: enrolled?.hidden === true,
        act: (document.getElementById("act-tape-boot")?.textContent || "").trim(),
      };
    });
    assert.equal(gate.bootHidden, false, "boot visible on Start.");
    assert.equal(gate.panelHidden, true, "panel hidden on Start.");
    assert.equal(gate.community, "No Mac advertising");
    assert.equal(gate.enrolledHidden, true, "no enrolled invented");
    assert.equal(gate.act, "0 tok · 24h");

    const advertising = await page.evaluate(() => {
      providersOnline = 2;
      networkCapacity = [{ model: "qwen3-8b", measured_providers: 1, tokens_per_second: 3.1 }];
      ocmHosts = 4;
      paintPresenceActBoot();
      return {
        text: document.getElementById("presence-community").textContent,
        enrolled: document.getElementById("presence-enrolled-boot").textContent,
        enrolledHidden: document.getElementById("presence-enrolled-boot").hidden === true,
      };
    });
    assert.equal(advertising.text, "2 advertising · qwen3-8b · ~3.1 tok/s");
    assert.equal(advertising.enrolled, "4 enrolled");
    assert.equal(advertising.enrolledHidden, false);
    assert.notEqual(advertising.text.includes("enrolled"), true, "advertising line omits enrolled");

    const noInvent = await page.evaluate(() => {
      providersOnline = 1;
      networkCapacity = [{ model: "qwen3-8b", measured_providers: 0, tokens_per_second: 42 }];
      ocmHosts = null;
      paintPresenceActBoot();
      return {
        text: document.getElementById("presence-community").textContent,
        enrolledHidden: document.getElementById("presence-enrolled-boot").hidden === true,
      };
    });
    assert.equal(noInvent.text, "1 advertising · qwen3-8b", "never invent tok/s");
    assert.equal(noInvent.enrolledHidden, true, "never invent host counts");

    const pastGate = await page.evaluate(() => {
      showTf("ask");
      const boot = document.getElementById("presence-act-boot");
      const panel = document.getElementById("honesty-panel");
      const strip = document.getElementById("presence-strip");
      const tape = document.getElementById("act-tape");
      return {
        bootHidden: boot?.hidden === true,
        panelHidden: panel?.hidden === true,
        stripParent: !!strip && panel.contains(strip),
        tapeParent: !!tape && panel.contains(tape),
      };
    });
    assert.equal(pastGate.bootHidden, true, "boot hidden post-Start");
    assert.equal(pastGate.panelHidden, false, "panel visible post-Start");
    assert.equal(pastGate.stripParent, true, "presence-strip wraps post-Start macs");
    assert.equal(pastGate.tapeParent, true, "act-tape wraps post-Start settled");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-presence-act-tape: PASS");
