#!/usr/bin/env node
/**
 * Leftover Title-case product pages: live /Lobby /Chess /Bag /Simp /Crew
 * /Contribute /Privacy /Which /How-to-buy /Bounties /Login (and slash) html-404
 * while lowercase siblings already 200. 308 to the same dest (canonical
 * lowercase). Exact lowercase stays 200. Extends /Faucet+/Compute casefold.
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
assert.match(workerSrc, /POTTER_PRODUCT_CASEFOLD_DEST/, 'product casefold map');
assert.match(workerSrc, /Title-case product pages \(\/Faucet \/Compute \/Lobby/, 'product case-fold comment');

const PRODUCTS = [
  ['lobby', 'lobby-page'],
  ['chess', 'chess'],
  ['bag', 'bag'],
  ['simp', 'simp'],
  ['crew', 'crew'],
  ['contribute', 'contribute'],
  ['privacy', 'privacy'],
  ['which', 'which'],
  ['how-to-buy', 'howto'],
  ['bounties', 'bounties'],
  ['login', 'login'],
  ['faucet', 'faucet'],
  ['compute', 'compute'],
];

for (const [slug, edge] of PRODUCTS) {
  const dest = `https://www.getdasha.com/${slug}`;
  const cases = [
    `/${slug[0].toUpperCase()}${slug.slice(1)}`,
    `/${slug.toUpperCase()}`,
    `/${slug[0].toUpperCase()}${slug.slice(1)}/`,
  ];
  // how-to-buy upper is awkward; add hyphen Title forms
  if (slug === 'how-to-buy') {
    cases.length = 0;
    cases.push('/How-to-buy', '/HOW-TO-BUY', '/How-To-Buy', '/How-to-buy/');
  }
  for (const path of cases) {
    assert.equal(potterHome308Dest(path), dest, path);
  }
  assert.equal(potterHome308Dest(`/${slug}`), null, `lowercase /${slug} stays 200`);
  assert.equal(potterHome308Dest(`/${slug}/`), null, `lowercase /${slug}/ stays 200`);
}

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [slug, edge] of PRODUCTS) {
    const dest = `https://www.getdasha.com/${slug}`;
    const title = slug === 'how-to-buy' ? '/How-to-buy' : `/${slug[0].toUpperCase()}${slug.slice(1)}`;
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${title}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${title} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${title} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
    const lower = await edgeWorker.fetch(new Request(`https://${host}/${slug}`), env);
    assert.equal(lower.status, 200, `${host} /${slug} stays 200`);
    if (host === 'www.getdasha.com') {
      assert.equal(lower.headers.get('x-dasha-edge'), edge, `${host} /${slug} edge`);
    }
  }
}

console.log('dasha-lobby-product-casefold-pretty-path: PASS (Title-case product 308s + lowercase 200 www+lobby)');
