#!/usr/bin/env node
/**
 * Leftover pretty path: live apex /api/{jobs,status,network,healthz,health}
 * (+slash / Title-case) were html-404 while /compute/api/{jobs,status,network,healthz}
 * already exist. Fold to those API dests (/api/health → healthz).
 * Apex /api/readyz and /api/pricing (+slash / Title-case) use the same
 * potterHome308Dest helper: 308 → /compute/api/readyz and /compute/api/pricing.
 * Peers: /jobs /compute/jobs → jobs; /compute/{status,network,healthz,health} → API dests.
 * Lobby keeps same-host /compute/api/* via potterHome308Response.
 * Disk only. No Designer. Never plugin.jup.ag.
 * Do not invent /api/sponsors /api/providers /api/pricing.json.
 * Bare /status /network /healthz /health /readyz stay out.
 * Bare /pricing stays the compute tab.
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
const READYZ = `${WWW}/compute/api/readyz`;
const PRICING = `${WWW}/compute/api/pricing`;

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
  // apex /api/readyz + /api/pricing — same helper as /api/healthz
  ['/api/readyz', READYZ],
  ['/api/readyz/', READYZ],
  ['/Api/Readyz', READYZ],
  ['/API/READYZ/', READYZ],
  ['/api/pricing', PRICING],
  ['/api/pricing/', PRICING],
  ['/Api/Pricing', PRICING],
  ['/API/PRICING/', PRICING],
  // prior peers
  ['/jobs', JOBS],
  ['/jobs/', JOBS],
  ['/Jobs', JOBS],
  ['/JOBS/', JOBS],
  ['/job', JOBS],
  ['/job/', JOBS],
  ['/Job', JOBS],
  ['/JOB/', JOBS],
  ['/compute/jobs', JOBS],
  ['/compute/jobs/', JOBS],
  ['/Compute/jobs', JOBS],
  ['/COMPUTE/JOBS/', JOBS],
  ['/compute/job', JOBS],
  ['/compute/job/', JOBS],
  ['/Compute/job', JOBS],
  ['/api/job', JOBS],
  ['/api/job/', JOBS],
  ['/Api/Job', JOBS],
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
  ['/compute/readyz', READYZ],
  ['/compute/readyz/', READYZ],
  ['/Compute/readyz', READYZ],
];

const STAY_OUT = [
  '/status', '/status/', '/Status',
  '/network', '/network/',
  '/healthz', '/healthz/', '/Healthz',
  '/health', '/health/', '/Health',
  '/compute/api/jobs', '/compute/api/jobs/',
  '/compute/api/status', '/compute/api/status/',
  '/compute/api/network', '/compute/api/network/',
  '/compute/api/healthz', '/compute/api/healthz/',
  '/compute/api/health', '/compute/api/health/',
  '/compute/api/readyz', '/compute/api/readyz/',
  '/compute/api/pricing', '/compute/api/pricing/',
  '/compute/ocm/healthz',
  '/api/sponsors', '/api/providers',
  '/readyz', '/readyz/',
  '/api/pricing.json', '/pricing.json',
];

for (const [path, dest] of FOLDS) {
  assert.equal(potterHome308Dest(path), dest, path);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay out ${path}`);
}
assert.equal(potterHome308Dest('/Network'), 'https://www.getdasha.com/network', 'Title-case /Network casefolds to Muse /network');
assert.equal(potterHome308Dest('/pricing'), `${WWW}/compute`, 'bare /pricing stays compute tab');
assert.equal(potterHome308Dest('/pricing/'), `${WWW}/compute`, 'bare /pricing/ stays compute tab');
assert.equal(potterHome308Dest('/compute/pricing'), `${WWW}/compute`, '/compute/pricing stays compute tab');
assert.match(workerSrc, /p === ["']\/api\/readyz["'] \|\| p === ["']\/api\/readyz\/["']/, 'readyz uses potterHome308Dest');
assert.match(workerSrc, /p === ["']\/api\/pricing["'] \|\| p === ["']\/api\/pricing\/["']/, 'pricing uses potterHome308Dest');
const healthSet = workerSrc.match(/const POTTER_COMPUTE_HEALTHZ_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(healthSet, /['"]\/api\/healthz['"]/, 'healthz route table lists apex /api/healthz');
assert.match(healthSet, /['"]\/api\/readyz['"]/, 'readyz lands on the healthz route table');
assert.doesNotMatch(healthSet, /['"]\/api\/pricing['"]/, 'pricing dest is not the healthz set');
assert.doesNotMatch(healthSet, /['"]\/readyz['"]/, 'do not invent bare /readyz');

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
    const alias = await edgeWorker.fetch(new Request(`https://${host}/compute/api/health`, { method }), env);
    assert.equal(alias.status, 200, `${host} /compute/api/health ${method}`);
    if (method === 'HEAD') assert.equal(await alias.text(), '');
    const readyz = await edgeWorker.fetch(new Request(`https://${host}/compute/api/readyz`, { method }), env);
    assert.equal(readyz.status, 200, `${host} /compute/api/readyz ${method}`);
    if (method === 'GET') {
      const body = await readyz.json();
      assert.equal(body.ok, true);
      assert.equal(body.service, 'dasha-compute');
    } else {
      assert.equal(await readyz.text(), '');
    }
    const pricing = await edgeWorker.fetch(new Request(`https://${host}/compute/api/pricing`, { method }), env);
    assert.notEqual(pricing.status, 308, `${host} /compute/api/pricing ${method} stays handler`);
    await pricing.arrayBuffer();
  }
  for (const path of ['/api/readyz', '/api/pricing']) {
    const post = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method: 'POST' }), env);
    assert.notEqual(post.status, 308, `${host} ${path} POST is not a leftover 308`);
    await post.arrayBuffer();
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/api/jobs', '/api/status', '/api/network', '/api/healthz', '/api/health', '/api/readyz', '/api/pricing', '/jobs']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-compute-api-prefix-pretty-path: PASS (apex /api/{jobs,status,network,healthz,health,readyz,pricing} + peers 308 /compute/api/* www+lobby GET+HEAD; stay-outs; bare /pricing stays /compute; no plugin.jup.ag)');
