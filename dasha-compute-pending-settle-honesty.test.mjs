#!/usr/bin/env node
/**
 * Live Worker e80b86b6: provider pending-settle honesty.
 * Earn/Provide rates + Request payout say operator settle / not auto;
 * pending rows `Pending · operator settles · $X · not auto`;
 * PROVIDE skill Facts match. No auto treasury.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { PROVIDE_SKILL_MD } from "./dasha-compute-skills.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
const provideDisk = readFileSync(join(root, "dasha-compute-skills/PROVIDE.md"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");
assert.equal(PROVIDE_SKILL_MD, provideDisk, "PROVIDE skill embed matches disk");

function assertSettle(html, label) {
  assert.match(html, /id="earn-rates">\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle/, `${label} earn-rates`);
  assert.match(html, /id="provide-earn-fine">\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle/, `${label} provide-earn-fine`);
  assert.match(html, /pending operator settle/, `${label} formatEarnRatesLine`);
  assert.match(html, /title="Queues for operator settle · not auto"/, `${label} Request payout title`);
  assert.match(html, /aria-label="Request payout · operator settles · not auto"/, `${label} Request payout aria`);
  assert.match(html, /btn\.title='Queues for operator settle · not auto'/, `${label} paintEarn payout title`);
  assert.match(html, /Pending · operator settles/, `${label} pending row prefix`);
  assert.match(html, /Pending · operator settles · '\+formatUsdCents/, `${label} status Pending · operator settles · $X`);
  assert.match(html, /' USDC'\)\+' · not auto'/, `${label} status · not auto`);
  assert.doesNotMatch(html, /auto treasury|auto-treasury|autoTreasury/i, `${label} no auto treasury`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertSettle(disk, "disk");
assertSettle(COMPUTE_PAGE_HTML, "embed");
assert.match(PROVIDE_SKILL_MD, /pending operator settle · not auto/);
assert.doesNotMatch(PROVIDE_SKILL_MD, /operator\/treasury/);
assert.doesNotMatch(PROVIDE_SKILL_MD, /auto treasury/i);
assert.doesNotMatch(PROVIDE_SKILL_MD, /plugin\.jup\.ag/);

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assertSettle(await res.text(), "worker.fetch");

const skill = await worker.fetch(new Request("https://www.getdasha.com/compute/skill/provide.md"), {});
assert.equal(skill.status, 200);
assert.equal(await skill.text(), PROVIDE_SKILL_MD);

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    const painted = await page.evaluate(() => {
      loggedIn = true;
      earnLoaded = true;
      earnTotalUsdc = 250;
      earnTotalJobs = 3;
      earnMethod = "usdc";
      earnRates = { job_cents: 5, token_cents_per_1k: 1, min_payout_cents: 100 };
      earnPending = [{ status: "pending", payout_cents: 250, method: "usdc" }];
      paintEarn();
      const btn = document.getElementById("earn-payout");
      return {
        rates: (document.getElementById("earn-rates")?.textContent || "").trim(),
        provide: (document.getElementById("provide-earn-fine")?.textContent || "").trim(),
        pending: (document.getElementById("earn-pending")?.textContent || "").trim(),
        btnTitle: btn?.title || "",
        btnAria: btn?.getAttribute("aria-label") || "",
        btnText: (btn?.textContent || "").trim(),
      };
    });
    assert.equal(painted.rates, "$0.05/job + $0.01/1k completion · min $1 · pending operator settle");
    assert.equal(painted.provide, "$0.05/job + $0.01/1k completion · min $1 · pending operator settle");
    assert.match(painted.pending, /Pending · operator settles/);
    assert.match(painted.pending, /\$2\.50/);
    assert.doesNotMatch(painted.pending, /auto treasury/i);
    assert.equal(painted.btnText, "Request payout");
    assert.equal(painted.btnTitle, "Queues for operator settle · not auto");
    assert.equal(painted.btnAria, "Request payout · operator settles · not auto");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-pending-settle-honesty: PASS");
