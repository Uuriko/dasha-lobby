#!/usr/bin/env node
/**
 * Live Worker be6936e5: guest Community Ask login resume.
 * Stash engine+draft; after auth restore Community/Mixture if Mac still up;
 * else Hosted floor keep draft. Markers ASK_ENGINE_KEY / takeAskResume /
 * applyAskResumeEngine.
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

function assertResume(html, label) {
  assert.match(html, /const ASK_ENGINE_KEY='dasha-compute-ask-engine'/, `${label} ASK_ENGINE_KEY`);
  assert.match(html, /function takeAskResume\(/, `${label} takeAskResume`);
  assert.match(html, /function takeAskResumeDraft\(/, `${label} takeAskResumeDraft`);
  assert.match(html, /function applyAskResumeEngine\(/, `${label} applyAskResumeEngine`);
  assert.match(html, /sessionStorage\.setItem\(ASK_ENGINE_KEY,eng\)/, `${label} stash engine`);
  assert.match(html, /if\(eng==='community'&&providersOnline>=1\)want='community'/, `${label} restore Community if Mac up`);
  assert.match(html, /else if\(eng==='mixture'&&!fleetEmpty\('mixture'\)\)want='mixture'/, `${label} restore Mixture if Mac up`);
  assert.match(html, /honest Hosted floor \(keep draft\)/, `${label} Hosted floor keep draft`);
  assert.match(html, /if\(pendingAskResumeEngine\)applyAskResumeEngine\(\)/, `${label} apply after auth`);
  assert.match(html, /Stay on Ask with draft; applyAskResumeEngine after auth knows fleet/, `${label} resume stays on Ask`);
  assert.match(html, /function resumeAskAfterLogin\(\)|resumeAskAfterLogin\(\)/, `${label} resumeAskAfterLogin`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertResume(disk, "disk");
assertResume(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assertResume(await res.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    const stashed = await page.evaluate(() => {
      providersOnline = 1;
      networkModels = new Set(["qwen3-8b"]);
      networkCapacity = [{ model: "qwen3-8b", measured_providers: 1, tokens_per_second: 30 }];
      $("engine").value = "community";
      $("prompt").value = "Draft a curl that POSTs JSON to an HTTPS API.";
      saveAskDraftForLogin();
      return {
        draft: sessionStorage.getItem("dasha-compute-ask-draft"),
        resume: sessionStorage.getItem("dasha-compute-ask-resume"),
        engine: sessionStorage.getItem("dasha-compute-ask-engine"),
      };
    });
    assert.match(stashed.draft, /Draft a curl/);
    assert.equal(stashed.resume, "1");
    assert.equal(stashed.engine, "community");

    const restored = await page.evaluate(() => {
      $("prompt").value = "";
      const pack = takeAskResume();
      pendingAskResumeEngine = pack.engine;
      if (pack.text) $("prompt").value = pack.text;
      providersOnline = 1;
      networkModels = new Set(["qwen3-8b"]);
      applyAskResumeEngine();
      return {
        engine: $("engine").value,
        step: document.body.dataset.step,
        draft: ($("prompt").value || "").trim(),
        leftover: sessionStorage.getItem("dasha-compute-ask-engine"),
      };
    });
    assert.equal(restored.engine, "community", "restore Community when Mac still up");
    assert.equal(restored.step, "ask");
    assert.match(restored.draft, /Draft a curl/);
    assert.equal(restored.leftover, null);

    await page.evaluate(() => {
      $("engine").value = "community";
      $("prompt").value = "Keep this draft.";
      saveAskDraftForLogin();
    });
    const floored = await page.evaluate(() => {
      const pack = takeAskResume();
      pendingAskResumeEngine = pack.engine;
      if (pack.text) $("prompt").value = pack.text;
      providersOnline = 0;
      networkModels = new Set();
      applyAskResumeEngine();
      return {
        engine: $("engine").value,
        step: document.body.dataset.step,
        draft: ($("prompt").value || "").trim(),
      };
    });
    assert.equal(floored.engine, "hosted", "Mac gone → Hosted floor");
    assert.equal(floored.step, "ask");
    assert.equal(floored.draft, "Keep this draft.");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ask-guest-community-resume: PASS");
