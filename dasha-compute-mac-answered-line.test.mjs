#!/usr/bin/env node
/**
 * Quiet honesty under a completed Community Ask reply:
 * "A Mac answered. Join a Mac" → /compute#provide
 * Same routeFace the receipt already uses (job route / provider_class / engine).
 * Never Hosted, fail, clear, or offline. No invented counts.
 * Disk only. No wrangler. No plugin.jup.ag. No /which or /contribute.
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

function assertMacLine(html, label) {
  assert.match(html, /<!-- mac-answered-honesty:2026-09-08 -->/, `${label} marker`);
  assert.match(html, /<p class=["']fine["'] id=["']answer-mac-line["'] hidden><\/p>/, `${label} #answer-mac-line empty+hidden`);
  assert.match(html, /#answer-mac-line:not\(\[hidden\]\)\{display:block!important\}/, `${label} mac line CSS`);
  assert.match(html, /function paintAnswerMacLine\(/, `${label} paintAnswerMacLine`);
  assert.match(
    html,
    /if\(routeFace!==['"]community['"]\|\|!lastPaidReceipt\|\|lastAskFailKind\)/,
    `${label} community + receipt + no fail`,
  );
  assert.match(html, /a\.href=['"]https:\/\/www\.getdasha\.com\/compute#provide['"]/, `${label} Provide href`);
  assert.match(html, /a\.textContent=['"]Join a Mac['"]/, `${label} Join a Mac`);
  assert.match(html, /createTextNode\(['"]A Mac answered\. ['"]\)/, `${label} A Mac answered.`);
  assert.match(html, /paintAnswerReceiptNote\(['"]['"]\);paintAnswerMacLine\(['"]['"]\)/, `${label} hide clears line`);
  assert.match(html, /paintAnswerReceiptNote\(routeFace\);\s*paintAnswerMacLine\(routeFace\)/, `${label} show paints line`);
  assert.match(
    html,
    /const routeFace=\(apiRoute==='self'\|\|apiRoute==='community'\|\|apiRoute==='mixture'\)\?apiRoute/,
    `${label} routeFace from job route`,
  );
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /A Mac answered\. \d+/, `${label} no invented Mac count`);
}

assertMacLine(disk, "disk");
assertMacLine(COMPUTE_PAGE_HTML, "embed");

const servedRes = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(servedRes.status, 200);
assert.equal(servedRes.headers.get("x-dasha-edge"), "compute");
const served = await servedRes.text();
assertMacLine(served, "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const first = await page.evaluate(() => {
      const el = document.getElementById("answer-mac-line");
      return { hidden: el?.hidden === true, text: (el?.textContent || "").trim(), html: el?.innerHTML || "" };
    });
    assert.equal(first.hidden, true, "gate first paint hides mac line");
    assert.equal(first.text, "");
    assert.equal(first.html, "");

    const painted = await page.evaluate(() => {
      const read = () => {
        const el = document.getElementById("answer-mac-line");
        const a = el?.querySelector("a");
        return {
          hidden: el?.hidden === true,
          text: (el?.textContent || "").trim(),
          href: a?.getAttribute("href") || "",
          link: (a?.textContent || "").trim(),
        };
      };
      const run = (receipt, failKind = null) => {
        lastPaidReceipt = receipt;
        lastAskFailKind = failKind;
        paintAnswerReceipt();
        return read();
      };
      return {
        community: run({ tokens: 40, cents: 0, engine: "community", job_id: "job_abc123xyz", model: "gemma3-27b" }),
        communityRoute: run({ tokens: 12, cents: 0, engine: "hosted", route: "community", job_id: "job_route", model: "qwen3-8b" }),
        communityClass: run({ tokens: 8, cents: 0, engine: "hosted", provider_class: "community", job_id: "job_pc", model: "qwen3-8b" }),
        hosted: run({ tokens: 33, cents: 5, engine: "hosted", provider_class: "hosted" }),
        hostedTok: run({ tokens: 8, cents: 0, engine: "hosted" }),
        hostedFree: run({ tokens: 0, cents: 0, engine: "hosted" }),
        mixture: run({ tokens: 12, cents: 0, engine: "mixture", job_id: "job_mix_1", model: "gemma3-12b" }),
        self: run({ tokens: 9, cents: 0, engine: "self", job_id: "job_self_1", model: "qwen3-8b" }),
        failed: run(null, "provider_cut"),
        hostedCut: run(null, "hosted_cut"),
        leftoverFail: run({ tokens: 40, cents: 0, engine: "community", job_id: "job_old", model: "gemma3-27b" }, "provider_cut"),
        cleared: run(null, null),
        offline: run(null, null),
        communityBare: (() => {
          const modelEl = document.getElementById("model");
          const prev = modelEl.value;
          modelEl.value = "";
          const out = run({ tokens: 0, cents: 0, engine: "community" });
          modelEl.value = prev;
          return out;
        })(),
      };
    });

    assert.equal(painted.community.hidden, false, "community success shows line");
    assert.equal(painted.community.text, "A Mac answered. Join a Mac");
    assert.equal(painted.community.href, "https://www.getdasha.com/compute#provide");
    assert.equal(painted.community.link, "Join a Mac");
    assert.doesNotMatch(painted.community.text, /\d+\s+(Mac|tok|user)/i);

    assert.equal(painted.communityRoute.hidden, false, "job route=community shows line");
    assert.equal(painted.communityRoute.text, "A Mac answered. Join a Mac");
    assert.equal(painted.communityClass.hidden, false, "provider_class=community shows line");

    assert.equal(painted.hosted.hidden, true, "hosted paid hides line");
    assert.equal(painted.hosted.text, "");
    assert.equal(painted.hostedTok.hidden, true, "hosted tok hides line");
    assert.equal(painted.hostedFree.hidden, true, "hosted free hides line");

    assert.equal(painted.mixture.hidden, true, "mixture is not Community");
    assert.equal(painted.self.hidden, true, "self is not Community");

    assert.equal(painted.failed.hidden, true, "provider_cut hides line");
    assert.equal(painted.hostedCut.hidden, true, "hosted_cut hides line");
    assert.equal(painted.leftoverFail.hidden, true, "fail kind hides leftover community receipt");
    assert.equal(painted.cleared.hidden, true, "cleared receipt hides line");
    assert.equal(painted.offline.hidden, true, "offline / no receipt hides line");
    assert.equal(painted.communityBare.hidden, true, "bare community without job hides line");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-mac-answered-line: PASS");
