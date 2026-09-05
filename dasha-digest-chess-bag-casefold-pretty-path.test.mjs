#!/usr/bin/env node
/**
 * Leftover Title-case /Digest /Digest.json /Chess/me|/queue /Bag/api/record
 * html-404 while lowercase siblings already 200 (or 400/405). 308 to canonical
 * lowercase on www; exact lowercase stays null so handlers run.
 * Chess subpaths keep remainder case (game/challenge/tournament ids).
 * Disk only. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /\['\/digest'/, 'digest in product casefold map');
assert.match(workerSrc, /\['\/digest\.json'/, 'digest.json in product casefold map');
assert.match(workerSrc, /\/Chess\/\.\.\. Title-case subpaths/, 'chess subpath case-fold comment');
assert.match(workerSrc, /\/Bag\/api\(\.\.\.\) Title-case/, 'bag api case-fold comment');

const WWW = 'https://www.getdasha.com';

const CASES = [
  ['/Digest', `${WWW}/digest`],
  ['/DIGEST', `${WWW}/digest`],
  ['/Digest/', `${WWW}/digest`],
  ['/Digest.json', `${WWW}/digest.json`],
  ['/DIGEST.JSON', `${WWW}/digest.json`],
  ['/Chess/me', `${WWW}/chess/me`],
  ['/CHESS/me', `${WWW}/chess/me`],
  ['/Chess/queue', `${WWW}/chess/queue`],
  ['/Chess/replay/AbCdEf', `${WWW}/chess/replay/AbCdEf`],
  ['/Bag/api/record', `${WWW}/bag/api/record`],
  ['/BAG/API/record', `${WWW}/bag/api/record`],
  ['/Bag/api', `${WWW}/bag/api`],
  ['/Digest/pack', `${WWW}/digest/pack`],
  ['/DIGEST/ingest', `${WWW}/digest/ingest`],
];

for (const [path, dest] of CASES) {
  assert.equal(potterHome308Dest(path), dest, path);
}

for (const path of [
  '/digest',
  '/digest/',
  '/digest.json',
  '/chess/me',
  '/chess/queue',
  '/chess/QUEUE',
  '/chess/replay/AbCdEf',
  '/bag/api/record',
  '/bag/api',
  '/digest/pack',
  '/digest/ingest',
]) {
  assert.equal(potterHome308Dest(path), null, `lowercase ${path} stays for handlers`);
}

// Bare /Chess stays on product map (same dest as other Title-case products)
assert.equal(potterHome308Dest('/Chess'), `${WWW}/chess`);
assert.equal(potterHome308Dest('/chess'), null, 'bare lowercase /chess stays 200');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

console.log('dasha-digest-chess-bag-casefold-pretty-path: PASS (Digest/Chess/Bag Title-case 308 lowercase www+lobby GET+HEAD)');
