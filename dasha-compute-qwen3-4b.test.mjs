#!/usr/bin/env node
/**
 * Advertise measured qwen3-4b on Community (A4 Flash-tier candidate after live Mac bench).
 * Allow-list + SUB24 so a Mac can heartbeat qwen3-4b=qwen3:4b.
 * Live default stays qwen3-8b. Start proof chip already picks winning measured tok/s.
 * Measured Mac only — never invent tok/s in static HTML. Never Flash/Hosted.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No Room Phase 0.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { DashaLobby } from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { PROVIDE_SKILL_MD, USE_SKILL_MD } from './dasha-compute-skills.mjs';
import { COMPUTE_PROVIDE_SPEED_TXT } from './dasha-compute-agent.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

const STATIC_BANNED_TPS = /46\.5|25\.0 tok|1\.86×/;

function assertCatalog(html, label) {
  assert.match(html, /value=["']qwen3-8b["'] selected/, `${label} live default stays qwen3-8b`);
  assert.match(html, /value=["']qwen3-4b["']/, `${label} qwen3-4b selectable`);
  assert.match(html, /value=["']gemma3-12b["']/, `${label} gemma3-12b stays`);
  assert.match(html, /value=["']gemma3-27b["']/, `${label} gemma3-27b stays`);
  assert.match(html, /\['qwen3-4b','qwen3:4b','Qwen 3 4B','2\.5 GB',8,'fast chat'\]/, `${label} MODELS row`);
  assert.match(html, /\['qwen3-8b','qwen3:8b'/, `${label} 8b MODELS row stays`);
  assert.match(html, /SUB24=new Set\(\['qwen3-4b','qwen3-8b','gemma3-12b','gpt-oss-20b','qwen3-30b-a3b'\]\)/, `${label} SUB24 includes 4b`);
  assert.match(html, /sub-24GB specialists · live default qwen3-8b/, `${label} mixture chip still 8b`);
  assert.match(html, /networkModels\.has\(['"]gemma3-27b['"]\)/, `${label} Community still prefers 27b when advertised`);
  assert.match(html, /winningMeasuredCapacity\(\)/, `${label} proof chip uses winning measured`);
  assert.doesNotMatch(html, STATIC_BANNED_TPS, `${label} no invented Mac tok\/s in static HTML`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /project-room|guest-agent/i, `${label} no Room`);
}

assertCatalog(disk, 'disk');
assertCatalog(COMPUTE_PAGE_HTML, 'embed');

assert.match(PROVIDE_SKILL_MD, /qwen3-4b=qwen3:4b/, 'PROVIDE skill map example');
assert.match(PROVIDE_SKILL_MD, /qwen3:4b \(fast\).*qwen3:8b.*gemma3:12b/s, 'PROVIDE skill lists 4b alongside 8b/12b');
assert.match(PROVIDE_SKILL_MD, /qwen3-8b=qwen3:8b/, 'PROVIDE skill keeps 8b map');
assert.match(USE_SKILL_MD, /qwen3-4b \/ qwen3-8b \/ gemma3-12b/, 'USE skill Mixture prefer includes 4b');
assert.match(COMPUTE_PROVIDE_SPEED_TXT, /qwen3-4b · qwen3-8b/, 'Provide speed lists 4b first among smaller-is-faster');
assert.doesNotMatch(PROVIDE_SKILL_MD, STATIC_BANNED_TPS, 'PROVIDE skill no invented tok/s');
assert.doesNotMatch(USE_SKILL_MD, STATIC_BANNED_TPS, 'USE skill no invented tok/s');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
assertCatalog(await served.text(), 'worker.fetch');

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-qwen3-4b-secret',
};
const token = await createSessionToken(env, { xId: '4b', handle: 'dasha_4b' });
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
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'A4 Mac', models: ['qwen3-4b', 'qwen3-8b', 'gemma3-12b'] }),
}));
assert.equal(register.status, 201);
const credentials = await register.json();
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).allowedModels, ['qwen3-4b', 'qwen3-8b', 'gemma3-12b']);

const providerHeaders = { Authorization: `Bearer ${credentials.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = {
  provider_id: credentials.provider_id,
  name: 'A4 Mac',
  models: ['qwen3-4b', 'qwen3-8b'],
  hardware: {
    system: 'Darwin',
    machine: 'arm64',
    memory_gb: 24,
    benchmarked_at: 1234,
    benchmarks: [
      { model: 'qwen3-4b', tokens_per_second: 46.5 },
      { model: 'qwen3-8b', tokens_per_second: 25.0 },
    ],
  },
};
const polled = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}));
assert.equal(polled.status, 204);

const network = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/network'))).json();
assert.equal(network.providers_online, 1);
assert.ok(network.models_available.includes('qwen3-4b'), 'network lists advertised qwen3-4b');
assert.ok(network.models_available.includes('qwen3-8b'), 'network still lists qwen3-8b');
const cap4 = network.capacity.find((row) => row.model === 'qwen3-4b');
const cap8 = network.capacity.find((row) => row.model === 'qwen3-8b');
assert.ok(cap4, 'capacity includes qwen3-4b');
assert.equal(cap4.measured_providers, 1);
assert.equal(cap4.tokens_per_second, 46.5);
assert.equal(cap8.tokens_per_second, 25);

const job = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ model: 'qwen3-4b', prompt: 'Community hello.' }),
}));
assert.equal(job.status, 202, 'buyers can submit qwen3-4b');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });

    const first = await page.evaluate(() => {
      const select = document.getElementById('model');
      return {
        markupDefault: select?.querySelector('option[selected]')?.value || '',
        ids: [...select.options].map((o) => o.value),
        proof: (document.getElementById('gate-proof')?.textContent || '').trim(),
        engine: document.getElementById('engine')?.value || '',
      };
    });
    assert.equal(first.markupDefault, 'qwen3-8b', 'markup default stays qwen3-8b');
    assert.equal(first.engine, 'hosted', 'Start. stays Hosted until a Mac is adopted');
    assert.ok(first.ids.includes('qwen3-4b'), 'select lists qwen3-4b');
    assert.ok(first.ids.includes('qwen3-8b') && first.ids.includes('gemma3-12b'), '8b/12b stay');
    assert.equal(first.proof, 'Measured Mac speed via network capacity.', 'static proof does not invent tok/s');

    const live = await page.evaluate(() => {
      providersOnline = 1;
      networkModels = new Set(['qwen3-4b', 'qwen3-8b']);
      networkCapacity = [
        { model: 'qwen3-8b', measured_providers: 1, tokens_per_second: 25.0 },
        { model: 'qwen3-4b', measured_providers: 1, tokens_per_second: 46.5 },
      ];
      paintGateProof();
      const proof = (document.getElementById('gate-proof')?.textContent || '').trim();
      const win = winningMeasuredCapacity();
      document.getElementById('model').value = 'qwen3-8b';
      preferAdvertisedCommunityModel(document.getElementById('model'));
      const adopted = document.getElementById('model').value;
      networkModels = new Set(['gemma3-27b', 'qwen3-4b', 'qwen3-8b']);
      document.getElementById('model').value = 'qwen3-8b';
      preferAdvertisedCommunityModel(document.getElementById('model'));
      const keep27 = document.getElementById('model').value;
      return { proof, win, adopted, keep27 };
    });
    assert.equal(live.win.model, 'qwen3-4b', 'winning measured is qwen3-4b');
    assert.equal(live.win.tps, 46.5, 'uses the measured 4b eval — never invent');
    assert.match(live.proof, /qwen3-4b/, 'Start proof chip names fastest measured 4b');
    assert.match(live.proof, /tok\/s/, 'Start proof chip shows live tok/s');
    assert.equal(live.adopted, 'qwen3-4b', 'optional Community default follows fastest measured when 27b is offline');
    assert.equal(live.keep27, 'gemma3-27b', 'advertised gemma3-27b still wins Community default');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-qwen3-4b: PASS (allow-list + SUB24 + measured 4b; 8b default; proof chip wins on 46.5)');
