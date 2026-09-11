#!/usr/bin/env node
/**
 * Live Worker 1aae5b34: OCM post-Graham Host sync (OCM-POST-GRAHAM-SYNC-2026-09-06).
 * Enroll-first ocm_enroll_; installer prompts (never argv token);
 * ocm-agent-update (+ --check); Cold ≠ Warming;
 * Provide Register #provide-ocm-fine / #provide-ocm-host / #provide-ocm-status.
 * No New provider token. Stay off Graham desk ocm/.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker, { potterHome308Dest } from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { OCM_HOST_SKILL_MD } from "./dasha-compute-skills.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
const ocmDisk = readFileSync(join(root, "dasha-compute-skills/OCM-HOST.md"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");
assert.equal(OCM_HOST_SKILL_MD, ocmDisk, "OCM skill embed == disk");

function assertOcmFold(html, label) {
  assert.match(html, /id=["']provide-ocm-fine["']/, `${label} provide-ocm-fine`);
  assert.match(html, /Community kit · one Register → Setup · soft doctor warns only\./, `${label} enroll fine copy`);
  assert.match(html, /Enroll code · never paste a provider token\./, `${label} enroll never-paste copy`);
  assert.match(html, /id=["']market-host["'][^>]*href=["']\/compute\/ocm\/provider["'][^>]*>Host</, `${label} market-host`);
  assert.match(html, /id=["']provide-ocm-status["'][^>]*href=["']\/compute\/ocm\/status["']/, `${label} provide-ocm-status`);
  assert.match(html, /title=["']Cold loads on first request · Ready\/Serving ~1s["']/, `${label} Cold status title`);
  assert.match(html, /id=["']ask-provide["'][^>]*>Provide</, `${label} Ask Provide`);
  assert.match(html, /id=["']ask-ocm["'][^>]*>Marketplace</, `${label} Ask Marketplace`);
  assert.match(html, /id=["']ask-host["'][^>]*>Host</, `${label} Ask Host`);
  assert.match(html, /id=["']market-open["'][^>]*href=["']\/compute\/ocm["']/, `${label} Console → OCM`);
  assert.match(html, /id=["']gate-ocm["'][^>]*href=["']\/compute\/ocm["']/, `${label} Start Marketplace door`);
  assert.match(html, /id=["']market-enroll-fine["'][^>]*>OCM uses ocm_live_ or email — not your Compute X login\.</, `${label} OCM key honesty`);
  assert.doesNotMatch(html, /New provider token/, `${label} no New provider token`);
  assert.doesNotMatch(html, /OCM_HOST_TOKEN="ocm_host_/, `${label} no argv OCM_HOST_TOKEN`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertOcmFold(disk, "disk");
assertOcmFold(COMPUTE_PAGE_HTML, "embed");

assert.match(OCM_HOST_SKILL_MD, /ocm_enroll_/);
assert.match(OCM_HOST_SKILL_MD, /ocm-agent-update/);
assert.match(OCM_HOST_SKILL_MD, /--check/);
assert.match(OCM_HOST_SKILL_MD, /\bCold\b/);
assert.match(OCM_HOST_SKILL_MD, /Cold is not broken Warming/);
assert.match(OCM_HOST_SKILL_MD, /Enroll a Mac/);
assert.match(OCM_HOST_SKILL_MD, /never paste a provider token on the command line/);
assert.match(OCM_HOST_SKILL_MD, /sudo OCM_AGENT_ID="a-stable-name" sh install\.sh/);
assert.doesNotMatch(OCM_HOST_SKILL_MD, /New provider token/);
assert.doesNotMatch(OCM_HOST_SKILL_MD, /OCM_HOST_TOKEN="ocm_host_/);
assert.doesNotMatch(OCM_HOST_SKILL_MD, /plugin\.jup\.ag/);

assert.equal(potterHome308Dest('/compute/marketplace'), 'https://www.getdasha.com/compute/ocm');
assert.equal(potterHome308Dest('/compute/market'), 'https://www.getdasha.com/compute/ocm');
assert.equal(potterHome308Dest('/marketplace'), 'https://www.getdasha.com/compute/ocm');
assert.equal(potterHome308Dest('/market'), 'https://www.getdasha.com/compute/ocm');
assert.doesNotMatch(disk, /\/ocm\/provider\/(?:status|healthz)/, 'no invented /provider/status');
assert.doesNotMatch(OCM_HOST_SKILL_MD, /\/provider\/(?:status|healthz)/, 'skill status is /ocm/status');

const servedRes = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(servedRes.status, 200);
assert.equal(servedRes.headers.get("x-dasha-edge"), "compute");
assertOcmFold(await servedRes.text(), "worker.fetch");

const skill = await worker.fetch(new Request("https://www.getdasha.com/compute/skill/ocm-host.md"), {});
assert.equal(skill.status, 200);
assert.equal(skill.headers.get("x-dasha-edge"), "compute-skill-ocm-host");
const skillBody = await skill.text();
assert.equal(skillBody, OCM_HOST_SKILL_MD);
assert.match(skillBody, /ocm_enroll_/);
assert.match(skillBody, /ocm-agent-update/);
assert.match(skillBody, /\bCold\b/);
assert.doesNotMatch(skillBody, /New provider token/);

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { if (typeof showTf === "function") showTf("provide-reg"); });
    const painted = await page.evaluate(() => {
      const fine = document.getElementById("provide-ocm-fine");
      const host = document.getElementById("market-host");
      const status = document.getElementById("provide-ocm-status");
      return {
        fine: (fine?.textContent || "").trim(),
        hostHref: host?.getAttribute("href") || "",
        statusHref: status?.getAttribute("href") || "",
        statusTitle: status?.getAttribute("title") || "",
        body: document.body.innerText,
      };
    });
    assert.match(painted.fine, /Community kit · one Register/);
    assert.match(painted.fine, /soft doctor warns only/);
    assert.equal(painted.hostHref, "/compute/ocm/provider");
    assert.equal(painted.statusHref, "/compute/ocm/status");
    assert.equal(painted.statusTitle, "Cold loads on first request · Ready/Serving ~1s");
    assert.doesNotMatch(painted.body, /New provider token/);
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ocm-enroll-fold: PASS");
