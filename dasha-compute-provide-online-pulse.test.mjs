#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const disk = readFileSync(new URL("./dasha-compute.html", import.meta.url), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "html ↔ page.mjs sync");

function provideAddMac(html) {
  const m = html.match(/<button[^>]*id=["']provide-add-mac["'][^>]*>[\s\S]*?<\/button>/);
  assert.ok(m, "#provide-add-mac present");
  return m[0];
}

function assertPulse(html, label) {
  assert.match(html, /id=["']provide-beat["']/, `${label} #provide-beat`);
  assert.match(html, /id=["']provide-queue["']/, `${label} #provide-queue`);
  assert.match(html, /function applyJobsQueued\(/, `${label} applyJobsQueued`);
  assert.match(html, /function paintProvideQueue\(/, `${label} paintProvideQueue`);
  assert.match(html, /jobs_queued/, `${label} live jobs_queued`);
  assert.match(html, /ownMacOnline/, `${label} keys Online off ownMacOnline`);
  assert.match(html, /mine>=1&&!provideExpectingNew/, `${label} first-Mac lock`);
  assert.match(html, /'Online'|`\$\{mine\} online`/, `${label} Online / N online`);
  assert.match(html, /classList\.add\(['"]acid['"]\)/, `${label} acid`);
  assert.match(html, /classList\.add\(['"]waiting['"]\)/, `${label} waiting`);
  assert.match(html, /#provide-beat\.acid\{[^}]*color:var\(--acid\)/, `${label} acid color`);
  assert.match(html, /#provide-beat\.acid::before/, `${label} acid pulse`);
  assert.match(html, /#provide-beat\.waiting::before/, `${label} waiting pulse`);
  assert.match(html, /if\(tto\)tto\.hidden=true/, `${label} hide tto Online`);
  assert.match(html, /if\(tto\)tto\.hidden=false/, `${label} show tto waiting`);
  assert.match(html, /if\(mlx\)mlx\.hidden=true/, `${label} hide prefer-mlx Online`);
  assert.match(html, /if\(mlx\)mlx\.hidden=false/, `${label} show prefer-mlx waiting`);
  assert.match(html, /if\(ka\)ka\.hidden=true/, `${label} hide keepalive Online`);
  assert.match(html, /if\(ka\)ka\.hidden=false/, `${label} show keepalive waiting`);
  assert.match(html, /if\(sd\)sd\.hidden=true/, `${label} hide softdoctor Online`);
  assert.match(html, /if\(sd\)sd\.hidden=false/, `${label} show softdoctor waiting`);
  assert.match(html, /id=["']provide-prefer-mlx["'][^>]*>Prefer MLX when you can · Ollama ≥0\.33\.1 · models on internal SSD\.</, `${label} prefer-mlx copy`);
  assert.match(html, /id=["']provide-keepalive["']/, `${label} #provide-keepalive`);
  assert.match(html, /id=["']provide-softdoctor["']/, `${label} #provide-softdoctor`);
  assert.match(html, /function snapshotProvideExpecting\(\)/, `${label} snapshotProvideExpecting`);
  assert.match(html, /function clearProvideExpecting\(\)/, `${label} clearProvideExpecting`);
  assert.match(html, /function maybeClearProvideExpecting\(/, `${label} maybeClearProvideExpecting`);
  assert.match(html, /provideExpectingNew=true/, `${label} provideExpectingNew=true`);
  assert.match(html, /\$\(['"]provide-add-mac['"]\)\?\.addEventListener\(['"]click['"]/, `${label} add-mac click`);
  assert.match(html, /snapshotProvideExpecting\(\)/, `${label} add-mac snapshots`);
  const add = provideAddMac(html);
  assert.match(add, /title=["']Community Register · not Host \/ OCM enroll["']/, `${label} add-mac Community Register title`);
  assert.doesNotMatch(add, /Host\/OCM/, `${label} add-mac title not Host/OCM`);
  assert.doesNotMatch(add, /\/compute\/ocm\//, `${label} add-mac no /compute/ocm/ href`);
  assert.doesNotMatch(html, /Waiting for heartbeat…/, `${label} no waiting essay`);
  assert.doesNotMatch(html, /Mac online · \$\{providersOnline\}/, `${label} no Mac essay`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /Designer/, `${label} no Designer`);
}

assertPulse(disk, "disk");
assertPulse(COMPUTE_PAGE_HTML, "embed");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {}
if (!puppeteer || !existsSync(chrome)) {
  console.log("dasha-compute-provide-online-pulse: PASS (static; no puppeteer)");
  process.exit(0);
}

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

  const waiting = await page.evaluate(() => {
    loggedIn = true;
    ownMacOnline = 0;
    provideExpectingNew = false;
    showTf("provide-done");
    paintProvideBeat();
    const beat = document.getElementById("provide-beat");
    const queue = document.getElementById("provide-queue");
    const tto = document.getElementById("provide-tto");
    const mlx = document.getElementById("provide-prefer-mlx");
    const ka = document.getElementById("provide-keepalive");
    const sd = document.getElementById("provide-softdoctor");
    return {
      step: document.body.dataset.step,
      beatHidden: beat?.hidden === true,
      text: beat?.textContent || "",
      waiting: beat?.classList.contains("waiting"),
      acid: beat?.classList.contains("acid"),
      aria: beat?.getAttribute("aria-label") || "",
      queueHidden: queue?.hidden === true,
      queueText: queue?.textContent || "",
      ttoHidden: tto?.hidden === true,
      ttoText: (tto?.textContent || "").trim(),
      mlxHidden: mlx?.hidden === true,
      mlxText: (mlx?.textContent || "").trim(),
      kaHidden: ka?.hidden === true,
      sdHidden: sd?.hidden === true,
    };
  });
  assert.equal(waiting.step, "provide-done");
  assert.equal(waiting.beatHidden, false, "beat visible on Setup");
  assert.equal(waiting.text, "", "waiting keeps empty text");
  assert.equal(waiting.waiting, true);
  assert.equal(waiting.acid, false, "waiting does not claim Online");
  assert.equal(waiting.aria, "Waiting");
  assert.equal(waiting.queueHidden, true, "queue hidden while waiting");
  assert.equal(waiting.queueText, "", "no invented queue while waiting");
  assert.equal(waiting.ttoHidden, false, "tto visible while waiting");
  assert.match(waiting.ttoText, /About 15–30 min to online\./);
  assert.equal(waiting.mlxHidden, false, "prefer-mlx visible while waiting");
  assert.equal(waiting.mlxText, "Prefer MLX when you can · Ollama ≥0.33.1 · models on internal SSD.");
  assert.equal(waiting.kaHidden, false, "keepalive visible while waiting");
  assert.equal(waiting.sdHidden, false, "softdoctor visible while waiting");

  const online = await page.evaluate(() => {
    loggedIn = true;
    ownMacOnline = 1;
    provideExpectingNew = false;
    paintProvideBeat();
    const beat = document.getElementById("provide-beat");
    const queue = document.getElementById("provide-queue");
    const tto = document.getElementById("provide-tto");
    const mlx = document.getElementById("provide-prefer-mlx");
    const ka = document.getElementById("provide-keepalive");
    const sd = document.getElementById("provide-softdoctor");
    const cs = getComputedStyle(beat);
    return {
      text: beat?.textContent || "",
      waiting: beat?.classList.contains("waiting"),
      acid: beat?.classList.contains("acid"),
      aria: beat?.getAttribute("aria-label") || "",
      queueHidden: queue?.hidden === true,
      queueText: queue?.textContent || "",
      ttoHidden: tto?.hidden === true,
      mlxHidden: mlx?.hidden === true,
      kaHidden: ka?.hidden === true,
      sdHidden: sd?.hidden === true,
      color: cs.color,
    };
  });
  assert.equal(online.text, "Online");
  assert.equal(online.waiting, false);
  assert.equal(online.acid, true);
  assert.equal(online.aria, "Online");
  assert.equal(online.queueHidden, true, "queue hidden when jobs_queued is 0");
  assert.equal(online.queueText, "", "no invented 0 queued");
  assert.equal(online.ttoHidden, true, "tto hidden when Online");
  assert.equal(online.mlxHidden, true, "prefer-mlx hidden when Online");
  assert.equal(online.kaHidden, true, "keepalive hidden when Online");
  assert.equal(online.sdHidden, true, "softdoctor hidden when Online");
  assert.match(online.color, /220,\s*255,\s*0/, `Online acid color got ${online.color}`);

  const secondMacWait = await page.evaluate(() => {
    loggedIn = true;
    ownMacOnline = 1;
    provideExpectingNew = true;
    paintProvideBeat();
    const beat = document.getElementById("provide-beat");
    const tto = document.getElementById("provide-tto");
    const mlx = document.getElementById("provide-prefer-mlx");
    const ka = document.getElementById("provide-keepalive");
    const sd = document.getElementById("provide-softdoctor");
    return {
      text: beat?.textContent || "",
      waiting: beat?.classList.contains("waiting"),
      acid: beat?.classList.contains("acid"),
      aria: beat?.getAttribute("aria-label") || "",
      ttoHidden: tto?.hidden === true,
      mlxHidden: mlx?.hidden === true,
      kaHidden: ka?.hidden === true,
      sdHidden: sd?.hidden === true,
    };
  });
  assert.equal(secondMacWait.text, "", "second-Mac wait stays empty");
  assert.equal(secondMacWait.waiting, true, "ownMacOnline≥1 + expecting → Waiting");
  assert.equal(secondMacWait.acid, false, "second-Mac wait is not Online");
  assert.equal(secondMacWait.aria, "Waiting");
  assert.equal(secondMacWait.ttoHidden, false, "tto visible while expecting new");
  assert.equal(secondMacWait.mlxHidden, false, "prefer-mlx visible while expecting new");
  assert.equal(secondMacWait.kaHidden, false, "keepalive visible while expecting new");
  assert.equal(secondMacWait.sdHidden, false, "softdoctor visible while expecting new");

  const many = await page.evaluate(() => {
    loggedIn = true;
    ownMacOnline = 3;
    provideExpectingNew = false;
    paintProvideBeat();
    return document.getElementById("provide-beat")?.textContent || "";
  });
  assert.equal(many, "3 online");

  const queued = await page.evaluate(() => {
    loggedIn = true;
    ownMacOnline = 1;
    provideExpectingNew = false;
    jobsQueued = 3;
    showTf("provide-done");
    paintProvideBeat();
    const onlineQ = {
      beat: document.getElementById("provide-beat")?.textContent || "",
      queueHidden: document.getElementById("provide-queue")?.hidden === true,
      queue: document.getElementById("provide-queue")?.textContent || "",
    };
    jobsQueued = 0;
    applyJobsQueued({ jobs_queued: 2 });
    paintProvideBeat();
    const applied = {
      stored: jobsQueued,
      queue: document.getElementById("provide-queue")?.textContent || "",
    };
    applyJobsQueued({});
    paintProvideBeat();
    const missing = {
      stored: jobsQueued,
      queueHidden: document.getElementById("provide-queue")?.hidden === true,
      queue: document.getElementById("provide-queue")?.textContent || "",
    };
    jobsQueued = 4;
    ownMacOnline = 0;
    paintProvideBeat();
    const waitingQ = {
      queueHidden: document.getElementById("provide-queue")?.hidden === true,
      queue: document.getElementById("provide-queue")?.textContent || "",
    };
    return { onlineQ, applied, missing, waitingQ };
  });
  assert.equal(queued.onlineQ.beat, "Online");
  assert.equal(queued.onlineQ.queueHidden, false, "queue shows when jobs_queued > 0");
  assert.equal(queued.onlineQ.queue, "3 queued");
  assert.equal(queued.applied.stored, 2);
  assert.equal(queued.applied.queue, "2 queued");
  assert.equal(queued.missing.stored, 0, "missing jobs_queued is not invented");
  assert.equal(queued.missing.queueHidden, true);
  assert.equal(queued.missing.queue, "");
  assert.equal(queued.waitingQ.queueHidden, true, "queue stays off Waiting");
  assert.equal(queued.waitingQ.queue, "");

  const addMac = await page.evaluate(() => {
    loggedIn = true;
    ownMacOnline = 1;
    ownMacIds = new Set(["mac-1"]);
    provideExpectingNew = false;
    showTf("provide-done");
    paintProvideBeat();
    const add = document.getElementById("provide-add-mac");
    add.click();
    return {
      expecting: !!provideExpectingNew,
      snapped: [...provideExpectingIds],
      step: document.body.dataset.step,
      title: add.getAttribute("title") || "",
      href: add.getAttribute("href"),
      tag: add.tagName,
    };
  });
  assert.equal(addMac.expecting, true, "#provide-add-mac sets provideExpectingNew");
  assert.deepEqual(addMac.snapped, ["mac-1"], "add-mac snapshots current ownMac ids");
  assert.equal(addMac.step, "provide-name");
  assert.equal(addMac.title, "Community Register · not Host / OCM enroll");
  assert.equal(addMac.href, null, "add-mac is not an OCM link");
  assert.equal(addMac.tag, "BUTTON");

  const afterNewAdvertise = await page.evaluate(() => {
    loggedIn = true;
    ownMacOnline = 1;
    provideExpectingNew = true;
    provideExpectingIds = new Set(["mac-1"]);
    provideExpectingNewId = "mac-2";
    showTf("provide-done");
    maybeClearProvideExpecting([{ id: "mac-1", online: true }]);
    paintProvideBeat();
    const stillWaiting = {
      expecting: !!provideExpectingNew,
      text: document.getElementById("provide-beat")?.textContent || "",
      waiting: document.getElementById("provide-beat")?.classList.contains("waiting"),
      kaHidden: document.getElementById("provide-keepalive")?.hidden === true,
    };
    ownMacOnline = 2;
    maybeClearProvideExpecting([
      { id: "mac-1", online: true },
      { id: "mac-2", online: true },
    ]);
    paintProvideBeat();
    return {
      stillWaiting,
      after: {
        expecting: !!provideExpectingNew,
        text: document.getElementById("provide-beat")?.textContent || "",
        waiting: document.getElementById("provide-beat")?.classList.contains("waiting"),
        acid: document.getElementById("provide-beat")?.classList.contains("acid"),
        kaHidden: document.getElementById("provide-keepalive")?.hidden === true,
        sdHidden: document.getElementById("provide-softdoctor")?.hidden === true,
      },
    };
  });
  assert.equal(afterNewAdvertise.stillWaiting.expecting, true, "older Mac advertising does not clear expecting");
  assert.equal(afterNewAdvertise.stillWaiting.waiting, true);
  assert.equal(afterNewAdvertise.stillWaiting.kaHidden, false);
  assert.equal(afterNewAdvertise.after.expecting, false, "new provider_id advertise clears expecting");
  assert.equal(afterNewAdvertise.after.text, "2 online");
  assert.equal(afterNewAdvertise.after.waiting, false);
  assert.equal(afterNewAdvertise.after.acid, true);
  assert.equal(afterNewAdvertise.after.kaHidden, true);
  assert.equal(afterNewAdvertise.after.sdHidden, true);

  const left = await page.evaluate(() => {
    loggedIn = true;
    ownMacOnline = 1;
    provideExpectingNew = true;
    showTf("gate");
    const beat = document.getElementById("provide-beat");
    return {
      step: document.body.dataset.step,
      beatHidden: beat?.hidden === true,
      expecting: !!provideExpectingNew,
    };
  });
  assert.equal(left.step, "gate");
  assert.equal(left.beatHidden, true, "beat hidden off provide-done");
  assert.equal(left.expecting, false, "leaving Setup clears provideExpectingNew");
} finally {
  await browser.close();
}

console.log("dasha-compute-provide-online-pulse: PASS");
