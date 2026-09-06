#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 1a9b8eee): live /compute/faucet and
 * /faucet/compute (+slash / Title-case) html-404 → product-bridge 308s.
 * /compute/faucet → https://www.getdasha.com/faucet
 * /faucet/compute → https://www.getdasha.com/compute
 * Keep prior peers (faucet doors + compute tabs). Exact /faucet and
 * /compute stay 200 (null dest). /faucet/jar stays intentional 404 —
 * do not invent a fold. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_FAUCET_DOOR_308_PATHS/, 'faucet door 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(
  workerSrc,
  /\/compute\/faucet\|\/faucet\/compute/,
  'product-bridge leftover comment lists /compute/faucet|/faucet/compute',
);
assert.doesNotMatch(
  workerSrc,
  /POTTER_FAUCET_LEAF_CASEFOLD[\s\S]*\/faucet\/jar/,
  'do not invent /faucet/jar',
);

const FAUCET = 'https://www.getdasha.com/faucet';
const COMPUTE = 'https://www.getdasha.com/compute';

const TO_FAUCET = [
  '/compute/faucet', '/compute/faucet/', '/Compute/faucet', '/COMPUTE/FAUCET', '/Compute/Faucet/',
];
const TO_COMPUTE = [
  '/faucet/compute', '/faucet/compute/', '/Faucet/compute', '/FAUCET/COMPUTE', '/Faucet/Compute/',
];
const FAUCET_PEERS = [
  '/tip', '/tip/', '/Tip', '/TIP',
  '/fill', '/fill/', '/Fill',
  '/jar', '/jar/', '/Jar',
  '/fill-the-jar', '/Fill-the-jar',
  '/tip-me', '/Tip-me',
];
const COMPUTE_PEERS = [
  '/products', '/products/', '/Products',
  '/compute/products', '/Compute/products',
  '/product', '/providers',
  '/compute/use', '/Compute/use',
];
const STAY_OUT = [
  '/faucet',
  '/faucet/',
  '/compute',
  '/faucet/jar',
  '/Faucet/jar',
  '/FAUCET/JAR',
];

for (const path of TO_FAUCET) {
  assert.equal(potterHome308Dest(path), FAUCET, path);
}
for (const path of TO_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of FAUCET_PEERS) {
  assert.equal(potterHome308Dest(path), FAUCET, `peer ${path}`);
}
for (const path of COMPUTE_PEERS) {
  assert.equal(potterHome308Dest(path), COMPUTE, `peer ${path}`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay out ${path}`);
}
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/faucet/fill'), null, 'bare fill share stays fillShareApi');

const env = { LOBBY_SESSION_SECRET: 'faucet-compute-bridge-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of TO_FAUCET) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), FAUCET, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of TO_COMPUTE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of FAUCET_PEERS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} peer ${path} ${method}`);
      assert.equal(res.headers.get('location'), FAUCET, `${host} peer ${path} ${method} loc`);
    }
  }
  for (const path of COMPUTE_PEERS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} peer ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} peer ${path} ${method} loc`);
    }
  }
  const faucet = await edgeWorker.fetch(new Request(`https://${host}/faucet`), env);
  assert.equal(faucet.status, 200, `${host} /faucet stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(faucet.headers.get('x-dasha-edge'), 'faucet');
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
}

{
  const jar = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/jar'), env);
  assert.equal(jar.status, 404, 'www /faucet/jar stays 404');
  assert.equal(jar.headers.get('x-dasha-edge'), 'html-404');
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/compute/faucet', '/faucet/compute', '/tip', '/fill', '/jar', '/products']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-faucet-compute-bridge-pretty-path: PASS (/compute/faucet 308 /faucet; /faucet/compute 308 /compute; Title-case+slash both directions; peers; /faucet+/compute 200; /faucet/jar 404; no plugin.jup.ag)');
