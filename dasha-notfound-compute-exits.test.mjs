#!/usr/bin/env node
/** 404 page offers Compute exits: /compute, /compute/start, /sitemap.xml (plus existing doors). */
import assert from 'node:assert/strict';
import edgeWorker from './dasha-lobby-worker.mjs';

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/nope-not-a-page'), {});
assert.equal(res.status, 404);
const html = await res.text();
assert.match(html, /Not this page\./, '404 face');
for (const href of [
  'https://www.getdasha.com/compute">Compute</a>',
  'https://www.getdasha.com/compute/start">Compute start</a>',
  'https://www.getdasha.com/sitemap.xml">Sitemap</a>',
]) {
  assert.ok(html.includes(`<a href="${href}`), `404 exit ${href}`);
}
// Existing exits stay.
for (const href of [
  'https://www.getdasha.com/">Home</a>',
  'https://www.getdasha.com/simp">Simp</a>',
  'https://www.getdasha.com/lobby">Lobby</a>',
  'https://www.getdasha.com/faucet">Faucet</a>',
  'https://www.getdasha.com/how-to-buy">How to buy</a>',
  'https://www.getdasha.com/privacy">Privacy</a>',
]) {
  assert.ok(html.includes(`<a href="${href}`), `404 keeps ${href}`);
}

console.log('dasha-notfound-compute-exits: PASS');
