#!/usr/bin/env node
/**
 * Live Worker 18830ca2: Credits USDC top-up face honesty.
 * #pay-buy-fine / paintPayBuyFine = $5 credits · crypto discount · no card yet (tracks pack);
 * #credits-fine = pack · crypto discount · no card;
 * Send = 4.85 USDC · +$5 credits → dest.
 * Do not invent card rails or % lectures.
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

function assertFace(html, label) {
  assert.match(html, /id=["']pay-buy-fine["'][^>]*>\$5 credits · crypto discount · no card yet\.</, `${label} pay-buy-fine first paint`);
  assert.match(html, /function paintPayBuyFine\(/, `${label} paintPayBuyFine`);
  assert.match(html, /formatCredits\(face\)\+' credits · crypto discount · no card yet\.'/, `${label} tracks pack face`);
  assert.match(html, /el\.textContent='Pack credits · crypto discount · no card yet\.'/, `${label} unknown pack fallback`);
  assert.match(html, /paintPayBuyFine\(\)/, `${label} paintPayBuyFine called`);
  assert.match(html, /id=["']credits-fine["'][^>]*>Pack credits · crypto discount · no card yet\.</, `${label} credits-fine`);
  assert.match(html, /creditOrder\.amount\+' '\+meth\+' · \+'\+credits\+' credits → '/, `${label} Send +credits → dest`);
  assert.match(html, /CREDIT_PACK_CENTS/, `${label} CREDIT_PACK_CENTS`);
  assert.match(html, /id=["']pay-usdc["'][^>]*>USDC · \$4\.85</, `${label} USDC · $4.85`);
  assert.doesNotMatch(html, /Stripe|Card details|card number|Visa|Mastercard/i, `${label} no card rails`);
  assert.doesNotMatch(html, /% off|5% off|10% off/, `${label} no % lectures`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertFace(disk, "disk");
assertFace(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assertFace(await res.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
    const painted = await page.evaluate(() => {
      creditPack = "5";
      paintPayBuyFine();
      const five = (document.getElementById("pay-buy-fine")?.textContent || "").trim();
      creditPack = "20";
      paintPayBuyFine();
      const twenty = (document.getElementById("pay-buy-fine")?.textContent || "").trim();
      creditPack = "5";
      creditOrder = { amount: "4.85", method: "usdc", dest: "11111111111111111111111111111111", credits_cents: 500, face_cents: 500 };
      loggedIn = true;
      paintPaySend();
      return {
        five,
        twenty,
        credits: (document.getElementById("credits-fine")?.textContent || "").trim(),
        send: (document.getElementById("pay-send-line")?.textContent || "").trim(),
      };
    });
    assert.equal(painted.five, "$5 credits · crypto discount · no card yet.");
    assert.equal(painted.twenty, "$20 credits · crypto discount · no card yet.");
    assert.equal(painted.credits, "Pack credits · crypto discount · no card yet.");
    assert.match(painted.send, /4\.85 USDC · \+\$5 credits → /);
    assert.doesNotMatch(painted.five + painted.twenty + painted.credits + painted.send, /% off|Stripe|card number/i);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-credits-usdc-topup-face: PASS");
