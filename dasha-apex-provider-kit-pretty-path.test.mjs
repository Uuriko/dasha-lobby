#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 0289a6ac): live /provider-kit /provide-kit
 * /host-kit /install-kit /dasha-kit /compute-kit + underscore siblings
 * (+ /compute/* tabs, Title-case) html-404 → 308 /compute. Peers /kit
 * /mac-setup /fleet already 308→/compute. Title-case via existing dest
 * lowercasing — do not invent a second casefold. Exact /compute /privacy
 * stay 200 (null dest). Bare /price stays the 200 JSON token-price API.
 * Skip /openai /openai-api /v1 /llm /status /health /connect /arcade /games
 * /room /terms — do not invent a fold. Disk only. No Designer. Never
 * plugin.jup.ag. PR-mirror only — no wrangler deploy.
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
assert.match(
  workerSrc,
  /Provider-kit leftovers \(Worker 0289a6ac\)/,
  'leftover comment names provider-kit family',
);
assert.match(
  workerSrc,
  /potterHome308Dest toLowerCase — do not invent a second casefold/,
  'leftover comment keeps Title-case on existing dest lowercasing',
);
assert.match(
  workerSrc,
  /Skip \/openai \/openai-api \/v1 \/llm \/status \/health \/connect \/arcade \/games/,
  'leftover comment skips openai/v1/llm/status/health/connect/arcade/games',
);
assert.match(
  workerSrc,
  /Never fold \/price \(200 JSON\) or \/privacy \(200\)/,
  'leftover comment keeps /price and /privacy as 200s',
);
assert.match(
  workerSrc,
  /\/provider-kit\|\/provide-kit\|\/host-kit\|\/install-kit\|\/dasha-kit\|\/compute-kit\|\/provider_kit\|\/provide_kit\|\/host_kit\|\/install_kit\|\/dasha_kit\|\/compute_kit/,
  'potterHome308Dest comment lists leftover family',
);
assert.match(
  workerSrc,
  /\/compute\/provider-kit\|\/compute\/provide-kit\|\/compute\/host-kit\|\/compute\/install-kit\|\/compute\/dasha-kit\|\/compute\/compute-kit/,
  'potterHome308Dest comment lists /compute/* hyphen peers',
);
assert.match(
  workerSrc,
  /\/compute\/provider_kit\|\/compute\/provide_kit\|\/compute\/host_kit\|\/compute\/install_kit\|\/compute\/dasha_kit\|\/compute\/compute_kit/,
  'potterHome308Dest comment lists /compute/* underscore peers',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const COMPUTE_LEAVES = [
  'provider-kit', 'provide-kit', 'host-kit', 'install-kit', 'dasha-kit', 'compute-kit',
  'provider_kit', 'provide_kit', 'host_kit', 'install_kit', 'dasha_kit', 'compute_kit',
];
for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/${leaf}/'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}/'`));
}
for (const skip of [
  '/openai', '/openai-api', '/v1', '/status', '/health',
  '/connect', '/arcade', '/games', '/room', '/terms',
]) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
}
assert.doesNotMatch(tab, /['"]\/price['"]/, 'do not fold bare /price');
assert.doesNotMatch(tab, /['"]\/privacy['"]/, 'do not fold /privacy');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const PRIVACY = `${WWW}/privacy`;

const NEW_PATHS = COMPUTE_LEAVES.flatMap((leaf) => [
  `/${leaf}`, `/${leaf}/`,
  `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
  `/${leaf.toUpperCase()}`,
  `/compute/${leaf}`, `/compute/${leaf}/`,
  `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
]);
const PRIOR_PEERS = [
  '/kit', '/kit/', '/Kit', '/KIT',
  '/mac-setup', '/mac-setup/', '/Mac-setup',
  '/fleet', '/fleet/', '/Fleet',
  '/compute/kit', '/compute/mac-setup', '/compute/fleet',
];
const FOLDS = [...NEW_PATHS, ...PRIOR_PEERS];
const STAY_NULL = [
  '/price', '/price/', '/Price',
  '/privacy', '/privacy/',
  '/compute',
];
const SKIP_404 = [
  '/openai', '/openai/', '/OpenAI',
  '/openai-api', '/openai-api/',
  '/v1', '/v1/',
  '/status', '/status/', '/Status',
  '/health', '/health/', '/Health',
  '/connect', '/connect/', '/Connect',
  '/arcade', '/arcade/', '/Arcade',
  '/games', '/games/', '/Games',
  '/room', '/room/', '/Room',
  '/terms', '/terms/', '/Terms',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), PRIVACY, `${path} is not /privacy`);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
for (const path of SKIP_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

const FETCH_SAMPLE = [
  '/provider-kit', '/provider-kit/', '/Provider-kit', '/PROVIDER-KIT',
  '/compute/provider-kit', '/Compute/provider-kit/',
  '/provide-kit', '/host-kit', '/install-kit', '/dasha-kit', '/compute-kit',
  '/provider_kit', '/provide_kit', '/host_kit', '/install_kit', '/dasha_kit', '/compute_kit',
  '/compute/provide-kit', '/compute/compute-kit', '/compute/provider_kit',
  '/kit', '/mac-setup', '/fleet',
];

const env = {
  LOBBY_SESSION_SECRET: 'apex-provider-kit-pretty-path-secret',
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
  for (const path of SKIP_404) {
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
  '/provider-kit', '/provide-kit', '/host-kit', '/install-kit', '/dasha-kit', '/compute-kit',
  '/provider_kit', '/provide_kit', '/host_kit', '/install_kit', '/dasha_kit', '/compute_kit',
  '/openai', '/openai-api', '/v1', '/llm', '/status', '/health',
  '/connect', '/arcade', '/games', '/room', '/terms',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-provider-kit-pretty-path: PASS (/provider-kit+/provide-kit+/host-kit+/install-kit+/dasha-kit+/compute-kit + underscore siblings + /compute/* tabs 308 /compute; /kit+/mac-setup+/fleet peers; Title-case+slash; www+lobby GET+HEAD sample; /compute+/privacy 200; bare /price untouched; /openai+/openai-api+/v1+/llm+/status+/health+/connect+/arcade+/games+/room+/terms stay out; no plugin.jup.ag)');
