#!/usr/bin/env node
/**
 * Live Worker f20e3cde: Build curl soft-prefers a live online catalog model.
 * paintCode defaults qwen3-8b; when networkModels known and qwen offline,
 * use first live MODELS id. Re-paint after auth + refreshProvideDone.
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

function assertPaintCode(html, label) {
  assert.match(html, /function paintCode\(\)\{/, `${label} paintCode`);
  assert.match(html, /let model='qwen3-8b'/, `${label} default qwen3-8b`);
  assert.match(
    html,
    /if\(networkModels\.size&&!networkModels\.has\(model\)\)\{\s*const hit=MODELS\.find\(item=>networkModels\.has\(item\[0\]\)\);\s*if\(hit\)model=hit\[0\];/,
    `${label} first live MODELS id when qwen offline`,
  );
  assert.match(html, /JSON\.stringify\(\{model,messages:\[\{role:'user',content:'hello'\}\],stream:true\}\)/, `${label} hello curl`);
  assert.doesNotMatch(html, /JSON\.stringify\(\{model:'qwen3-8b',messages:\[\{role:'user',content:'hello'\}\],stream:true\}\)/, `${label} no hardcoded qwen curl`);
  assert.match(
    html,
    /\$\(['"]live-dot['"]\)\.classList\.toggle\(['"]live['"],hostedLive\|\|providersOnline>=1\);\s*paintSplit\(\);\s*paintCode\(\);/,
    `${label} refreshProvideDone re-paints`,
  );
  assert.match(html, /paintSettled24h\(\);\s*paintCode\(\);\s*loadSettled24h\(\);/, `${label} auth re-paints`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertPaintCode(disk, "disk");
assertPaintCode(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get("x-dasha-edge"), "compute");
assertPaintCode(await res.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const idle = await page.evaluate(() => {
      networkModels = new Set();
      paintCode();
      return document.getElementById("code")?.textContent || "";
    });
    assert.match(idle, /"model":"qwen3-8b"/, "empty catalog keeps qwen3-8b");
    assert.match(idle, /"content":"hello"/, "curl hello");

    const qwenLive = await page.evaluate(() => {
      networkModels = new Set(["qwen3-8b", "gemma3-27b"]);
      paintCode();
      return document.getElementById("code")?.textContent || "";
    });
    assert.match(qwenLive, /"model":"qwen3-8b"/, "qwen online stays default");

    const offline = await page.evaluate(() => {
      networkModels = new Set(["gemma3-27b", "gpt-oss-20b"]);
      paintCode();
      return document.getElementById("code")?.textContent || "";
    });
    assert.match(offline, /"model":"gpt-oss-20b"/, "qwen offline → first live MODELS id");
    assert.doesNotMatch(offline, /"model":"qwen3-8b"/, "qwen offline does not keep qwen");
    assert.doesNotMatch(offline, /"model":"gemma3-27b"/, "MODELS order beats network-set order");

    const unknown = await page.evaluate(() => {
      networkModels = new Set(["not-a-catalog-id"]);
      paintCode();
      return document.getElementById("code")?.textContent || "";
    });
    assert.match(unknown, /"model":"qwen3-8b"/, "unknown-only catalog keeps example qwen id");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-build-curl-soft-prefer-online: PASS");
