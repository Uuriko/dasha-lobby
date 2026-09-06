#!/usr/bin/env node
/**
 * Leftover pretty path: /verify (+slash / Title-case) 308 → /which.
 * /ca moved to /bag on live Worker 8266782e (see dasha-bag-chart-trade-board-pretty-path).
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
const BAG = 'https://www.getdasha.com/bag';
const PATHS = [
  '/verify', '/verify/',
  '/Verify', '/VERIFY', '/Verify/',
];

for (const path of PATHS) {
  assert.equal(potterHome308Dest(path), WHICH, path);
}
assert.equal(potterHome308Dest('/which'), null, '/which stays 200');
assert.equal(potterHome308Dest('/auth/grok/verify'), null, 'SIWG verify stays JSON');
assert.equal(potterHome308Dest('/ca'), BAG, '/ca now folds /bag (Worker 8266782e)');
assert.equal(potterHome308Dest('/CA'), BAG, '/CA now folds /bag');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/verify', '/verify/', '/Verify']) {
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

console.log('dasha-ca-which-pretty-path: PASS (/verify family 308 /which www+lobby GET+HEAD, /ca now /bag, /which 200, sitemap omits leftover)');
