#!/usr/bin/env node
/**
 * Credits top-up face honesty (updated for the real card rail, task 12).
 * #pay-buy-fine / paintPayBuyFine = $N credits · crypto discount (+ card at face when the
 * server reports card_available, else "no card yet") — tracks pack;
 * #credits-fine = pack · crypto discount;
 * #pay-card button exists but stays hidden unless logged in AND network.card_available;
 * Send = 4.85 USDC · +$5 credits → dest.
 * Card checkout is server-gated (503 until Stripe secrets land) — no fake card UI, no % lectures.
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
  assert.match(html, /id=["']pay-buy-fine["'][^>]*>\$5 credits · crypto discount\.</, `${label} pay-buy-fine first paint`);
  assert.match(html, /function paintPayBuyFine\(/, `${label} paintPayBuyFine`);
  assert.match(html, /formatCredits\(face\)\+' credits · crypto discount'\+\(cardAvailable\?' · card at face':' · no card yet'\)\+'\.'/, `${label} tracks pack face + card state`);
  assert.match(html, /el\.textContent='Pack credits · crypto discount'\+\(cardAvailable\?' · card at face':' · no card yet'\)\+'\.'/, `${label} unknown pack fallback`);
  assert.match(html, /paintPayBuyFine\(\)/, `${label} paintPayBuyFine called`);
  assert.match(html, /id=["']credits-fine["'][^>]*>Pack credits · crypto discount\.</, `${label} credits-fine`);
  assert.match(html, /creditOrder\.amount\+' '\+meth\+' · \+'\+credits\+' credits → '/, `${label} Send +credits → dest`);
  assert.match(html, /CREDIT_PACK_CENTS/, `${label} CREDIT_PACK_CENTS`);
  assert.match(html, /id=["']pay-usdc["'][^>]*>USDC · \$4\.85</, `${label} USDC · $4.85`);
  assert.match(html, /id=["']pay-card["'][^>]*hidden>Card · \$5\.00</, `${label} card button present but hidden first paint`);
  assert.match(html, /cardBtn\.hidden=!loggedIn\|\|!cardAvailable/, `${label} card hidden until login + card_available`);
  assert.match(html, /\/compute\/api\/credits\/card\/checkout/, `${label} card checkout endpoint wired`);
  assert.doesNotMatch(html, /Stripe|Card details|card number|Visa|Mastercard/i, `${label} no card brand promises in UI`);
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
      const cardHiddenBefore = document.getElementById("pay-card")?.hidden;
      // Flip card_available on (what the page does once network.card_available is true):
      cardAvailable = true;
      paintPayMethodAuth();
      paintPayMethodPrices();
      paintPayBuyFine();
      const cardVisibleAfter = document.getElementById("pay-card")?.hidden === false;
      const cardLabel = (document.getElementById("pay-card")?.textContent || "").trim();
      const fiveCard = (document.getElementById("pay-buy-fine")?.textContent || "").trim();
      return {
        five,
        twenty,
        credits: (document.getElementById("credits-fine")?.textContent || "").trim(),
        send: (document.getElementById("pay-send-line")?.textContent || "").trim(),
        cardHiddenBefore,
        cardVisibleAfter,
        cardLabel,
        fiveCard,
      };
    });
    assert.equal(painted.five, "$5 credits · crypto discount · no card yet.");
    assert.equal(painted.twenty, "$20 credits · crypto discount · no card yet.");
    assert.equal(painted.credits, "Pack credits · crypto discount.");
    assert.match(painted.send, /4\.85 USDC · \+\$5 credits → /);
    assert.equal(painted.cardHiddenBefore, true, "card button hidden while card_available false");
    assert.equal(painted.cardVisibleAfter, true, "card button appears once card_available + logged in");
    assert.equal(painted.cardLabel, "Card · $5.00", "card button at pack face, no discount");
    assert.equal(painted.fiveCard, "$5 credits · crypto discount · card at face.");
    assert.doesNotMatch(painted.five + painted.twenty + painted.credits + painted.send, /% off|Stripe|card number/i);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-credits-usdc-topup-face: PASS");
