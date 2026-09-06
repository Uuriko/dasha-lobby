#!/usr/bin/env node
/**
 * Leftover pretty path: live /ca /CA html-404 (x-dasha-edge: html-404) while /verify
 * already 308 → /which. Traders search CA and should land dash_eats vs VVAIFU.
 * Dest-by-path GET+HEAD on www + lobby. Keep /which 200. Sitemap omits leftover 308.
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
assert.match(workerSrc, /(?:String\(path \|\| ''\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');

const WHICH = 'https://www.getdasha.com/which';
const PATHS = [
  '/ca', '/ca/',
  '/CA', '/Ca', '/CA/',
  '/verify', '/verify/',
];

for (const path of PATHS) {
  assert.equal(potterHome308Dest(path), WHICH, path);
}
assert.equal(potterHome308Dest('/which'), null, '/which stays 200');
assert.equal(potterHome308Dest('/auth/grok/verify'), null, 'SIWG verify stays JSON');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/ca', '/ca/', '/CA', '/verify']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), WHICH, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const page = await edgeWorker.fetch(new Request(`https://${host}/which`), env);
  assert.equal(page.status, 200, `${host} /which stays 200`);
  if (host === 'www.getdasha.com') assert.equal(page.headers.get('x-dasha-edge'), 'which');
  const html = await page.text();
  assert.match(html, /dash_eats/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/which<\/loc>/);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/ca</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/verify</);

console.log('dasha-ca-which-pretty-path: PASS (/ca+/verify family 308 /which www+lobby GET+HEAD, /which 200, sitemap omits leftover)');
