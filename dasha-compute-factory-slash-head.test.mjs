#!/usr/bin/env node
/** GET+HEAD /compute/api/factory (+slash) www+lobby; honest zeros + providers_online_latest. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'factory-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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

function stripGenerated(body) {
  if (!body || typeof body !== 'object') return body;
  const { generated_at, ...rest } = body;
  return rest;
}

async function pair(host, path, init = {}, fetchImpl = network.fetch.bind(network)) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type parity`);
  const aBody = aText ? JSON.parse(aText) : null;
  const bBody = bText ? JSON.parse(bText) : null;
  assert.deepEqual(stripGenerated(aBody), stripGenerated(bBody), `${host} ${path} body parity`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, body: aBody, headers: a.headers };
}

function assertFactoryShape(body, label) {
  assert.equal(body.schema, 'factory.compute.v0', label);
  assert.ok(body.generated_at, `${label} generated_at`);
  assert.deepEqual(body.jobs, { hosted: 0, community: 0, mixture: 0, failed: 0 }, `${label} honest zero jobs`);
  assert.deepEqual(body.models, {}, `${label} models`);
  assert.equal(typeof body.providers_online_latest, 'number', `${label} providers_online_latest`);
  assert.match(body.note || '', /counters only/i);
  assert.doesNotMatch(JSON.stringify(body), /"prompt"|"messages"/);
}

for (const path of ['/compute/api/factory', '/compute/api/factory/']) {
  const get = await pair('lobby.getdasha.com', path);
  assert.equal(get.status, 200, `${path} GET`);
  assertFactoryShape(get.body, path);
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
  assert.equal(head.status, 200, `${path} HEAD`);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

await storage.put('compute:provider:mac_live', {
  id: 'mac_live',
  owner: 'x:fac',
  name: 'Live Mac',
  models: ['gemma3-12b'],
  lastSeenAt: Date.now(),
});
const live = await pair('lobby.getdasha.com', '/compute/api/factory');
assert.equal(live.body.providers_online_latest, 1);
assert.deepEqual(live.body.jobs, { hosted: 0, community: 0, mixture: 0, failed: 0 }, 'must not invent job counts');

await network.recordFactoryOutcome({ engine: 'community', model: 'gemma3-12b', failed: false });
await network.recordFactoryOutcome({ engine: 'mixture', model: 'qwen3-8b', failed: false });
await network.recordFactoryOutcome({ engine: 'hosted', model: 'gpt-oss-20b', failed: false });
await network.recordFactoryOutcome({ engine: 'community', model: 'gemma3-12b', failed: true });
const bumped = await pair('lobby.getdasha.com', '/compute/api/factory/');
assert.deepEqual(bumped.body.jobs, { hosted: 1, community: 1, mixture: 1, failed: 1 });
assert.equal(bumped.body.models['gemma3-12b'], 2);
assert.equal(bumped.body.models['qwen3-8b'], 1);
assert.equal(bumped.body.models['gpt-oss-20b'], 1);

rows.delete('compute:provider:mac_live');
rows.delete('compute:factory:v0');

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
async function workerPair(host, path, init = {}) {
  return pair(host, path, init, (request) => worker.fetch(request, workerEnv));
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wGet = await workerPair(host, '/compute/api/factory');
  assert.equal(wGet.status, 200, `${host} factory GET`);
  assertFactoryShape(wGet.body, host);
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/factory/`, { method: 'HEAD' }), workerEnv);
  assert.equal(wHead.status, 200, `${host} factory/ HEAD`);
  assert.equal(await wHead.text(), '');

  const catalog = await workerPair(host, '/factory.json');
  assert.equal(catalog.status, 200, `${host} /factory.json`);
  assert.equal(catalog.body.schema, 'factory.catalog.v0');
  assert.ok(catalog.body.factories.some(f => f.id === 'compute' && /\/compute\/api\/factory/.test(f.url)));
  assert.ok(catalog.body.factories.some(f => f.id === 'demigod' && /demigod\.v0\.json/.test(f.url)));
  const catalogHead = await worker.fetch(new Request(`https://${host}/factory.json`, { method: 'HEAD' }), workerEnv);
  assert.equal(catalogHead.status, 200);
  assert.equal(await catalogHead.text(), '');
}

const privacy = await worker.fetch(new Request('https://www.getdasha.com/privacy'), workerEnv);
assert.equal(privacy.status, 200);
assert.doesNotMatch(await privacy.text(), /plugin\.jup\.ag/);

console.log('dasha-compute-factory-slash-head: PASS');
