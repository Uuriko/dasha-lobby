#!/usr/bin/env node
/**
 * Allow-list Community model id ternary-bonsai-2-27b so a Mac can advertise
 * Ternary Bonsai 2 27B (local kit: openai :8080 / Ternary-Bonsai-2-27B-PQ2_0).
 * Hosted gpt-oss-* floor stays unchanged. Not Mixture / SUB24.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { DashaLobby } from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import {
  COMPUTE_CATALOG_MODELS,
  growAllowedModels,
  HOSTED_FLOOR_MODEL_ID,
  HOSTED_FLOOR_OWNED_BY,
  v1ModelsListData,
} from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

const BONSAI = 'ternary-bonsai-2-27b';

function assertCatalog(html, label) {
  assert.match(html, /value=["']ternary-bonsai-2-27b["']/, `${label} leftover/select lists bonsai`);
  assert.match(html, /Ternary Bonsai 2 27B · PQ2 · community/, `${label} Ask model-row label`);
  assert.match(
    html,
    /\['ternary-bonsai-2-27b','Ternary-Bonsai-2-27B-PQ2_0','Ternary Bonsai 2 27B','PQ2',24,'community'\]/,
    `${label} MODELS picker row`,
  );
  assert.match(html, /SUB24=new Set\(\['qwen3-4b','qwen3-8b','gemma3-12b','gpt-oss-20b','qwen3-30b-a3b','qwen3\.5-4b','qwen3\.5-9b','gemma4-e2b'\]\)/, `${label} SUB24 unchanged`);
  assert.doesNotMatch(html, /SUB24=new Set\([^)]*ternary-bonsai-2-27b/, `${label} bonsai not Mixture`);
  assert.match(html, /value=["']gpt-oss-20b["']/, `${label} Hosted gpt-oss-20b option stays`);
  assert.match(html, /id=["']ask-composer["']/, `${label} Ask composer shell stays`);
  assert.match(html, /id=["']ask-model["']/, `${label} Ask model pill stays`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertCatalog(disk, 'disk');
assertCatalog(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assertCatalog(await served.text(), 'worker.fetch');

assert.ok([...COMPUTE_CATALOG_MODELS].includes(BONSAI), 'catalog includes Community bonsai');
assert.equal(HOSTED_FLOOR_MODEL_ID, 'gpt-oss-20b', 'Hosted floor id unchanged');
assert.equal(HOSTED_FLOOR_OWNED_BY, 'dasha-hosted', 'Hosted owned_by unchanged');
assert.deepEqual(v1ModelsListData([]), [], 'Hosted gpt-oss-20b stays unlisted while not serving');
assert.ok(!growAllowedModels(['qwen3-8b'], ['not-a-model']).includes('not-a-model'));
assert.deepEqual(growAllowedModels(['qwen3-8b'], [BONSAI]).sort(), ['qwen3-8b', BONSAI]);

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-ternary-bonsai-secret',
};
const token = await createSessionToken(env, { xId: 'bonsai', handle: 'potter_mac' });
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

const unknown = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Nope', models: ['not-a-model'] }),
}));
assert.equal(unknown.status, 400, 'unknown model still rejected');

const register = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Potter Mac', models: [BONSAI] }),
}));
assert.equal(register.status, 201);
const credentials = await register.json();
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).allowedModels, [BONSAI]);

const providerHeaders = { Authorization: `Bearer ${credentials.provider_token}`, 'Content-Type': 'application/json' };
const polled = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST',
  headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, name: 'Potter Mac', models: [BONSAI] }),
}));
assert.equal(polled.status, 204);
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).models, [BONSAI]);

const network = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/network'))).json();
assert.equal(network.providers_online, 1);
assert.deepEqual(network.models_available, [BONSAI]);

const models = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models'))).json();
assert.equal(models.object, 'list');
assert.deepEqual(models.data.map((row) => row.id), [BONSAI]);
assert.equal(models.data[0].owned_by, 'dasha-community');
assert.ok(!models.data.some((row) => row.id === 'gpt-oss-20b'), 'Hosted floor not listed while not serving');
assert.ok(!models.data.some((row) => row.id === 'gpt-oss-120b'), 'Hosted gpt-oss-120b stays off Community list');

const job = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ model: BONSAI, prompt: 'bonsai-ok' }),
}));
assert.equal(job.status, 202, 'buyers can submit ternary-bonsai-2-27b');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    const painted = await page.evaluate((id) => {
      const select = document.getElementById('model');
      providersOnline = 1;
      networkModels = new Set([id]);
      networkCapacity = [{ model: id, measured_providers: 1, tokens_per_second: 1 }];
      preferOnlineModel(select, false);
      document.getElementById('engine').value = 'community';
      paintModelChoices();
      paintAskModel();
      const chips = [...document.querySelectorAll('#model-choices [data-model]')].map((b) => ({ id: b.dataset.model, text: b.textContent }));
      const pill = [...(document.getElementById('ask-model')?.options || [])].map((o) => ({ id: o.value, text: o.textContent }));
      hostedChosenThisSession = true;
      setEngine('hosted', true);
      const hosted = { engine: document.getElementById('engine').value, model: document.getElementById('model').value };
      networkModels = new Set([id, 'qwen3-8b']);
      document.getElementById('engine').value = 'mixture';
      paintModelChoices();
      const mixture = [...document.querySelectorAll('#model-choices [data-model]')].map((b) => b.dataset.model);
      return {
        ids: [...select.options].map((o) => o.value),
        selected: chips.length ? chips[0].id : '',
        chip: chips[0]?.text || '',
        pill,
        hosted,
        mixture,
      };
    }, BONSAI);
    assert.ok(painted.ids.includes(BONSAI), 'select lists bonsai');
    assert.equal(painted.selected, BONSAI);
    assert.match(painted.chip, /Ternary Bonsai 2 27B · PQ2 · community/);
    assert.ok(painted.pill.some((o) => o.id === BONSAI), 'Ask model pill lists bonsai');
    assert.ok(painted.pill.some((o) => o.id === BONSAI && /Ternary Bonsai 2 27B/.test(o.text)), 'Ask model pill label');
    assert.equal(painted.hosted.engine, 'hosted');
    assert.equal(painted.hosted.model, 'gpt-oss-20b', 'Hosted still pins gpt-oss-20b');
    assert.ok(!painted.mixture.includes(BONSAI), 'Mixture does not list 27B bonsai');
    assert.ok(painted.mixture.includes('qwen3-8b'));
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-ternary-bonsai-2-27b: PASS (catalog + picker + network advertise; Hosted gpt-oss-* unchanged)');
