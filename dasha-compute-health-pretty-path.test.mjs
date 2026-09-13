#!/usr/bin/env node
/**
 * Leftover pretty path: live /compute/health + /compute/healthz (+slash / Title-case)
 * were html-404 while /compute/api/healthz is already 200 JSON.
 * Dest is /compute/api/healthz (not /compute HTML tab). Lobby keeps same-host
 * /compute/api/* via potterHome308Response. Disk only. No Designer. Never plugin.jup.ag.
 * Leftover /compute/readyz (+slash / Title-case) 308 → /compute/api/readyz
 * (parallel to healthz). Exact /compute/api/readyz stays 200 JSON alias.
 * Do not invent /compute/ready /compute/ping /healthz /readyz.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const HEALTHZ = 'https://www.getdasha.com/compute/api/healthz';
const READYZ = 'https://www.getdasha.com/compute/api/readyz';
const COMPUTE = 'https://www.getdasha.com/compute';

const HEALTH_PROBES = [
  '/compute/health', '/compute/health/', '/Compute/health', '/COMPUTE/HEALTH', '/Compute/Health/',
  '/compute/healthz', '/compute/healthz/', '/Compute/healthz', '/COMPUTE/HEALTHZ', '/Compute/Healthz/',
];
const READYZ_PROBES = [
  '/compute/readyz', '/compute/readyz/', '/Compute/readyz', '/COMPUTE/READYZ', '/Compute/Readyz/',
];
const INVENTED = [
  '/compute/ready', '/compute/ping', '/healthz', '/readyz', '/health',
];

for (const path of HEALTH_PROBES) {
  assert.equal(potterHome308Dest(path), HEALTHZ, path);
}
for (const path of READYZ_PROBES) {
  assert.equal(potterHome308Dest(path), READYZ, path);
}
assert.equal(potterHome308Dest('/compute/api/healthz'), null, '/compute/api/healthz stays 200');
assert.equal(potterHome308Dest('/compute/api/healthz/'), null, '/compute/api/healthz/ stays API');
assert.equal(potterHome308Dest('/compute/api/health'), null, '/compute/api/health stays 200 JSON alias');
assert.equal(potterHome308Dest('/compute/api/health/'), null, '/compute/api/health/ stays API');
assert.equal(potterHome308Dest('/compute/api/readyz'), null, '/compute/api/readyz stays 200 JSON alias');
assert.equal(potterHome308Dest('/compute/api/readyz/'), null, '/compute/api/readyz/ stays API');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/use'), COMPUTE, '/compute/use still compute tab');
for (const path of INVENTED) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'compute-health-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const expectLoc = host === 'lobby.getdasha.com'
    ? 'https://lobby.getdasha.com/compute/api/healthz'
    : HEALTHZ;
  const expectReadyz = host === 'lobby.getdasha.com'
    ? 'https://lobby.getdasha.com/compute/api/readyz'
    : READYZ;
  for (const path of HEALTH_PROBES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of READYZ_PROBES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectReadyz, `${host} ${path} ${method} loc`);
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
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/compute/health', '/compute/healthz', '/compute/readyz']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-compute-health-pretty-path: PASS (/compute/health+/healthz 308 /compute/api/healthz; /compute/readyz 308 /compute/api/readyz www+lobby GET+HEAD; api healthz+readyz 200; no plugin.jup.ag)');
