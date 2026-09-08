#!/usr/bin/env node
/**
 * Fail-loud alias: live /compute/api/health (+slash) was JSON 404
 * `{error:"not found"}` while /compute/api/healthz is already 200.
 * Same GET+HEAD handler as healthz (same JSON + CORS), not a 308.
 * Apex /compute/health still 308 → /compute/api/healthz.
 * Do not fold /compute/ocm/healthz. Do not invent site-root /health.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { ComputeNetwork, computeApi } from './dasha-compute-network.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/, 'network must not mention plugin.jup.ag');
assert.match(networkSrc, /isComputeApiHealthzPath/, 'shared healthz+health helper');
assert.match(networkSrc, /path === '\/compute\/api\/health'/, 'health alias path');
assert.match(networkSrc, /path === '\/compute\/api\/health\/'/, 'health alias slash');
assert.doesNotMatch(networkSrc, /\/compute\/ocm\/health/, 'must not fold ocm health');

const HEALTHZ_JSON = { ok: true, service: 'dasha-compute', version: '0.3.0' };
const ALIAS_PATHS = ['/compute/api/health', '/compute/api/health/'];
const HEALTHZ_PATHS = ['/compute/api/healthz', '/compute/api/healthz/'];
const CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-allow-credentials',
  'vary',
  'content-type',
];

const env = { LOBBY_SESSION_SECRET: 'compute-api-health-alias-secret', AI: { run: async () => ({ response: 'ok' }) } };
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };

function assertHeaderParity(a, b, label) {
  for (const name of CORS_HEADERS) {
    assert.equal(a.headers.get(name), b.headers.get(name), `${label} ${name}`);
  }
}

async function assertSameHealth(fetchImpl, url, healthzUrl, init = {}, label) {
  const healthz = await fetchImpl(new Request(healthzUrl, init));
  const alias = await fetchImpl(new Request(url, init));
  assert.equal(healthz.status, 200, `${label} healthz status`);
  assert.equal(alias.status, 200, `${label} alias status`);
  assertHeaderParity(alias, healthz, label);
  if ((init.method || 'GET') === 'HEAD') {
    assert.equal(await healthz.text(), '', `${label} healthz HEAD empty`);
    assert.equal(await alias.text(), '', `${label} alias HEAD empty`);
    return;
  }
  const healthzBody = await healthz.json();
  const aliasBody = await alias.json();
  assert.deepEqual(aliasBody, healthzBody, `${label} body parity`);
  assert.equal(aliasBody.ok, true, `${label} ok`);
  assert.equal(aliasBody.service, 'dasha-compute', `${label} service`);
  assert.equal(aliasBody.version, '0.3.0', `${label} version`);
}

for (const path of [...HEALTHZ_PATHS, ...ALIAS_PATHS]) {
  assert.equal(potterHome308Dest(path), null, `${path} is not a 308`);
}
assert.equal(potterHome308Dest('/compute/health'), 'https://www.getdasha.com/compute/api/healthz', '/compute/health still 308 healthz');
assert.equal(potterHome308Dest('/compute/healthz'), 'https://www.getdasha.com/compute/api/healthz', '/compute/healthz still 308 healthz');
assert.equal(potterHome308Dest('/compute/ocm/healthz'), null, 'do not fold /compute/ocm/healthz');
assert.equal(potterHome308Dest('/health'), null, 'do not invent site-root /health');
assert.equal(potterHome308Dest('/healthz'), null, 'do not invent site-root /healthz');

for (const path of ALIAS_PATHS) {
  for (const method of ['GET', 'HEAD']) {
    await assertSameHealth(
      (request) => network.fetch(request),
      `https://lobby.getdasha.com${path}`,
      'https://lobby.getdasha.com/compute/api/healthz',
      { method },
      `ComputeNetwork ${path} ${method}`,
    );
  }
}

{
  const origin = 'https://www.getdasha.com';
  const healthz = await computeApi(new Request('https://www.getdasha.com/compute/api/healthz', { headers: { Origin: origin } }), env, origin);
  const alias = await computeApi(new Request('https://www.getdasha.com/compute/api/health', { headers: { Origin: origin } }), env, origin);
  assert.equal(alias.status, 200);
  assert.deepEqual(await alias.json(), HEALTHZ_JSON);
  assert.deepEqual(await healthz.json(), HEALTHZ_JSON);
  assert.equal(alias.headers.get('access-control-allow-origin'), origin);
  assert.equal(healthz.headers.get('access-control-allow-origin'), origin);
  assert.equal(alias.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(alias.headers.get('content-type'), healthz.headers.get('content-type'));
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ALIAS_PATHS) {
    for (const method of ['GET', 'HEAD']) {
      await assertSameHealth(
        (request) => worker.fetch(request, workerEnv),
        `https://${host}${path}`,
        `https://${host}/compute/api/healthz`,
        { method, headers: { Origin: 'https://www.getdasha.com' } },
        `worker ${host} ${path} ${method}`,
      );
    }
  }

  const healthz = await worker.fetch(new Request(`https://${host}/compute/api/healthz`), workerEnv);
  assert.deepEqual(await healthz.json(), HEALTHZ_JSON, `${host} healthz exact body`);

  const apex = await worker.fetch(new Request(`https://${host}/compute/health`), workerEnv);
  assert.equal(apex.status, 308, `${host} /compute/health still 308`);
  assert.equal(
    apex.headers.get('location'),
    `https://${host === 'lobby.getdasha.com' ? 'lobby.getdasha.com' : 'www.getdasha.com'}/compute/api/healthz`,
    `${host} /compute/health dest`,
  );

  const rootHealth = await worker.fetch(new Request(`https://${host}/health`), workerEnv);
  if ((rootHealth.headers.get('content-type') || '').includes('json')) {
    const body = await rootHealth.json();
    assert.notEqual(body.service, 'dasha-compute', `${host} /health is not compute`);
    assert.notDeepEqual(body, HEALTHZ_JSON, `${host} /health is not compute JSON`);
  } else {
    await rootHealth.text();
  }
}

assert.equal([...rows.keys()].some((key) => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-api-health-alias: PASS (/compute/api/health same 200 JSON as healthz GET+HEAD www+lobby; healthz exact; apex /compute/health 308; no ocm/root /health)');
