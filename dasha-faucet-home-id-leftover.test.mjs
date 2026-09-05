#!/usr/bin/env node
/**
 * Leftover after faucet fill class=sig DRY.
 * Live /faucet 200 still serializes leftover home mount id in view-source:
 *   dasha-home-faucet
 * Tape + pathname guard + Buy + faucet.js + x-connect.js stay.
 * Home HOME_FAUCET_MOUNT stays. Disk only. No static-gen. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { FAUCET_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const page = readFileSync(join(root, 'dasha-faucet-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /HOME_FAUCET_MOUNT/, 'home faucet mount stays');
assert.match(workerSrc, /id="dasha-home-faucet"/, 'home still mounts #dasha-home-faucet');

for (const [label, body] of [
  ['disk', page],
  ['bundled', FAUCET_PAGE_HTML],
]) {
  assert.doesNotMatch(body, /dasha-home-faucet/, `${label} /faucet drops leftover home-faucet id`);
  assert.match(body, /location\.pathname/, `${label} pathname guard stays`);
  assert.match(body, /dasha-jar-tape/, `${label} tape mount stays`);
  assert.match(body, /Fills\./, `${label} Fills. stays`);
  assert.match(body, /id="dasha-faucet"/, `${label} #dasha-faucet stays`);
  assert.match(body, />Buy</, `${label} Buy stays`);
  assert.match(body, /jup\.ag\/swap/, `${label} jup.ag stays`);
  assert.match(body, new RegExp(MINT), `${label} mint stays`);
  assert.match(body, /faucet\.js/, `${label} faucet.js stays`);
  assert.match(body, /x-connect\.js/, `${label} x-connect.js stays`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'faucet');
const body = await res.text();
assert.doesNotMatch(body, /dasha-home-faucet/, 'worker /faucet drops leftover home-faucet id');
assert.match(body, /location\.pathname/);
assert.match(body, /dasha-jar-tape/);
assert.match(body, /<title>Fill the jar<\/title>/);
assert.match(body, />Buy</);
assert.match(body, /jup\.ag\/swap/);
assert.match(body, new RegExp(MINT));
assert.match(body, /faucet\.js/);
assert.match(body, /x-connect\.js/);
assert.doesNotMatch(body, /plugin\.jup\.ag/);
assert.match(body, /id=["']dasha-faucet["']/);

{
  const fillRes = await edgeWorker.fetch(new Request(`https://www.getdasha.com/faucet/fill/${'1'.repeat(64)}`), {});
  assert.equal(fillRes.status, 308, 'unknown fill still 308 /faucet');
  assert.equal(fillRes.headers.get('location'), 'https://www.getdasha.com/faucet');
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /\$dasha/);
  assert.match(homeHtml, /Chat/);
  assert.match(homeHtml, /Buy/);
  assert.doesNotMatch(homeHtml, /plugin\.jup\.ag/);
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-faucet-home-id-leftover: PASS (dasha-home-faucet gone from /faucet; tape + Buy stay; home mount stays)');
