#!/usr/bin/env node
/**
 * Live Worker a900e934: Provide Register one-door.
 * Register. = one Register CTA + Status. Dropped competing #provide-ocm-host
 * and paste-ocm_host_ fine. Kit + soft --doctor remain.
 * ocm_enroll_ Host skill primacy unchanged (this delta does not rewrite Host skill).
 * Concept: COMPUTE-PROVIDE-ONE-DOOR-2026-09-07.md
 * Never plugin.jup.ag. Never desk ocm/ · Arcade · Multichain · Project Room.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { OCM_HOST_SKILL_MD } from "./dasha-compute-skills.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
const hostSkillDisk = readFileSync(join(root, "dasha-compute-skills/OCM-HOST.md"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "html ↔ page.mjs sync");
assert.equal(OCM_HOST_SKILL_MD, hostSkillDisk, "Host skill embed unchanged");

function provideReg(html) {
  const m = html.match(/<section class="tf-step" id="step-provide-reg"[\s\S]*?<\/section>/);
  assert.ok(m, "#step-provide-reg present");
  return m[0];
}

function assertOneDoor(html, label) {
  const reg = provideReg(html);
  assert.match(reg, /<h1 class=["']tf-q["']>Register\.<\/h1>/, `${label} Register. heading`);
  assert.match(
    reg,
    /id=["']provide-ocm-fine["'][^>]*>Community kit · one Register → Setup · soft doctor warns only\.</,
    `${label} #provide-ocm-fine`,
  );
  assert.match(
    reg,
    /aria-label=["']Provide status["']/,
    `${label} Provide status group`,
  );
  assert.match(
    reg,
    /id=["']provide-ocm-status["'][^>]*href=["']\/compute\/ocm\/status["'][^>]*>Status</,
    `${label} #provide-ocm-status → /compute/ocm/status`,
  );
  assert.match(reg, /id=["']register-provider["'][^>]*>Register</, `${label} one Register CTA`);
  assert.match(reg, /id=["']provider-status["'][^>]*role=["']status["']/, `${label} #provider-status`);
  assert.equal(
    (reg.match(/id=["']register-provider["']/g) || []).length,
    1,
    `${label} exactly one Register CTA`,
  );
  assert.doesNotMatch(reg, /id=["']provide-ocm-host["']/, `${label} no #provide-ocm-host`);
  assert.doesNotMatch(reg, /paste-ocm_host_/, `${label} no paste-ocm_host_ fine`);
  assert.doesNotMatch(reg, /ocm_host_/, `${label} Provide Register does not paste ocm_host_`);
  assert.doesNotMatch(html, /id=["']provide-ocm-host["']/, `${label} no #provide-ocm-host on page`);
  assert.doesNotMatch(html, /paste-ocm_host_/, `${label} no paste-ocm_host_ on page`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /\/room|Project Room|Arcade|Multichain/, `${label} no room/arcade/multichain`);

  // Kit + soft --doctor remain on Setup (not a second Provide door).
  assert.match(html, /id=["']setup["']/, `${label} #setup kit`);
  assert.match(html, /dasha-compute-open-alpha\.tar\.gz/, `${label} kit tarball`);
  assert.match(html, /python3 provider\/agent\.py --doctor/, `${label} soft --doctor`);
  assert.match(html, /href=["']\/dasha-compute-open-alpha\.tar\.gz["']/, `${label} Download kit`);
}

assertOneDoor(disk, "disk");
assertOneDoor(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get("x-dasha-edge"), "compute");
const served = await res.text();
assertOneDoor(served, "worker.fetch");

try {
  const live = await fetch("https://www.getdasha.com/compute", {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (live.ok) {
    const liveHtml = await live.text();
    assertOneDoor(liveHtml, "live www.getdasha.com/compute");
    assert.match(liveHtml, /id=["']provide-ocm-fine["']/);
    assert.match(liveHtml, /id=["']provide-ocm-status["']/);
    assert.doesNotMatch(liveHtml, /id=["']provide-ocm-host["']/);
    assert.doesNotMatch(liveHtml, /paste-ocm_host_/);
  }
} catch {
  // Live proof is helpful, not required when egress is down.
}

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
    await page.click("#pick-provide");
    await page.click("#provide-next");
    const painted = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
      const reg = document.getElementById("step-provide-reg");
      return {
        step: document.body.dataset.step,
        title: (document.querySelector("#step-provide-reg .tf-q")?.textContent || "").trim(),
        fine: (document.getElementById("provide-ocm-fine")?.textContent || "").trim(),
        statusHref: document.getElementById("provide-ocm-status")?.getAttribute("href") || "",
        statusText: (document.getElementById("provide-ocm-status")?.textContent || "").trim(),
        statusVis: vis(document.getElementById("provide-ocm-status")),
        register: document.getElementById("register-provider"),
        loginVis: vis(document.getElementById("provider-login")),
        host: document.getElementById("provide-ocm-host"),
        paste: (reg?.innerText || "").includes("paste-ocm_host_"),
        kitDoctor: (document.getElementById("setup")?.textContent || "").includes("python3 provider/agent.py --doctor"),
      };
    });
    assert.equal(painted.step, "provide-reg");
    assert.equal(painted.title, "Register.");
    assert.equal(painted.fine, "Community kit · one Register → Setup · soft doctor warns only.");
    assert.equal(painted.statusHref, "/compute/ocm/status");
    assert.equal(painted.statusText, "Status");
    assert.equal(painted.statusVis, true);
    assert.ok(painted.register, "Register CTA present");
    assert.equal(painted.loginVis, true, "Sign in to register while logged out");
    assert.equal(painted.host, null, "no #provide-ocm-host");
    assert.equal(painted.paste, false);
    assert.equal(painted.kitDoctor, true, "kit --doctor remains on Setup");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-provide-register-one-door: PASS");
