#!/usr/bin/env node
/**
 * T070 — Cactus Needle / needle is tools + extract edge only (cactus-needle / needle2).
 * Must not sit next to Ternary Bonsai in Ask #ask-model, leftover #model,
 * MODELS picker rows, or COMPUTE_CATALOG_MODELS. Not an Ask advertise option.
 * gemma3-27b stays (#258 waits for live bonsai). Test-only. No wrangler.
 * No Designer. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { DashaLobby } from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COMPUTE_CATALOG_MODELS, growAllowedModels } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

const BONSAI = 'ternary-bonsai-2-27b';
const GEMMA27 = 'gemma3-27b';
const NEEDLE_IDS = [
  'needle',
  'needle2',
  'cactus-needle',
  'cactus_needle',
  'cactusneedle',
  'cactus-needle-2',
  'cactus-needle2',
  'ternary-needle',
  'ternary-cactus-needle',
];
const NEEDLE_ID_RE = /needle/i;
const NEEDLE_LABEL_RE = /cactus\s*needle|\bneedle\s*2\b/i;

const CATALOG_PIN = [
  'gemma3-12b',
  'gemma3-27b',
  'gpt-oss-120b',
  'gpt-oss-20b',
  'qwen3-30b-a3b',
  'qwen3-4b',
  'qwen3-8b',
  'ternary-bonsai-2-27b',
];
const LEFTOVER_PIN = [
  'qwen3-8b',
  'qwen3-4b',
  'gemma3-12b',
  'gpt-oss-20b',
  'qwen3-30b-a3b',
  'gemma3-27b',
  'ternary-bonsai-2-27b',
];
const MODELS_PIN = [
  'qwen3-4b',
  'qwen3-8b',
  'gemma3-12b',
  'gpt-oss-20b',
  'qwen3-30b-a3b',
  'gemma3-27b',
  'ternary-bonsai-2-27b',
];

function leftoverSelectIds(html) {
  const block = html.match(/<select id=["']model["']>([\s\S]*?)<\/select>/);
  assert.ok(block, 'leftover #model select');
  return [...block[1].matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([^<]*)/gi)].map((m) => ({
    id: m[1],
    label: m[2],
  }));
}

function modelsRows(html) {
  const block = html.match(/const MODELS=\[([\s\S]*?)\];\s*const SUB24/);
  assert.ok(block, 'MODELS picker array');
  return [...block[1].matchAll(/\['([^']+)'[^\]]*\]/g)].map((m) => m[1]);
}

function askModelStaticIds(html) {
  const block = html.match(/<select id=["']ask-model["'][^>]*>([\s\S]*?)<\/select>/);
  assert.ok(block, '#ask-model pill');
  return [...block[1].matchAll(/<option[^>]*value=["']([^"']+)["']/gi)].map((m) => m[1]);
}

function assertNoNeedleNeighbor(ids, label) {
  assert.ok(ids.includes(BONSAI), `${label} lists bonsai`);
  assert.ok(ids.includes(GEMMA27), `${label} keeps gemma3-27b`);
  assert.ok(!ids.some((id) => NEEDLE_ID_RE.test(id)), `${label} has no needle id`);
  const i = ids.indexOf(BONSAI);
  const neighbors = [ids[i - 1], ids[i + 1]].filter(Boolean);
  assert.ok(!neighbors.some((id) => NEEDLE_ID_RE.test(id)), `${label} needle is not a bonsai neighbor`);
}

function assertNeedleGone(html, label) {
  const leftover = leftoverSelectIds(html);
  const leftoverIds = leftover.map((row) => row.id);
  assert.deepEqual(leftoverIds, LEFTOVER_PIN, `${label} leftover #model pin (no needle)`);
  assertNoNeedleNeighbor(leftoverIds, `${label} leftover #model`);
  for (const row of leftover) {
    assert.doesNotMatch(row.label, NEEDLE_LABEL_RE, `${label} leftover label ${row.id}`);
  }

  const rows = modelsRows(html);
  assert.deepEqual(rows, MODELS_PIN, `${label} MODELS pin (no needle)`);
  assertNoNeedleNeighbor(rows, `${label} MODELS`);

  assert.deepEqual(askModelStaticIds(html), [], `${label} #ask-model is JS-filled, no static needle option`);
  assert.doesNotMatch(html, /value=["'][^"']*needle[^"']*["']/i, `${label} no needle option value`);
  assert.doesNotMatch(html, NEEDLE_LABEL_RE, `${label} no Cactus Needle / Needle 2 copy`);
  assert.match(html, /id=["']ask-model["']/, `${label} Ask model pill stays`);
  assert.match(html, /value=["']ternary-bonsai-2-27b["']/, `${label} leftover still lists bonsai`);
  assert.match(html, /value=["']gemma3-27b["']/, `${label} leftover still lists gemma3-27b`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertNeedleGone(disk, 'disk');
assertNeedleGone(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assertNeedleGone(await served.text(), 'worker.fetch');

const catalog = [...COMPUTE_CATALOG_MODELS].sort();
assert.deepEqual(catalog, [...CATALOG_PIN].sort(), 'COMPUTE_CATALOG_MODELS pin — needle not a catalog neighbor');
assert.ok(catalog.includes(BONSAI), 'catalog includes Community bonsai');
assert.ok(catalog.includes(GEMMA27), 'do not demote gemma3-27b');
assert.ok(!catalog.some((id) => NEEDLE_ID_RE.test(id)), 'catalog has no needle id');

for (const id of NEEDLE_IDS) {
  assert.ok(!COMPUTE_CATALOG_MODELS.has(id), `catalog rejects ${id}`);
  assert.ok(
    !growAllowedModels(['qwen3-8b'], [id, BONSAI]).includes(id),
    `growAllowedModels drops polled ${id}`,
  );
}
assert.deepEqual(growAllowedModels(['qwen3-8b'], [BONSAI, 'cactus-needle', 'needle2']).sort(), [
  'qwen3-8b',
  BONSAI,
]);
assert.ok(
  !growAllowedModels([GEMMA27], NEEDLE_IDS).some((id) => NEEDLE_ID_RE.test(id)),
  'needle stays out of allowedModels even when polled',
);

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-cactus-needle-guard-secret',
};
const token = await createSessionToken(env, { xId: 'needle-guard', handle: 'potter_mac' });
globalThis.WebSocketRequestResponsePair ||= class {};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) { if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item); else rows.set(key, value); },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
  async getAlarm() { return Date.now(); }, async setAlarm() {},
};
let ready;
const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
await ready;
const userHeaders = { Cookie: `${COOKIE}=${token}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };

for (const id of ['cactus-needle', 'needle', 'needle2']) {
  const denied = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Needle Mac', models: [id] }),
  }));
  assert.equal(denied.status, 400, `register ${id} is not a catalog advertise option`);
}

const job = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ model: 'cactus-needle', prompt: 'extract' }),
}));
assert.equal(job.status, 400, 'buyers cannot submit cactus-needle');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    const painted = await page.evaluate((bonsai, needleIds) => {
      const select = document.getElementById('model');
      const leftover = [...select.options].map((o) => ({ id: o.value, text: o.textContent }));
      const jsModels = MODELS.map((row) => row[0]);
      providersOnline = 1;
      networkModels = new Set([bonsai, ...needleIds]);
      networkCapacity = [
        { model: bonsai, measured_providers: 1, tokens_per_second: 1 },
        { model: 'cactus-needle', measured_providers: 1, tokens_per_second: 9 },
      ];
      preferOnlineModel(select, false);
      document.getElementById('engine').value = 'community';
      paintModelChoices();
      paintAskModel();
      const chips = [...document.querySelectorAll('#model-choices [data-model]')].map((b) => b.dataset.model);
      const pill = [...(document.getElementById('ask-model')?.options || [])].map((o) => o.value);
      return {
        leftover,
        jsModels,
        leftoverSelected: select.value,
        chips,
        pill,
      };
    }, BONSAI, NEEDLE_IDS);
    assert.deepEqual(painted.leftover.map((o) => o.id), LEFTOVER_PIN, 'runtime leftover #model pin');
    assert.ok(!painted.leftover.some((o) => NEEDLE_ID_RE.test(o.id) || NEEDLE_LABEL_RE.test(o.text)), 'runtime leftover has no needle');
    assert.deepEqual(painted.jsModels, MODELS_PIN, 'runtime MODELS pin');
    assert.ok(!painted.jsModels.some((id) => NEEDLE_ID_RE.test(id)), 'runtime MODELS has no needle');
    assert.equal(painted.leftoverSelected, BONSAI, 'advertised bonsai wins leftover select');
    assert.deepEqual(painted.chips, [BONSAI], 'Ask chips advertise bonsai only — needle dropped');
    assert.deepEqual(painted.pill, [BONSAI], 'Ask #ask-model advertises bonsai only — needle dropped');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-cactus-needle-not-in-picker: PASS (T070 needle edge-only; bonsai neighbor; gemma3-27b stays)');
