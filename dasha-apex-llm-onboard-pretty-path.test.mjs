#!/usr/bin/env node
/**
 * Leftover pretty path (2026-09-06 keep-working): live /llm /llms-api
 * /onboarding /on-boarding /macbook /m-series /silicon-mac /ollama-setup
 * /providerkit /factory /beta /early /early-access /earlyaccess
 * (+ /compute/* tabs, Title-case) html-404 → 308 /compute.
 * Peers /inference /onboard /alpha /mac-setup /provider_kit /ollama already
 * 308→/compute. Bare /factory = Compute factory face (product page).
 * /compute/factory|/api/factory stay dedicated → /compute/api/factory (JSON).
 * /llms stays AEO → /llms.txt. Exact /compute /privacy stay 200 (null dest).
 * Bare /price stays the 200 JSON token-price API. Skip /arcade /games
 * /multichain /room /project-room /connect /v1 /openai /openai-api /terms
 * /health /status /discord /slack /admin /waitlist. Disk only. No Designer.
 * Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(workerSrc, /2026-09-06 keep-working/, 'leftover comment names keep-working batch');
assert.match(
  workerSrc,
  /Bare \/factory folds via POTTER_COMPUTE_TAB/,
  'bare /factory folds via compute-tab comment',
);
assert.match(
  workerSrc,
  /\/llms stays AEO → \/llms\.txt/,
  'leftover comment keeps /llms on AEO',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const APEX_LEAVES = [
  'llm', 'llms-api', 'onboarding', 'on-boarding', 'macbook', 'm-series',
  'silicon-mac', 'ollama-setup', 'providerkit', 'factory', 'beta', 'early',
  'early-access', 'earlyaccess',
];
const COMPUTE_TAB_LEAVES = [
  'llm', 'llms-api', 'onboarding', 'on-boarding', 'macbook', 'm-series',
  'silicon-mac', 'ollama-setup', 'providerkit', 'beta', 'early',
  'early-access', 'earlyaccess',
];
for (const leaf of APEX_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/${leaf}/'`));
}
for (const leaf of COMPUTE_TAB_LEAVES) {
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}/'`));
}
for (const skip of ['/compute/factory', '/llms', '/arcade', '/price']) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
}
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const FACTORY_API = `${WWW}/compute/api/factory`;
const LLMS = `${WWW}/llms.txt`;
const PRIVACY = `${WWW}/privacy`;

const NEW_PATHS = [
  ...APEX_LEAVES.flatMap((leaf) => [
    `/${leaf}`, `/${leaf}/`,
    `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
    `/${leaf.toUpperCase()}`,
  ]),
  ...COMPUTE_TAB_LEAVES.flatMap((leaf) => [
    `/compute/${leaf}`, `/compute/${leaf}/`,
    `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
  ]),
];
const TITLE_SAMPLES = [
  '/Llm', '/Llms-api', '/Onboarding', '/On-boarding', '/Macbook', '/M-series',
  '/Silicon-mac', '/Ollama-setup', '/Providerkit', '/Factory', '/Beta',
  '/Early', '/Early-access', '/Earlyaccess',
  '/Compute/llm', '/Compute/onboarding', '/Compute/macbook', '/Compute/beta',
];
const FOLDS = [...new Set([...NEW_PATHS, ...TITLE_SAMPLES])];
const STAY_NULL = [
  '/price', '/price/', '/Price',
  '/privacy', '/privacy/',
  '/compute',
];
const LOCKS = [
  '/arcade', '/arcade/', '/Arcade',
  '/games', '/games/', '/Games',
  '/multichain', '/multichain/',
  '/room', '/room/', '/Room',
  '/project-room', '/project-room/',
  '/connect', '/connect/', '/Connect',
  '/v1', '/v1/',
  '/openai', '/openai/', '/OpenAI',
  '/openai-api', '/openai-api/',
  '/terms', '/terms/', '/Terms',
  '/health', '/health/', '/Health',
  '/status', '/status/', '/Status',
  '/discord', '/discord/',
  '/slack', '/slack/',
  '/admin', '/admin/',
  '/waitlist', '/waitlist/',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), PRIVACY, `${path} is not /privacy`);
  assert.notEqual(potterHome308Dest(path), FACTORY_API, `${path} is not factory JSON`);
}
assert.equal(potterHome308Dest('/compute/factory'), FACTORY_API, '/compute/factory stays factory JSON');
assert.equal(potterHome308Dest('/compute/factory/'), FACTORY_API, '/compute/factory/ stays factory JSON');
assert.equal(potterHome308Dest('/Compute/factory'), FACTORY_API, '/Compute/factory stays factory JSON');
assert.equal(potterHome308Dest('/llms'), LLMS, '/llms stays AEO /llms.txt');
assert.equal(potterHome308Dest('/llms/'), LLMS, '/llms/ stays AEO /llms.txt');
assert.equal(potterHome308Dest('/Llms'), LLMS, '/Llms stays AEO /llms.txt');
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
for (const path of LOCKS) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

const FETCH_SAMPLE = [
  '/llm', '/llm/', '/Llm', '/LLM',
  '/llms-api', '/onboarding', '/on-boarding', '/macbook', '/m-series',
  '/silicon-mac', '/ollama-setup', '/providerkit', '/factory', '/Factory',
  '/beta', '/early', '/early-access', '/earlyaccess',
  '/compute/llm', '/Compute/llm/', '/compute/onboarding', '/compute/macbook',
  '/compute/providerkit', '/compute/beta', '/compute/early-access',
];

const env = {
  LOBBY_SESSION_SECRET: 'apex-llm-onboard-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName() { return 'public'; },
    get() {
      return {
        async fetch() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          });
        },
      };
    },
  },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FETCH_SAMPLE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const factory = await edgeWorker.fetch(new Request(`https://${host}/compute/factory`, { method }), env);
    assert.equal(factory.status, 308, `${host} /compute/factory ${method}`);
    const wantFactory = host === 'lobby.getdasha.com'
      ? 'https://lobby.getdasha.com/compute/api/factory'
      : FACTORY_API;
    assert.equal(factory.headers.get('location'), wantFactory, `${host} /compute/factory ${method} loc`);
    const llms = await edgeWorker.fetch(new Request(`https://${host}/llms`, { method }), env);
    assert.equal(llms.status, 308, `${host} /llms ${method}`);
    assert.equal(llms.headers.get('location'), LLMS, `${host} /llms ${method} loc`);
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  }
  for (const path of ['/price', '/price/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
  for (const path of LOCKS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), PRIVACY, `${host} ${path} ${method} not folded to privacy`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/llm', '/llms-api', '/onboarding', '/factory', '/beta', '/early-access',
  '/arcade', '/games', '/multichain', '/room', '/llms',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-llm-onboard-pretty-path: PASS (/llm+/llms-api+/onboarding+/on-boarding+/macbook+/m-series+/silicon-mac+/ollama-setup+/providerkit+/factory+/beta+/early+/early-access+/earlyaccess + /compute/* tabs 308 /compute; /compute/factory stays JSON API; /llms AEO /llms.txt; Title-case+slash; www+lobby GET+HEAD sample; /compute+/privacy+/price 200; locks stay out; no plugin.jup.ag)');
