#!/usr/bin/env node
/**
 * Leftover: live GET /fill /jar /fill-the-jar (and Title-case / slash) → html-404.
 * Fill the jar is the quiet faucet side door; bare /faucet/fill already 308→/faucet.
 * Pretty doors /fill /jar /fill-the-jar must 308 → https://www.getdasha.com/faucet (casefold).
 * Worker 2608ea9d leftover: /faucet/fill-the-jar /faucet/fill_the_jar (+slash / Title-case) same dest.
 * Never plugin.jup.ag. Never Designer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_FAUCET_DOOR_308_PATHS/, 'faucet door set present');
assert.match(workerSrc, /Quiet Fill-the-jar \+ tip-me doors/);

const FAUCET = 'https://www.getdasha.com/faucet';
const CASES = [
  '/fill', '/fill/', '/Fill', '/FILL', '/fIll/',
  '/jar', '/jar/', '/Jar', '/JAR', '/jAr/',
  '/fill-the-jar', '/fill-the-jar/', '/Fill-the-jar', '/FILL-THE-JAR', '/Fill-The-Jar/',
  '/faucet/fill-the-jar', '/faucet/fill-the-jar/', '/Faucet/fill-the-jar', '/FAUCET/FILL-THE-JAR',
  '/faucet/fill_the_jar', '/faucet/fill_the_jar/', '/Faucet/fill_the_jar', '/FAUCET/FILL_THE_JAR',
];

for (const path of CASES) {
  assert.equal(potterHome308Dest(path), FAUCET, path);
}
assert.equal(potterHome308Dest('/faucet'), null, 'lowercase /faucet stays 200');
assert.equal(potterHome308Dest('/faucet/fill'), null, 'bare fill share stays fillShareApi');
assert.equal(potterHome308Dest('/buy'), 'https://www.getdasha.com/how-to-buy');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), FAUCET, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const faucet = await edgeWorker.fetch(new Request(`https://${host}/faucet`), env);
  assert.equal(faucet.status, 200, `${host} /faucet stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(faucet.headers.get('x-dasha-edge'), 'faucet');
  }
}

{
  const bare = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/fill'), env);
  assert.equal(bare.status, 308);
  assert.equal(bare.headers.get('location'), FAUCET);
  assert.equal(bare.headers.get('x-dasha-edge'), 'faucet-fill');
}

console.log('dasha-faucet-fill-jar-pretty-path: PASS (/fill+/jar+/fill-the-jar+/faucet/fill-the-jar+/faucet/fill_the_jar casefold 308→/faucet www+lobby GET+HEAD)');
