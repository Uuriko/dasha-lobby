#!/usr/bin/env node
/** Invent-hunt nested compute/api/*.json Motley Map 308s (durable main). */
import assert from 'node:assert/strict';
import { potterHome308Dest, default as edgeWorker } from './dasha-lobby-worker.mjs';

const WWW = 'https://www.getdasha.com';
const CASES = [
  ['/compute/api/network.json', `${WWW}/compute/api/network`],
  ['/compute/api/pricing.json', `${WWW}/compute/api/pricing`],
  ['/compute/api/receipts.json', `${WWW}/compute/api/receipts`],
  ['/compute/api/chain.json', `${WWW}/compute/api/chain`],
];
for (const [path, dest] of CASES) {
  assert.equal(potterHome308Dest(path), dest, path);
  assert.equal(potterHome308Dest(path + '/'), dest, path + '/');
}
assert.equal(potterHome308Dest('/Compute/Api/Network.json'), `${WWW}/compute/api/network`);
assert.equal(potterHome308Dest('/muse'), `${WWW}/`);
for (const path of ['/api/v1', '/api/models', '/api/providers']) {
  assert.equal(potterHome308Dest(path), null, `leave ${path}`);
}
const env = { LOBBY_SESSION_SECRET: 'invent-hunt-main-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const [path, dest] of CASES) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), env);
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), dest, path);
}
console.log('dasha-invent-hunt-nested-json-pretty-path: PASS');
