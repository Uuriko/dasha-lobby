#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 59661cb0): live /hosted /community /mixture
 * + /compute/* tabs (+slash / Title-case) html-404 → 308 /compute.
 * How? engine synonyms — Start. How? already names Hosted · Community · Mixture
 * and /night /provide /ask already 308→/compute. Fold to plain /compute (no hash).
 * Title-case works via existing dest lowercasing.
 * Exact /compute stays 200 (null dest). Skip /health /status /v1 /openai.
 * Disk only. No Designer. Never plugin.jup.ag.
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
  /How\? engine synonyms/,
  'leftover comment notes How? engine synonyms',
);
assert.match(
  workerSrc,
  /Hosted · Community · Mixture/,
  'leftover comment names Hosted · Community · Mixture',
);
assert.match(
  workerSrc,
  /\/hosted\|\/community\|\/mixture\|\/compute\/hosted\|\/compute\/community\|\/compute\/mixture/,
  'potterHome308Dest comment lists leftover family',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const leaf of ['hosted', 'community', 'mixture']) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
assert.doesNotMatch(tab, /['"]\/openai['"]/, 'do not invent /openai on compute-tab set');
assert.doesNotMatch(tab, /['"]\/v1['"]/, 'do not invent /v1');
assert.doesNotMatch(tab, /['"]\/status['"]/, 'do not invent /status');
assert.doesNotMatch(tab, /['"]\/health['"]/, 'do not invent /health');

const COMPUTE = 'https://www.getdasha.com/compute';

const ENGINE_SYNONYMS = [
  '/hosted', '/hosted/', '/Hosted', '/HOSTED', '/hOsTeD/',
  '/community', '/community/', '/Community', '/COMMUNITY', '/cOmMuNiTy/',
  '/mixture', '/mixture/', '/Mixture', '/MIXTURE', '/mIxTuRe/',
  '/compute/hosted', '/compute/hosted/', '/Compute/hosted', '/COMPUTE/HOSTED', '/Compute/Hosted/',
  '/compute/community', '/compute/community/', '/Compute/community', '/COMPUTE/COMMUNITY', '/Compute/Community/',
  '/compute/mixture', '/compute/mixture/', '/Compute/mixture', '/COMPUTE/MIXTURE', '/Compute/Mixture/',
];
const PRIOR_PEERS = [
  '/night', '/night/', '/Night', '/NIGHT',
  '/provide', '/provide/', '/Provide', '/PROVIDE',
  '/ask', '/ask/', '/Ask', '/ASK',
  '/compute/night', '/compute/provide', '/compute/ask',
];
const FOLDS = [...ENGINE_SYNONYMS, ...PRIOR_PEERS];
const STAY_OUT = [
  '/health', '/health/',
  '/status', '/status/',
  '/v1', '/v1/',
  '/openai', '/openai/', '/OpenAI',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path} to compute`);
}

const env = { LOBBY_SESSION_SECRET: 'apex-hosted-community-mixture-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /#/, `${host} ${path} ${method} no hash`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  for (const path of STAY_OUT) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/hosted', '/community', '/mixture', '/compute/hosted', '/compute/community', '/compute/mixture', '/health', '/status', '/v1', '/openai']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-hosted-community-mixture-pretty-path: PASS (/hosted+/community+/mixture + /compute/* tabs 308 /compute; How? engine synonyms; Title-case+slash; www+lobby GET+HEAD; /night+/provide+/ask peers; /compute 200; /health+/status+/v1+/openai stay out; no plugin.jup.ag)');
