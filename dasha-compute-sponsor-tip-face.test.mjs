#!/usr/bin/env node
/**
 * Live Worker 2bdbdb3a: Sponsor tip face honesty.
 * Pay→Sponsor Amount: $5 tip · face · no crypto discount.
 * Methods USDC · $5 / $dasha · $5 (face, not credit discount theater).
 * Send 5 USDC · $5 tip → dest. API charge=face.
 * Distinct from Credits packs which KEEP crypto discount.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { lockTipAmount, priceFor } from "./dasha-compute-credits.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertTip(html, label) {
  assert.match(html, /id=["']sponsor-buy-fine["'][^>]*>\$5 tip · face · no crypto discount\.</, `${label} sponsor-buy-fine first paint`);
  assert.match(html, /function paintSponsorBuyFine\(/, `${label} paintSponsorBuyFine`);
  assert.match(html, /function formatSponsorTip\(/, `${label} formatSponsorTip`);
  assert.match(html, /formatSponsorTip\(face\)\+' · face · no crypto discount\.'/, `${label} tracks tip face`);
  assert.match(html, /id=["']sponsor-usdc["'][^>]*>USDC · \$5</, `${label} USDC · $5 face`);
  assert.match(html, /id=["']sponsor-dasha["'][^>]*>\$dasha · \$5</, `${label} $dasha · $5 face`);
  assert.match(html, /usdc\.textContent='USDC · '\+faceLabel/, `${label} paint USDC face`);
  assert.match(html, /dasha\.textContent='\$dasha · '\+faceLabel/, `${label} paint \$dasha face`);
  assert.match(html, /sponsorOrder\.amount\+' '\+meth\+' · '\+tip\+' → '/, `${label} Send tip → dest`);
  assert.match(html, /id=["']pay-buy-fine["'][^>]*>\$5 credits · crypto discount · no card yet\.</, `${label} Credits keep crypto discount`);
  assert.match(html, /function paintPayBuyFine\(/, `${label} Credits paintPayBuyFine stays`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertTip(disk, "disk");
assertTip(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assertTip(await res.text(), "worker.fetch");

const tip = await lockTipAmount("usdc", 500, {});
assert.equal(tip.ok, true);
assert.equal(tip.face_cents, 500);
assert.equal(tip.charge_cents, 500, "sponsor API charge=face");
assert.equal(tip.amountUi, "5");

const credit = priceFor("usdc", "5");
assert.equal(credit.face_cents, 500);
assert.equal(credit.charge_cents, 485, "credits KEEP crypto discount");

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
      sponsorPack = "5";
      sponsorCustomCents = null;
      paintSponsorBuy();
      const five = {
        fine: (document.getElementById("sponsor-buy-fine")?.textContent || "").trim(),
        usdc: (document.getElementById("sponsor-usdc")?.textContent || "").trim(),
        dasha: (document.getElementById("sponsor-dasha")?.textContent || "").trim(),
      };
      sponsorPack = "20";
      paintSponsorBuy();
      const twenty = (document.getElementById("sponsor-buy-fine")?.textContent || "").trim();
      sponsorPack = "5";
      loggedIn = true;
      sponsorOrder = { amount: "5", method: "usdc", dest: "11111111111111111111111111111111", face_cents: 500, charge_cents: 500 };
      paintSponsorSend();
      creditPack = "5";
      paintPayBuyFine();
      return {
        five,
        twenty,
        send: (document.getElementById("sponsor-send-line")?.textContent || "").trim(),
        credits: (document.getElementById("pay-buy-fine")?.textContent || "").trim(),
      };
    });
    assert.equal(painted.five.fine, "$5 tip · face · no crypto discount.");
    assert.equal(painted.five.usdc, "USDC · $5");
    assert.equal(painted.five.dasha, "$dasha · $5");
    assert.equal(painted.twenty, "$20 tip · face · no crypto discount.");
    assert.match(painted.send, /5 USDC · \$5 tip → /);
    assert.equal(painted.credits, "$5 credits · crypto discount · no card yet.");
    assert.doesNotMatch(painted.five.fine + painted.send, /4\.85/);
    assert.match(painted.five.fine, /no crypto discount/);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-sponsor-tip-face: PASS");
