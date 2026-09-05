#!/usr/bin/env node
/**
 * Leftover 2026-09-01: live /siwg 404 html-404; /grok already 308 login#grok.
 * Live /compute 200 tabs; /compute/night (and other tab paths) 404 html-404.
 * 308 leftover dests. Keep /compute 200 and /compute/api JSON.
 * Disk only. No static-gen. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const LOGIN = 'https://www.getdasha.com/login#grok';
const COMPUTE = 'https://www.getdasha.com/compute';
const SIWG = ['/siwg', '/siwg/', '/grok', '/grok/'];
const TABS = [
  '/compute/use', '/compute/use/',
  '/compute/provide', '/compute/provide/',
  '/compute/night', '/compute/night/',
  '/compute/build', '/compute/build/',
  '/compute/sponsor', '/compute/sponsor/',
  '/compute/ask', '/compute/ask/',
  '/compute/pay', '/compute/pay/',
  '/compute/credits', '/compute/credits/',
  '/compute/host', '/compute/host/',
  '/compute/market', '/compute/market/',
  '/compute/marketplace', '/compute/marketplace/',
  '/compute/you', '/compute/you/',
  '/compute/Ask', '/compute/Credits', '/compute/Pay',
];

for (const path of SIWG) {
  assert.equal(potterHome308Dest(path), LOGIN, path);
}
for (const path of TABS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute'), null);
assert.equal(potterHome308Dest('/compute/'), COMPUTE);
assert.equal(potterHome308Dest('/compute/index.html'), COMPUTE);
assert.equal(potterHome308Dest('/compute/api'), null);
assert.equal(potterHome308Dest('/compute/api/'), null);
assert.equal(potterHome308Dest('/compute/api/healthz'), null);

for (const method of ['GET', 'HEAD']) {
  for (const path of SIWG) {
    const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`, { method }), {});
    assert.equal(res.status, 308, `${method} ${path}`);
    assert.equal(res.headers.get('location'), LOGIN, `${method} ${path} dest`);
  }
  for (const path of TABS) {
    const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`, { method }), {});
    assert.equal(res.status, 308, `${method} ${path}`);
    assert.equal(res.headers.get('location'), COMPUTE, `${method} ${path} dest`);
    assert.doesNotMatch(res.headers.get('location') || '', /#/, `${method} ${path} no hash`);
  }
}

{
  const compute = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
  assert.equal(compute.status, 200);
  assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  const body = await compute.text();
  assert.match(body, /Dasha Compute|Ask\.|Start\./);
  assert.doesNotMatch(body, /plugin\.jup\.ag/);
  const slash = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute/'), {});
  assert.equal(slash.status, 308);
  assert.equal(slash.headers.get('location'), COMPUTE);
}

const env = {
  AI: {},
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
};
{
  const api = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute/api'), env);
  assert.equal(api.status, 200);
  assert.match(api.headers.get('content-type') || '', /json/);
  const data = await api.json();
  assert.equal(data.live, true);
}
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const method of ['GET', 'HEAD']) {
    const health = await edgeWorker.fetch(new Request(`https://${host}/compute/api/healthz`, { method }), env);
    assert.equal(health.status, 200, `${host} healthz ${method}`);
    assert.match(health.headers.get('content-type') || '', /json/);
    if (method === 'GET') {
      const data = await health.json();
      assert.equal(data.ok, true);
      assert.equal(data.service, 'dasha-compute');
    } else {
      assert.equal(await health.text(), '');
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/compute<\/loc>/);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/siwg</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/grok</);
for (const path of ['/compute/use', '/compute/provide', '/compute/night', '/compute/build', '/compute/sponsor']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits ${path}`);
}

console.log('dasha-siwg-compute-leftover: PASS (/siwg 308 login#grok, compute tabs 308 /compute, /compute 200, /compute/ 308, /compute/api JSON, healthz 200, no plugin.jup.ag)');
