#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const disk = readFileSync(new URL("./dasha-compute.html", import.meta.url), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "html ↔ page.mjs sync");

function assertPulse(html, label) {
  assert.match(html, /id=["']provide-beat["']/, `${label} #provide-beat`);
  assert.match(html, /'Online'|`\$\{providersOnline\} online`/, `${label} Online / N online`);
  assert.match(html, /classList\.add\(['"]acid['"]\)/, `${label} acid`);
  assert.match(html, /classList\.add\(['"]waiting['"]\)/, `${label} waiting`);
  assert.match(html, /#provide-beat\.acid\{[^}]*color:var\(--acid\)/, `${label} acid color`);
  assert.match(html, /#provide-beat\.acid::before/, `${label} acid pulse`);
  assert.match(html, /#provide-beat\.waiting::before/, `${label} waiting pulse`);
  assert.match(html, /if\(tto\)tto\.hidden=true/, `${label} hide tto Online`);
  assert.match(html, /if\(tto\)tto\.hidden=false/, `${label} show tto waiting`);
  assert.match(html, /if\(mlx\)mlx\.hidden=true/, `${label} hide prefer-mlx Online`);
  assert.match(html, /if\(mlx\)mlx\.hidden=false/, `${label} show prefer-mlx waiting`);
  assert.match(html, /id=["']provide-prefer-mlx["'][^>]*>Prefer MLX when you can · Ollama ≥0\.33\.1 · models on internal SSD\.</, `${label} prefer-mlx copy`);
  assert.doesNotMatch(html, /Waiting for heartbeat…/, `${label} no waiting essay`);
  assert.doesNotMatch(html, /Mac online · \$\{providersOnline\}/, `${label} no Mac essay`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /Designer/, `${label} no Designer`);
}

assertPulse(disk, "disk");
assertPulse(COMPUTE_PAGE_HTML, "embed");

let puppeteer;
try {
  puppeteer = (await import("puppeteer")).default;
} catch {
  console.log("dasha-compute-provide-online-pulse: PASS (static; no puppeteer)");
  process.exit(0);
}

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, {
    waitUntil: "domcontentloaded",
  });
  // Jump to Setup without inventing Online (providersOnline stays 0)
  const waiting = await page.evaluate(() => {
    providersOnline = 0;
    showTf("provide-done");
    paintProvideBeat();
    const beat = document.getElementById("provide-beat");
    const tto = document.getElementById("provide-tto");
    const mlx = document.getElementById("provide-prefer-mlx");
    return {
      step: document.body.dataset.step,
      beatHidden: beat?.hidden === true,
      text: beat?.textContent || "",
      waiting: beat?.classList.contains("waiting"),
      acid: beat?.classList.contains("acid"),
      aria: beat?.getAttribute("aria-label") || "",
      ttoHidden: tto?.hidden === true,
      ttoText: (tto?.textContent || "").trim(),
      mlxHidden: mlx?.hidden === true,
      mlxText: (mlx?.textContent || "").trim(),
    };
  });
  assert.equal(waiting.step, "provide-done");
  assert.equal(waiting.beatHidden, false, "beat visible on Setup");
  assert.equal(waiting.text, "", "waiting keeps empty text");
  assert.equal(waiting.waiting, true);
  assert.equal(waiting.acid, false, "waiting does not claim Online");
  assert.equal(waiting.aria, "Waiting");
  assert.equal(waiting.ttoHidden, false, "tto visible while waiting");
  assert.match(waiting.ttoText, /About 15–30 min to online\./);
  assert.equal(waiting.mlxHidden, false, "prefer-mlx visible while waiting");
  assert.equal(waiting.mlxText, "Prefer MLX when you can · Ollama ≥0.33.1 · models on internal SSD.");

  const online = await page.evaluate(() => {
    providersOnline = 1;
    paintProvideBeat();
    const beat = document.getElementById("provide-beat");
    const tto = document.getElementById("provide-tto");
    const mlx = document.getElementById("provide-prefer-mlx");
    const cs = getComputedStyle(beat);
    return {
      text: beat?.textContent || "",
      waiting: beat?.classList.contains("waiting"),
      acid: beat?.classList.contains("acid"),
      aria: beat?.getAttribute("aria-label") || "",
      ttoHidden: tto?.hidden === true,
      mlxHidden: mlx?.hidden === true,
      color: cs.color,
    };
  });
  assert.equal(online.text, "Online");
  assert.equal(online.waiting, false);
  assert.equal(online.acid, true);
  assert.equal(online.aria, "Online");
  assert.equal(online.ttoHidden, true, "tto hidden when Online");
  assert.equal(online.mlxHidden, true, "prefer-mlx hidden when Online");
  // acid #dcff00 ≈ rgb(220, 255, 0)
  assert.match(online.color, /220,\s*255,\s*0/, `Online acid color got ${online.color}`);

  const many = await page.evaluate(() => {
    providersOnline = 3;
    paintProvideBeat();
    return document.getElementById("provide-beat")?.textContent || "";
  });
  assert.equal(many, "3 online");

  // Leaving Setup hides beat; no invent on other steps
  const left = await page.evaluate(() => {
    showTf("gate");
    const beat = document.getElementById("provide-beat");
    return { step: document.body.dataset.step, beatHidden: beat?.hidden === true };
  });
  assert.equal(left.step, "gate");
  assert.equal(left.beatHidden, true, "beat hidden off provide-done");
} finally {
  await browser.close();
}

console.log("dasha-compute-provide-online-pulse: PASS");
