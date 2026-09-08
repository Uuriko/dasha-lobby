#!/usr/bin/env node
/**
 * Leftover pretty path: /verify (+slash / Title-case) 308 → /which.
 * /ca moved to /bag on live Worker 8266782e, then on to /which (current live).
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
// Heads ladder (992/993): /verify retired its 308 and is now a real 200 page.
for (const path of ['/verify', '/verify/', '/Verify', '/VERIFY', '/Verify/']) {
  assert.equal(potterHome308Dest(path), null, path + ' stays 200 (real verify page)');
}
assert.equal(potterHome308Dest('/which'), null, '/which stays 200');
assert.equal(potterHome308Dest('/auth/grok/verify'), null, 'SIWG verify stays JSON');
assert.equal(potterHome308Dest('/ca'), WHICH, '/ca now folds /which (live moved past 8266782e)');
assert.equal(potterHome308Dest('/CA'), WHICH, '/CA now folds /which');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/verify', '/verify/', '/Verify']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method} now the real verify page`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
      else assert.match(await res.text(), /signed receipt/i, `${host} ${path} serves the verifier`);
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
assert.match(sitemapXml, /getdasha\.com\/verify<\/loc>/, 'sitemap lists the real /verify page');

console.log('dasha-ca-which-pretty-path: PASS (/verify family 200 real page, /ca now /which, /which 200, sitemap lists /verify)');
