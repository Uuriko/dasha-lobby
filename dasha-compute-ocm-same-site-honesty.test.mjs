#!/usr/bin/env node
/**
 * Live Worker 770747c3: OCM same-site honesty.
 * Marketplace/Host leave fines that said "Leaves Dasha." are gone —
 * CTAs already same-site /compute/ocm*. Start. cold paint stays.
 * Never plugin.jup.ag. Never rewrite ocm/ gateway source.
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

function assertHonesty(html, label) {
  assert.match(html, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} Start. cold paint`);
  assert.match(html, /aria-label=["']Start\.["']/, `${label} Start. aria`);
  assert.match(html, /id=["']step-gate["'][^>]*data-tf=["']gate["'](?![^>]*hidden)/, `${label} gate visible default`);
  assert.match(html, /id=["']pick-ask["'][^>]*>Ask</, `${label} Ask gate`);
  assert.match(html, /id=["']pick-provide["'][^>]*>Provide</, `${label} Provide gate`);
  assert.match(html, /id=["']pick-pay["'][^>]*>Pay</, `${label} Pay gate`);
  assert.match(html, /id=["']pick-credits["'][^>]*>Credits</, `${label} Credits gate`);
  assert.match(html, /id=["']market-open["'][^>]*href=["']\/compute\/ocm["'][^>]*>Console</, `${label} Console → /compute/ocm`);
  assert.match(html, /id=["']market-host["'][^>]*href=["']\/compute\/ocm\/provider["']/, `${label} Market Host → /compute/ocm/provider`);
  assert.match(html, /id=["']host-run["'][^>]*href=["']\/compute\/ocm\/provider["'][^>]*>Open</, `${label} Host Open → /compute/ocm/provider`);
  assert.doesNotMatch(html, /Leaves Dasha\./, `${label} no Leaves Dasha.`);
  assert.doesNotMatch(html, /id=["']market-leave-fine["']/, `${label} no market-leave-fine`);
  assert.doesNotMatch(html, /id=["']host-leave-fine["']/, `${label} no host-leave-fine`);
  assert.doesNotMatch(html, /href=["']https?:\/\/ocm\.getdasha\.com/, `${label} no hard ocm host leave`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertHonesty(disk, "disk");
assertHonesty(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get("x-dasha-edge"), "compute");
const served = await res.text();
assertHonesty(served, "worker.fetch");
assert.match(served, /<h1 class="tf-q">Start\.<\/h1>/);

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
    const cold = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      return {
        step: document.body.dataset.step,
        start: (document.querySelector("#step-gate .tf-q")?.textContent || "").trim(),
        gate: vis(document.getElementById("step-gate")),
        leave: document.body.innerText.includes("Leaves Dasha."),
      };
    });
    assert.equal(cold.step, "gate", "cold boot Start.");
    assert.equal(cold.start, "Start.");
    assert.equal(cold.gate, true);
    assert.equal(cold.leave, false, "cold paint has no Leaves Dasha.");

    await page.click("#pick-ask");
    await page.click("#ask-ocm");
    const market = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      return {
        step: document.body.dataset.step,
        title: (document.querySelector("#step-market .tf-q")?.textContent || "").trim(),
        openHref: document.getElementById("market-open")?.getAttribute("href") || "",
        hostHref: document.getElementById("market-host")?.getAttribute("href") || "",
        leaveFine: document.getElementById("market-leave-fine"),
        leave: document.body.innerText.includes("Leaves Dasha."),
        open: vis(document.getElementById("market-open")),
      };
    });
    assert.equal(market.step, "market");
    assert.equal(market.title, "Marketplace.");
    assert.equal(market.open, true);
    assert.equal(market.openHref, "/compute/ocm");
    assert.equal(market.hostHref, "/compute/ocm/provider");
    assert.equal(market.leaveFine, null);
    assert.equal(market.leave, false);

    await page.click("#step-market .tf-back");
    await page.click("#ask-host");
    const host = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      return {
        step: document.body.dataset.step,
        title: (document.querySelector("#step-host .tf-q")?.textContent || "").trim(),
        openHref: document.getElementById("host-run")?.getAttribute("href") || "",
        leaveFine: document.getElementById("host-leave-fine"),
        leave: document.body.innerText.includes("Leaves Dasha."),
        open: vis(document.getElementById("host-run")),
      };
    });
    assert.equal(host.step, "host");
    assert.equal(host.title, "Host.");
    assert.equal(host.open, true);
    assert.equal(host.openHref, "/compute/ocm/provider");
    assert.equal(host.leaveFine, null);
    assert.equal(host.leave, false);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ocm-same-site-honesty: PASS");
