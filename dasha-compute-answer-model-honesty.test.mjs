#!/usr/bin/env node
/**
 * Live ship: Community Ask on Mac gemma3-27b answered `MAC_OK Gemini 1.5 Pro`.
 * Receipt always paints engine + selected/routed model id from $('model').value
 * — never answer self-description / data?.model.
 * Community/self/mixture jobs prepend an idempotent identity system hint.
 * Hosted Workers AI path unchanged.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import {
  ComputeNetwork,
  modelIdentitySystemContent,
  withModelIdentityHint,
} from "./dasha-compute-network.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { COOKIE, createSessionToken } from "./dasha-lobby-x.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
const networkSrc = readFileSync(join(root, "dasha-compute-network.mjs"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertHonesty(html, label) {
  assert.match(html, /function modelIdentityFraming\(messages,modelId\)/, `${label} modelIdentityFraming`);
  assert.match(html, /You are model '\+id\+' on Dasha Compute\. If asked your name\/model, answer with exactly that id\./, `${label} client identity tip`);
  assert.match(html, /if\(community\)messages=modelIdentityFraming\(messages,\$\(['"]model['"]\)\.value\)/, `${label} community wire`);
  assert.match(html, /selected\/routed model id from client\/job only \(never trust answer self-description\)/, `${label} receipt comment`);
  assert.match(html, /lastPaidReceipt=\{tokens:tok,cents:0,engine:eng,job_id:String\(activeJob\|\|''\),model:String\(\$\(['"]model['"]\)\.value\|\|''\)\}/, `${label} SSE receipt selected model`);
  assert.match(html, /lastPaidReceipt=\{tokens:tok,cents:0,engine:eng,job_id:String\(activeJob\|\|job\.id\|\|''\),model:String\(\$\(['"]model['"]\)\.value\|\|''\)\}/, `${label} poll receipt selected model`);
  assert.doesNotMatch(html, /data\?\.model\|\|\$\(['"]model['"]\)\.value/, `${label} never trust data?.model`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertHonesty(disk, "disk");
assertHonesty(COMPUTE_PAGE_HTML, "embed");

const servedRes = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(servedRes.status, 200);
assert.equal(servedRes.headers.get("x-dasha-edge"), "compute");
assertHonesty(await servedRes.text(), "worker.fetch");

assert.match(networkSrc, /export function modelIdentitySystemContent\(/);
assert.match(networkSrc, /export function withModelIdentityHint\(/);
assert.match(networkSrc, /const messages = withModelIdentityHint\(parsed, model\)/);
assert.match(networkSrc, /const parsed = chatMessages\(input\), model = String\(input\.model \|\| ''\)/);
const hosted = networkSrc.slice(networkSrc.indexOf("export async function computeApi"));
assert.match(hosted, /Do not claim to be running on a community Mac; this hosted demo uses Cloudflare Workers AI\./);
assert.doesNotMatch(hosted, /withModelIdentityHint/, "hosted Workers AI path unchanged");

const tip = modelIdentitySystemContent("gemma3-27b");
assert.equal(tip, "You are model gemma3-27b on Dasha Compute. If asked your name/model, answer with exactly that id.");
assert.equal(modelIdentitySystemContent(""), "");
assert.equal(modelIdentitySystemContent("  "), "");

const userOnly = [{ role: "user", content: "What model are you?" }];
const once = withModelIdentityHint(userOnly, "gemma3-27b");
assert.equal(once.length, 2);
assert.deepEqual(once[0], { role: "system", content: tip });
assert.deepEqual(once[1], userOnly[0]);
assert.notEqual(once, userOnly);

const twice = withModelIdentityHint(once, "gemma3-27b");
assert.equal(twice.length, once.length, "idempotent prepend");
assert.equal(twice.filter((row) => row.role === "system" && row.content.includes("on Dasha Compute")).length, 1);
assert.equal(twice, once, "already-hinted array returned unchanged");

const mixed = [
  { role: "system", content: tip },
  { role: "system", content: "You are Dasha Mixture · sub-24GB. Prefer a hot small specialist on the selected model. Be short, fun, useful." },
  { role: "user", content: "name?" },
];
assert.equal(withModelIdentityHint(mixed, "gemma3-27b"), mixed);
assert.equal(withModelIdentityHint(userOnly, ""), userOnly);
assert.equal(withModelIdentityHint(null, "qwen3-8b"), null);

const env = { LOBBY_SESSION_SECRET: "answer-model-honesty-secret", AI: { run: async () => ({ response: "hosted-ok" }) } };
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === "object") for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = "" } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const origin = "https://www.getdasha.com";
const session = await createSessionToken(env, { xId: "honesty-owner", handle: "honesty_mac" });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, "Content-Type": "application/json" };

const register = await network.fetch(new Request("https://lobby.getdasha.com/compute/api/providers/register", {
  method: "POST",
  headers: userHeaders,
  body: JSON.stringify({ name: "Honesty Mac", models: ["gemma3-27b", "qwen3-8b"] }),
}), origin);
assert.equal(register.status, 201);
const credentials = await register.json();
const providerHeaders = { Authorization: `Bearer ${credentials.provider_token}`, "Content-Type": "application/json" };
const heartbeat = { provider_id: credentials.provider_id, name: "Honesty Mac", models: ["gemma3-27b", "qwen3-8b"] };
assert.equal((await network.fetch(new Request("https://lobby.getdasha.com/compute/api/providers/poll", {
  method: "POST", headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin)).status, 204);

const submit = await network.fetch(new Request("https://lobby.getdasha.com/compute/api/jobs", {
  method: "POST",
  headers: userHeaders,
  body: JSON.stringify({ model: "gemma3-27b", prompt: "What model are you?" }),
}), origin);
assert.equal(submit.status, 202);
const submitted = await submit.json();
const poll = await network.fetch(new Request("https://lobby.getdasha.com/compute/api/providers/poll", {
  method: "POST", headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin);
assert.equal(poll.status, 200);
const leased = await poll.json();
assert.equal(leased.job.id, submitted.id);
assert.equal(leased.job.model, "gemma3-27b");
assert.equal(leased.job.messages[0].role, "system");
assert.equal(leased.job.messages[0].content, tip);
assert.equal(leased.job.messages.at(-1).content, "What model are you?");
assert.equal(leased.job.messages.filter((row) => row.role === "system" && row.content.includes("answer with exactly that id")).length, 1);

assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${submitted.id}/result`, {
  method: "POST",
  headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, content: "MAC_OK Gemini 1.5 Pro" }),
}), origin)).status, 202);

const already = await network.fetch(new Request("https://lobby.getdasha.com/compute/api/jobs", {
  method: "POST",
  headers: userHeaders,
  body: JSON.stringify({
    model: "qwen3-8b",
    messages: [
      { role: "system", content: modelIdentitySystemContent("qwen3-8b") },
      { role: "user", content: "name?" },
    ],
  }),
}), origin);
assert.equal(already.status, 202);
const alreadyId = (await already.json()).id;
const alreadyPoll = await network.fetch(new Request("https://lobby.getdasha.com/compute/api/providers/poll", {
  method: "POST", headers: providerHeaders, body: JSON.stringify({ ...heartbeat, models: ["qwen3-8b"] }),
}), origin);
assert.equal(alreadyPoll.status, 200);
const alreadyJob = (await alreadyPoll.json()).job;
assert.equal(alreadyJob.id, alreadyId);
assert.equal(alreadyJob.messages.length, 2, "client-supplied hint is not doubled");
assert.equal(alreadyJob.messages[0].content, modelIdentitySystemContent("qwen3-8b"));
assert.equal(alreadyJob.messages[1].content, "name?");

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
      const modelEl = document.getElementById("model");
      const answer = document.getElementById("answer");
      modelEl.value = "gemma3-27b";
      answer.textContent = "MAC_OK Gemini 1.5 Pro";
      const selected = String(modelEl.value || "");
      lastPaidReceipt = { tokens: 40, cents: 100, engine: "community", job_id: "job_abc123xyz", model: selected };
      paintAnswerReceipt();
      const el = document.getElementById("answer-receipt");
      const framed = modelIdentityFraming([{ role: "user", content: "What model are you?" }], selected);
      const again = modelIdentityFraming(framed, selected);
      return {
        hidden: el?.hidden === true,
        text: (el?.textContent || "").trim(),
        answer: (answer.textContent || "").trim(),
        selected,
        framed: framed[0],
        againLen: again.length,
      };
    });

    assert.equal(painted.selected, "gemma3-27b");
    assert.equal(painted.hidden, false);
    assert.equal(painted.text, "Community · gemma3-27b · 40 tok · job_abc123xyz");
    assert.doesNotMatch(painted.text, /Gemini|1\.5 Pro|MAC_OK/);
    assert.equal(painted.answer, "MAC_OK Gemini 1.5 Pro");
    assert.equal(painted.framed.role, "system");
    assert.equal(painted.framed.content, tip);
    assert.equal(painted.againLen, 2, "client framing idempotent");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-answer-model-honesty: PASS");
