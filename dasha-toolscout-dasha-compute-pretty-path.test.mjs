#!/usr/bin/env node
/**
 * Leftover pretty path: live ToolScout door /tool/dasha-compute
 * (+slash / Title-case) html-404 while /tool /tools already 308→/compute.
 * Close same-door 404s /tool/dasha /tools/dasha-compute /tools/dasha fold too.
 * Dest: https://www.getdasha.com/compute. Apex + www + lobby.
 * Do NOT blanket-fold /tool/*. Do NOT invent DEX peers (/tool/jupiter).
 * Exact /compute /privacy stay 200. Apex /dasha stays /how-to-buy.
 * Skip /arcade /x402. Disk only. No Designer. Never plugin.jup.ag.
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
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(
  workerSrc,
  /ToolScout leftover \(2026-09-11\): live \/tool\/dasha-compute \/tool\/dasha/,
  'leftover comment names ToolScout /tool/dasha-compute family',
);
assert.match(
  workerSrc,
  /Do NOT blanket-fold \/tool\/\* or invent DEX peers/,
  'leftover comment forbids blanket /tool/* and DEX peers',
);
assert.doesNotMatch(
  workerSrc,
  /p\.startsWith\(["']\/tool/,
  'do not blanket-fold all /tool/* via startsWith',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const FAMILY = [
  '/tool/dasha-compute',
  '/tool/dasha',
  '/tools/dasha-compute',
  '/tools/dasha',
];
for (const path of FAMILY) {
  assert.match(tab, new RegExp(`["']${path}["']`));
  assert.match(tab, new RegExp(`["']${path}/["']`));
}
assert.match(tab, /["']\/tool["']/, '/tool peer stays in set');
assert.match(tab, /["']\/tools["']/, '/tools peer stays in set');
assert.doesNotMatch(tab, /['"]\/tool\/jupiter['"]/, 'do not invent /tool/jupiter');
assert.doesNotMatch(tab, /['"]\/tools\/jupiter['"]/, 'do not invent /tools/jupiter');
assert.doesNotMatch(tab, /['"]\/tool\/photon['"]/, 'do not invent /tool/photon');
assert.doesNotMatch(tab, /['"]\/arcade['"]/, 'do not invent /arcade');
assert.doesNotMatch(tab, /['"]\/x402['"]/, 'do not invent /x402');

const WWW = 'https://www.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const HOWTO = `${WWW}/how-to-buy`;

function variants(path) {
  const parts = path.split('/');
  const titled = parts.map((part, i) => {
    if (i === 0 || !part) return part;
    return `${part[0].toUpperCase()}${part.slice(1)}`;
  }).join('/');
  const upper = path.toUpperCase().replace(/^\/+/, '/');
  return [path, `${path}/`, titled, `${titled}/`, upper, `${upper}/`];
}

const TO_COMPUTE = FAMILY.flatMap(variants);
const PRIOR_PEERS = ['/tool', '/tool/', '/Tool', '/tools', '/tools/', '/TOOLS'];
const STAY_200 = ['/compute', '/privacy', '/privacy/'];
const SKIP_404 = [
  '/tool/jupiter', '/tool/jupiter/', '/Tool/jupiter',
  '/tools/jupiter', '/tools/photon',
  '/tool/other', '/tool/other/',
  '/arcade', '/arcade/',
  '/x402', '/x402/',
];

for (const path of TO_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), HOWTO, `${path} is not /how-to-buy`);
}
for (const path of PRIOR_PEERS) {
  assert.equal(potterHome308Dest(path), COMPUTE, `peer ${path}`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
for (const path of SKIP_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}
assert.equal(potterHome308Dest('/dasha'), HOWTO, '/dasha stays how-to-buy');
assert.equal(potterHome308Dest('/dasha/'), HOWTO, '/dasha/ stays how-to-buy');
assert.equal(potterHome308Dest('/Dasha'), HOWTO, '/Dasha stays how-to-buy');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');

const FETCH = [
  '/tool/dasha-compute', '/tool/dasha-compute/', '/Tool/dasha-compute',
  '/TOOL/DASHA-COMPUTE', '/Tool/Dasha-compute/',
  '/tool/dasha', '/tool/dasha/', '/Tool/dasha',
  '/tools/dasha-compute', '/tools/dasha-compute/', '/Tools/dasha-compute',
  '/tools/dasha', '/tools/dasha/', '/Tools/dasha',
];

const env = {
  LOBBY_SESSION_SECRET: 'toolscout-dasha-compute-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['getdasha.com', 'www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FETCH) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/tool', '/tools']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(res.status, 308, `${host} ${path} still 308`);
    assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} still /compute`);
  }
  const dasha = await edgeWorker.fetch(new Request(`https://${host}/dasha`), env);
  assert.equal(dasha.status, 308, `${host} /dasha still 308`);
  assert.equal(dasha.headers.get('location'), HOWTO, `${host} /dasha still how-to-buy`);
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
      assert.notEqual(res.headers.get('location'), HOWTO, `${host} ${path} ${method} not folded to howto`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/compute<\/loc>/);
for (const path of [
  '/tool/dasha-compute', '/tool/dasha', '/tools/dasha-compute', '/tools/dasha',
  '/tool', '/tools', '/arcade', '/x402',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-toolscout-dasha-compute-pretty-path: PASS (/tool/dasha-compute+/tool/dasha+/tools/dasha-compute+/tools/dasha 308 /compute; Title-case+slash; apex+www+lobby GET+HEAD; /tool+/tools peers; /dasha stays howto; /compute+/privacy 200; no blanket /tool/*; no DEX peers; no plugin.jup.ag)');
