#!/usr/bin/env node
/**
 * Leftover pretty path: live GET/HEAD /compute/kit.tar.gz (+slash)
 * html-404s on www and JSON-404s on lobby while sibling open-alpha
 * aliases already 308 via potterHome308Dest KIT_TAR to the gzip kit.
 * Fold this guessed short kit URL to the canonical gzip — never /compute HTML.
 * Title-case /Compute/Kit.tar.gz is covered by existing dest toLowerCase
 * (same as peer /compute/open-alpha.tar.gz). Do not invent DEX peers
 * or apex /kit.tar.gz /assets/kit.tar.gz. /compute/kit stays tab leftover
 * → /compute. Exact /dasha-compute-open-alpha.tar.gz stays 200 (null dest).
 * Disk only. No Designer. Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
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
assert.match(
  workerSrc,
  /const KIT_TAR = "https:\/\/www\.getdasha\.com\/dasha-compute-open-alpha\.tar\.gz"/,
  'KIT_TAR dest is the gzip kit',
);
assert.match(workerSrc, /p === "\/compute\/kit\.tar\.gz"/, 'KIT_TAR block lists /compute/kit.tar.gz');
assert.match(workerSrc, /p === "\/compute\/kit\.tar\.gz\/"/, 'KIT_TAR block lists /compute/kit.tar.gz/');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

const WWW = 'https://www.getdasha.com';
const KIT = `${WWW}/dasha-compute-open-alpha.tar.gz`;
const COMPUTE = `${WWW}/compute`;

const FOLDS = [
  '/compute/kit.tar.gz',
  '/compute/kit.tar.gz/',
  '/Compute/Kit.tar.gz',
];
const PEERS = [
  '/compute/open-alpha.tar.gz',
  '/compute/open-alpha.tar.gz/',
  '/compute/dasha-compute-open-alpha.tar.gz',
  '/assets/open-alpha.tar.gz',
  '/open-alpha.tar.gz',
];
const SKIP = [
  '/kit.tar.gz',
  '/kit.tar.gz/',
  '/assets/kit.tar.gz',
  '/compute/jupiter',
  '/compute/orca',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), KIT, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not /compute HTML`);
}
for (const path of PEERS) {
  assert.equal(potterHome308Dest(path), KIT, `peer ${path}`);
}
assert.equal(potterHome308Dest('/compute/kit'), COMPUTE, '/compute/kit stays tab leftover → /compute');
assert.equal(potterHome308Dest('/compute/kit/'), COMPUTE, '/compute/kit/ stays tab leftover → /compute');
assert.equal(potterHome308Dest('/dasha-compute-open-alpha.tar.gz'), null, 'canonical kit stays 200');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
for (const path of SKIP) {
  assert.notEqual(potterHome308Dest(path), KIT, `do not invent ${path}`);
}

const env = {
  LOBBY_SESSION_SECRET: 'compute-kit-tar-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), KIT, `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not /compute HTML`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const tab = await edgeWorker.fetch(new Request(`https://${host}/compute/kit`), env);
  assert.equal(tab.status, 308, `${host} /compute/kit stays tab`);
  assert.equal(tab.headers.get('location'), COMPUTE, `${host} /compute/kit loc`);
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/compute/kit.tar.gz</loc>`), 'sitemap omits leftover /compute/kit.tar.gz');

console.log('dasha-compute-kit-tar-pretty-path: PASS (/compute/kit.tar.gz+/compute/kit.tar.gz/ 308 gzip kit; Title-case /Compute/Kit.tar.gz; dest never /compute HTML; /compute/kit stays tab; canonical kit 200; no DEX /kit.tar.gz peers; www+lobby GET+HEAD; no plugin.jup.ag)');
