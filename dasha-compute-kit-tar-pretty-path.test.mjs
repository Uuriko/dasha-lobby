#!/usr/bin/env node
/**
 * Leftover pretty path: live GET/HEAD /kit.tar.gz (+slash)
 * html-404s on www while sibling /open-alpha.tar.gz and /compute/kit.tar.gz
 * already 308 via potterHome308Dest KIT_TAR to the gzip kit.
 * Fold this guessed apex kit URL to the canonical gzip — never /compute HTML.
 * Title-case /Kit.tar.gz is covered by existing dest toLowerCase
 * (same as peer /open-alpha.tar.gz). Do not invent DEX peers
 * or /assets/kit.tar.gz. /compute/kit stays tab leftover → /compute.
 * Exact /dasha-compute-open-alpha.tar.gz stays 200 (null dest).
 *
 * Bare kit-name leftovers (2026-09-11): live GET/HEAD /compute/open-alpha
 * /compute/open_alpha /dasha-compute-open-alpha (+slash / Title-case)
 * html-404 while sibling tar.gz aliases already 308 to the gzip kit.
 * Fold that leftover path-family to the same dest. Apex /open-alpha stays
 * tab leftover → /compute. Lobby same-host Location rewrite for the
 * leftover Set. Sitemap omits leftovers. Do not invent DEX peers or
 * apex /readme /install.sh.
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
assert.match(workerSrc, /p === "\/kit\.tar\.gz"/, 'KIT_TAR block lists /kit.tar.gz');
assert.match(workerSrc, /p === "\/kit\.tar\.gz\/"/, 'KIT_TAR block lists /kit.tar.gz/');
assert.match(workerSrc, /POTTER_KIT_NAME_308_PATHS/, 'leftover Set names bare kit-name family');
assert.match(workerSrc, /POTTER_KIT_NAME_308_PATHS\.has\(p\)/, 'KIT_TAR block uses leftover Set');
assert.doesNotMatch(workerSrc, /p === "\/assets\/kit\.tar\.gz"/, 'do not invent /assets/kit.tar.gz');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

const leftoverSet = workerSrc.match(/const POTTER_KIT_NAME_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/compute/open-alpha', '/compute/open-alpha/',
  '/compute/open_alpha', '/compute/open_alpha/',
  '/dasha-compute-open-alpha', '/dasha-compute-open-alpha/',
]) {
  assert.match(leftoverSet, new RegExp(`['"]${path}['"]`), `leftover Set lists ${path}`);
}
assert.doesNotMatch(leftoverSet, /['"]\/open-alpha['"]/, 'apex /open-alpha stays tab leftover');
assert.doesNotMatch(leftoverSet, /['"]\/readme['"]/, 'do not invent apex /readme');
assert.doesNotMatch(leftoverSet, /['"]\/install\.sh['"]/, 'do not invent apex /install.sh');
assert.doesNotMatch(leftoverSet, /['"]\/compute\/jupiter['"]/, 'do not invent DEX peer');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const KIT = `${WWW}/dasha-compute-open-alpha.tar.gz`;
const LOBBY_KIT = `${LOBBY}/dasha-compute-open-alpha.tar.gz`;
const COMPUTE = `${WWW}/compute`;

const FOLDS = [
  '/kit.tar.gz',
  '/kit.tar.gz/',
  '/Kit.tar.gz',
  '/compute/kit.tar.gz',
  '/compute/kit.tar.gz/',
  '/Compute/Kit.tar.gz',
];
const KIT_NAME_FOLDS = [
  '/compute/open-alpha',
  '/compute/open-alpha/',
  '/Compute/Open-Alpha',
  '/compute/open_alpha',
  '/compute/open_alpha/',
  '/Compute/Open_alpha',
  '/dasha-compute-open-alpha',
  '/dasha-compute-open-alpha/',
  '/Dasha-Compute-Open-Alpha',
];
const PEERS = [
  '/compute/open-alpha.tar.gz',
  '/compute/open-alpha.tar.gz/',
  '/compute/dasha-compute-open-alpha.tar.gz',
  '/assets/open-alpha.tar.gz',
  '/open-alpha.tar.gz',
  '/open-alpha.tar.gz/',
];
const SKIP = [
  '/assets/kit.tar.gz',
  '/compute/jupiter',
  '/compute/orca',
  '/readme',
  '/install.sh',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), KIT, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not /compute HTML`);
}
for (const path of KIT_NAME_FOLDS) {
  assert.equal(potterHome308Dest(path), KIT, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not /compute HTML`);
}
for (const path of PEERS) {
  assert.equal(potterHome308Dest(path), KIT, `peer ${path}`);
}
assert.equal(potterHome308Dest('/compute/kit'), COMPUTE, '/compute/kit stays tab leftover → /compute');
assert.equal(potterHome308Dest('/compute/kit/'), COMPUTE, '/compute/kit/ stays tab leftover → /compute');
assert.equal(potterHome308Dest('/open-alpha'), COMPUTE, 'apex /open-alpha stays tab leftover → /compute');
assert.equal(potterHome308Dest('/open-alpha/'), COMPUTE, 'apex /open-alpha/ stays tab leftover → /compute');
assert.equal(potterHome308Dest('/dasha-compute-open-alpha.tar.gz'), null, 'canonical kit stays 200');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
for (const path of SKIP) {
  assert.notEqual(potterHome308Dest(path), KIT, `do not invent ${path}`);
}

const env = {
  LOBBY_SESSION_SECRET: 'compute-kit-tar-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  ASSETS: { fetch: async () => new Response('kit', { status: 200 }) },
};
function kitNameLoc(host) {
  return host === 'lobby.getdasha.com' ? LOBBY_KIT : KIT;
}

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
  for (const path of KIT_NAME_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), kitNameLoc(host), `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not /compute HTML`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const tab = await edgeWorker.fetch(new Request(`https://${host}/compute/kit`), env);
  assert.equal(tab.status, 308, `${host} /compute/kit stays tab`);
  assert.equal(tab.headers.get('location'), COMPUTE, `${host} /compute/kit loc`);
  const apex = await edgeWorker.fetch(new Request(`https://${host}/open-alpha`), env);
  assert.equal(apex.status, 308, `${host} /open-alpha stays apex leftover`);
  assert.equal(apex.headers.get('location'), COMPUTE, `${host} /open-alpha loc`);
  const canon = await edgeWorker.fetch(new Request(`https://${host}/dasha-compute-open-alpha.tar.gz`), env);
  assert.equal(canon.status, 200, `${host} /dasha-compute-open-alpha.tar.gz stays 200`);
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/kit.tar.gz</loc>`), 'sitemap omits leftover /kit.tar.gz');
assert.ok(!sitemapXml.includes(`${WWW}/compute/kit.tar.gz</loc>`), 'sitemap omits leftover /compute/kit.tar.gz');
assert.ok(!sitemapXml.includes(`${WWW}/compute/open-alpha</loc>`), 'sitemap omits leftover /compute/open-alpha');
assert.ok(!sitemapXml.includes(`${WWW}/compute/open_alpha</loc>`), 'sitemap omits leftover /compute/open_alpha');
assert.ok(!sitemapXml.includes(`${WWW}/dasha-compute-open-alpha</loc>`), 'sitemap omits leftover /dasha-compute-open-alpha');

console.log('dasha-compute-kit-tar-pretty-path: PASS (/kit.tar.gz+/kit.tar.gz/ 308 gzip kit; Title-case /Kit.tar.gz; dest never /compute HTML; open-alpha peers unchanged; bare /compute/open-alpha+/compute/open_alpha+/dasha-compute-open-alpha 308 gzip kit lobby same-host; /compute/kit stays tab; apex /open-alpha stays /compute; canonical kit 200; no /assets/kit.tar.gz or DEX peers or apex /readme;/install.sh; www+lobby GET+HEAD; no plugin.jup.ag)');
