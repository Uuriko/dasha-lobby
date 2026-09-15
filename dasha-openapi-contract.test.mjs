#!/usr/bin/env node
/**
 * Two-host OpenAPI contract: the documented surface must parse, stay well-formed,
 * and every documented GET path must have a real route in the worker source.
 * Opt-in live mode (DASHA_CONTRACT_LIVE=1) probes both hosts and asserts no
 * documented GET path 404s, pricing answers 200, and chat preflight is 204.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS_OPENAPI_JSON, DOCS_OPENAPI_YAML } from './dasha-docs-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const network = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

// The spec must be strict-JSON parseable (catches truncated-string drift).
const spec = JSON.parse(DOCS_OPENAPI_JSON);
assert.ok(spec.paths && typeof spec.paths === 'object', 'spec.paths present');

// No malformed keys from truncated descriptions (the provider_class) bug class).
for (const raw of [DOCS_OPENAPI_JSON, DOCS_OPENAPI_YAML]) {
  assert.ok(!raw.includes('"provider_class)"'), 'no truncated provider_class) key');
  assert.ok(!raw.includes('(model_id\n'), 'no unclosed (model_id description');
}

const REQUIRED_PATHS = [
  '/compute/api/guest-keys',
  '/compute/api/v1/models',
  '/compute/api/v1/chat/completions',
  '/compute/api/kit-sig',
  '/compute/api/verify',
  '/compute/api/chain',
  '/heads',
  '/compute/api/network',
  '/compute/api/readyz',
  '/compute/api/healthz',
  '/compute/api/v1/network',
  '/compute/api/pricing',
  '/compute/api/models',
  '/compute/api/jobs',
  '/compute/api/jobs/{id}',
  '/heads/checkpoint',
  '/keys.json',
  '/compute/api/v1/responses',
  '/compute/api/receipts',
];
for (const p of REQUIRED_PATHS) {
  assert.ok(spec.paths[p], `spec documents ${p}`);
}

// Every documented GET path has a real route in source (literal or alias mapping).
const ROUTE_EVIDENCE = {
  '/compute/api/guest-keys': [network, "startsWith('/compute/api/guest-keys')"],
  '/compute/api/v1/models': [network, "'/compute/api/v1/models'"],
  '/compute/api/v1/chat/completions': [network, "'/compute/api/v1/chat/completions'"],
  '/compute/api/kit-sig': [network, "'/compute/api/kit-sig'"],
  '/compute/api/verify': [network, "'/compute/api/verify'"],
  '/compute/api/chain': [network, "'/compute/api/chain'"],
  '/heads': [network, "'/heads'"],
  '/compute/api/network': [network, "'/compute/api/network'"],
  '/compute/api/readyz': [network, "readyz"],
  '/compute/api/healthz': [network, "'/compute/api/healthz'"],
  '/compute/api/v1/network': [network, "'/compute/api/v1/network'"],
  '/compute/api/pricing': [network, "path === '/compute/api/pricing'"],
  '/compute/api/models': [network, "path === '/compute/api/models'"],
  '/compute/api/jobs': [network, "'/compute/api/jobs'"],
  '/compute/api/jobs/{id}': [network, '/^\\/compute\\/api\\/jobs\\/([A-Za-z0-9_-]{6,64})\\/?$/'],
  '/heads/checkpoint': [worker, '/heads/checkpoint'],
  '/keys.json': [worker, '/keys.json'],
  '/compute/api/v1/responses': [network, "'/compute/api/v1/responses'"],
  '/compute/api/receipts': [network, "'/compute/api/receipts'"],
};
// Kit manifest parity: the signed-manifest const in the network module must name
// the same tar sha256 as the published kit.json const in the lobby worker.
const kitNet = /COMPUTE_KIT_MANIFEST = \{[\s\S]*?sha256: '([0-9a-f]{64})'/.exec(network);
const kitWorker = /COMPUTE_KIT_JSON = \{[\s\S]*?sha256: '([0-9a-f]{64})'/.exec(worker);
assert.ok(kitNet && kitWorker, 'kit manifest consts present');
assert.equal(kitNet[1], kitWorker[1], 'kit manifest sha256 parity');

for (const [p, [src, needle]] of Object.entries(ROUTE_EVIDENCE)) {
  assert.ok(src.includes(needle), `route exists for documented ${p} (${needle})`);
}

// Fix-queue invariants: idempotency, guest job status, any-origin preflight, rate headers.
assert.ok(network.includes("'Idempotency-Key'") && network.includes('compute:idem:'), 'idempotent chat submission implemented');
assert.ok(network.includes('jobApiKey') && network.includes('jobReader'), 'guest-visible job status implemented');
assert.ok(network.includes('guestRateInfo') && network.includes("'Retry-After'"), '429 rate headers implemented');
const preflightBlocks = worker.split("'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dasha-Route, Idempotency-Key'").length - 1;
assert.equal(preflightBlocks, 2, 'both edge functions answer compute preflights from any origin');
assert.ok(worker.includes("if (request.method === 'OPTIONS' && isComputeApiPath(url.pathname))"), 'second edge exempts compute preflight from the 403 gate');

// Opt-in live two-host probe.
if (process.env.DASHA_CONTRACT_LIVE === '1') {
  const HOSTS = ['https://lobby.getdasha.com', 'https://www.getdasha.com'];
  for (const host of HOSTS) {
    for (const p of Object.keys(spec.paths)) {
      if (!spec.paths[p].get) continue;
      const url = host + p.replace('{id}', 'job_nonexistent0');
      const res = await fetch(url, { redirect: 'manual' });
      assert.notEqual(res.status, 404, `${url} must not 404 (got ${res.status})`);
      assert.notEqual(res.status, 500, `${url} must not 500 (got ${res.status})`);
    }
    const pricing = await fetch(host + '/compute/api/pricing');
    assert.equal(pricing.status, 200, `${host} pricing 200`);
    const preflight = await fetch(host + '/compute/api/v1/chat/completions', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, authorization' },
    });
    assert.equal(preflight.status, 204, `${host} chat preflight 204`);
    assert.ok(preflight.headers.get('access-control-allow-origin'), `${host} preflight carries ACAO`);
    const liveSpec = await (await fetch(host + '/compute/openapi.json')).json();
    for (const p of REQUIRED_PATHS) assert.ok(liveSpec.paths[p], `${host} live spec documents ${p}`);
  }
  console.log('live contract: both hosts pass');
}

console.log('openapi contract: ok');
