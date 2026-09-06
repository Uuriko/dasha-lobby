#!/usr/bin/env node
/**
 * Leftover pretty path: live apex /api/{jobs,status,network,healthz,health}
 * (+slash / Title-case) were html-404 while /compute/api/{jobs,status,network,healthz}
 * already exist. Fold to those API dests (/api/health → healthz).
 * Peers: /jobs /compute/jobs → jobs; /compute/{status,network,healthz,health} → API dests.
 * Lobby keeps same-host /compute/api/* via potterHome308Response.
 * Disk only. No Designer. Never plugin.jup.ag.
 * Do not invent /api/sponsors /api/providers. Bare /status /network /healthz /health stay out.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /apex \/api\/\{jobs,status,network,healthz,health\}/, 'apex api prefix comment');
assert.match(workerSrc, /Bare \/status\|\/network\|\/healthz\|\/health stay out/, 'bare stay-out comment');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const JOBS = `${WWW}/compute/api/jobs`;
const STATUS = `${WWW}/compute/api/status`;
const NETWORK = `${WWW}/compute/api/network`;
const HEALTHZ = `${WWW}/compute/api/healthz`;

const FOLDS = [
  // apex /api/jobs
  ['/api/jobs', JOBS],
  ['/api/jobs/', JOBS],
  ['/Api/Jobs', JOBS],
  ['/API/jobs/', JOBS],
  ['/api/JOBS', JOBS],
  // apex /api/status
  ['/api/status', STATUS],
  ['/api/status/', STATUS],
  ['/Api/Status', STATUS],
  ['/API/STATUS/', STATUS],
  // apex /api/network
  ['/api/network', NETWORK],
  ['/api/network/', NETWORK],
  ['/Api/Network', NETWORK],
  ['/API/network/', NETWORK],
  // apex /api/healthz + /api/health → healthz
  ['/api/healthz', HEALTHZ],
  ['/api/healthz/', HEALTHZ],
  ['/Api/Healthz', HEALTHZ],
  ['/API/HEALTHZ/', HEALTHZ],
  ['/api/health', HEALTHZ],
  ['/api/health/', HEALTHZ],
  ['/Api/Health', HEALTHZ],
  ['/API/HEALTH/', HEALTHZ],
  // prior peers
  ['/jobs', JOBS],
  ['/jobs/', JOBS],
  ['/Jobs', JOBS],
  ['/JOBS/', JOBS],
  ['/compute/jobs', JOBS],
  ['/compute/jobs/', JOBS],
  ['/Compute/jobs', JOBS],
  ['/COMPUTE/JOBS/', JOBS],
  ['/compute/status', STATUS],
  ['/compute/status/', STATUS],
  ['/Compute/status', STATUS],
  ['/COMPUTE/STATUS/', STATUS],
  ['/compute/network', NETWORK],
  ['/compute/network/', NETWORK],
  ['/Compute/network', NETWORK],
  ['/COMPUTE/NETWORK/', NETWORK],
  ['/compute/healthz', HEALTHZ],
  ['/compute/healthz/', HEALTHZ],
  ['/Compute/healthz', HEALTHZ],
  ['/compute/health', HEALTHZ],
  ['/compute/health/', HEALTHZ],
  ['/Compute/health', HEALTHZ],
];

const STAY_OUT = [
  '/status', '/status/', '/Status',
  '/network', '/network/', '/Network',
  '/healthz', '/healthz/', '/Healthz',
  '/health', '/health/', '/Health',
  '/compute/api/jobs', '/compute/api/jobs/',
  '/compute/api/status', '/compute/api/status/',
  '/compute/api/network', '/compute/api/network/',
  '/compute/api/healthz', '/compute/api/healthz/',
  '/compute/ocm/healthz',
  '/api/sponsors', '/api/providers',
];

for (const [path, dest] of FOLDS) {
  assert.equal(potterHome308Dest(path), dest, path);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay out ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'compute-api-prefix-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      let want = dest;
      if (host === 'lobby.getdasha.com') {
        want = LOBBY + new URL(dest).pathname;
      }
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const health = await edgeWorker.fetch(new Request(`https://${host}/compute/api/healthz`, { method }), env);
    assert.equal(health.status, 200, `${host} /compute/api/healthz ${method}`);
    if (method === 'GET') {
      const body = await health.json();
      assert.equal(body.ok, true);
      assert.equal(body.service, 'dasha-compute');
    } else {
      assert.equal(await health.text(), '');
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/api/jobs', '/api/status', '/api/network', '/api/healthz', '/api/health', '/jobs']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-compute-api-prefix-pretty-path: PASS (apex /api/{jobs,status,network,healthz,health} + peers 308 /compute/api/* www+lobby GET+HEAD; stay-outs; no plugin.jup.ag)');
