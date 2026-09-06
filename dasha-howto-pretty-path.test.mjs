#!/usr/bin/env node
/**
 * Leftover pretty path: live /Buy /Howto case variants html-404 while lowercase /buy /howto 308 to /how-to-buy.
 * Home Buy first paint is jup.ag swap (external); dest stays first-party /how-to-buy like sibling pretty paths.
 * Dest-by-path GET+HEAD on www + lobby. Keep /how-to-buy 200. Sitemap omits leftover 308.
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

const HOWTO = 'https://www.getdasha.com/how-to-buy';
const PATHS = [
  '/how', '/how/',
  '/howto', '/howto/',
  '/how-to', '/how-to/',
  '/howtobuy', '/howtobuy/',
  '/how-tobuy', '/how-tobuy/',
  '/howto_buy', '/howto_buy/',
  '/buy', '/buy/',
  '/Buy', '/BUY', '/Buy/',
  '/Howto', '/HowTo', '/HOWTO',
  '/How-To', '/Howtobuy',
  '/How-tobuy', '/Howto_buy',
];

for (const path of PATHS) {
  assert.equal(potterHome308Dest(path), HOWTO, path);
}
assert.equal(potterHome308Dest('/how-to-buy'), null);
assert.equal(potterHome308Dest('/how-to-buy/'), null);
assert.equal(potterHome308Dest('/How-To-Buy'), HOWTO, 'Title-case how-to-buy casefolds to canonical');
assert.equal(potterHome308Dest('/How-to-buy'), HOWTO, 'Title-case How-to-buy casefolds');
assert.equal(potterHome308Dest('/Studio'), 'https://www.getdasha.com/', 'home 308 family also case-folds');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of PATHS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), HOWTO, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const page = await edgeWorker.fetch(new Request(`https://${host}/how-to-buy`), env);
  assert.equal(page.status, 200, `${host} /how-to-buy stays 200`);
  if (host === 'www.getdasha.com') assert.equal(page.headers.get('x-dasha-edge'), 'howto');
  const html = await page.text();
  assert.match(html, /<h1>How to buy \$dasha<\/h1>/);
  assert.match(html, /jup\.ag\/swap/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/how-to-buy<\/loc>/);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/howto</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/how-to</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/howtobuy</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/how-tobuy</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/howto_buy</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/buy</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/how</);

console.log('dasha-howto-pretty-path: PASS (case-fold /Buy+/Howto+/how+/how-tobuy+/howto_buy family 308 /how-to-buy www+lobby GET+HEAD, page 200, sitemap omits leftover)');
