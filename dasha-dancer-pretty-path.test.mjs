#!/usr/bin/env node
/**
 * Leftover pretty path: live /dancer /Dancer /compute/dancer (+slash)
 * html-404 nofollow (proven 2026-09-08) while /studio /verse /learn /graph
 * already 308→/ and /compute is 200. Fold apex dancer → home;
 * /compute/dancer → /compute. One path-family. Do not restore the dancer.
 * Do not invent DEX peers. /room stays 404 (Phase 0). Skip /arcade
 * /multichain /x402. Disk only. No Designer. Never plugin.jup.ag.
 * PR-mirror only — no wrangler deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /(?:String\(path \|\| ''\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /POTTER_HOME_308_PATHS/, 'home 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');

const homeSet = workerSrc.match(/const POTTER_HOME_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(homeSet, /['"]\/dancer['"]/, 'home set lists /dancer');
assert.match(homeSet, /['"]\/dancer\/['"]/, 'home set lists /dancer/');
assert.doesNotMatch(homeSet, /['"]\/compute\/dancer['"]/, 'compute leftover stays on compute-tab');
assert.match(tab, /['"]\/compute\/dancer['"]/, 'set lists /compute/dancer');
assert.match(tab, /['"]\/compute\/dancer\/['"]/, 'set lists /compute/dancer/');
assert.doesNotMatch(tab, /['"]\/dancer['"]/, 'apex /dancer stays home 308, not compute-tab');
assert.doesNotMatch(tab, /['"]\/arcade['"]/, 'do not invent /arcade');
assert.doesNotMatch(tab, /['"]\/multichain['"]/, 'do not invent /multichain');
assert.doesNotMatch(tab, /['"]\/room['"]/, 'do not invent /room');
assert.doesNotMatch(tab, /['"]\/x402['"]/, 'do not invent /x402');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const HOME = `${WWW}/`;

const TO_HOME = [
  '/dancer', '/dancer/',
  '/Dancer', '/DANCER', '/Dancer/',
];
const TO_COMPUTE = [
  '/compute/dancer', '/compute/dancer/',
  '/Compute/dancer', '/COMPUTE/DANCER', '/Compute/Dancer/',
  '/compute/Dancer', '/COMPUTE/dancer/',
];
const STAY_200 = ['/compute', '/privacy', '/privacy/'];
const SKIP_404 = ['/room', '/room/', '/arcade', '/arcade/', '/x402', '/x402/', '/multichain'];

for (const path of TO_HOME) {
  assert.equal(potterHome308Dest(path), HOME, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not compute`);
}
for (const path of TO_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), HOME, `${path} is not home`);
}
assert.equal(potterHome308Dest('/studio'), HOME, '/studio still 308 home');
assert.equal(potterHome308Dest('/studio/'), HOME, '/studio/ still 308 home');
assert.equal(potterHome308Dest('/Studio'), HOME, '/Studio still 308 home');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
for (const path of STAY_200) {
  if (path === '/compute') assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
  if (path === '/privacy' || path === '/privacy/') {
    assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
  }
}
for (const path of SKIP_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

const env = {
  LOBBY_SESSION_SECRET: 'dancer-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of TO_HOME) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), HOME, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of TO_COMPUTE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/studio', '/studio/', '/Studio']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), HOME, `${host} ${path} ${method} still home`);
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
  for (const path of SKIP_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(potterHome308Dest(path), null, `${host} ${path} dest stays null`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), HOME, `${host} ${path} ${method} not folded to home`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/compute<\/loc>/);
for (const path of ['/dancer', '/compute/dancer', '/studio', '/arcade', '/room', '/x402']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-dancer-pretty-path: PASS (/dancer+/Dancer 308 /; /compute/dancer+/compute/dancer/ 308 /compute; Title-case; /studio still home; www+lobby GET+HEAD; /compute+/privacy 200; /room+/arcade+/x402 stay out; no plugin.jup.ag)');
