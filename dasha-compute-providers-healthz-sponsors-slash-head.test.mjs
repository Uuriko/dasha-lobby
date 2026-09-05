#!/usr/bin/env node
/** GET+HEAD /compute/api/providers 401, /healthz 200, /sponsors 200; trailing slash; empty HEAD. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = { LOBBY_SESSION_SECRET: 'providers-healthz-sponsors-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const session = await createSessionToken(env, { xId: 'slash-owner', handle: 'slash_owner' });
const cookie = { Cookie: `${COOKIE}=${session}` };

async function pair(host, path, init = {}, fetchImpl = network.fetch.bind(network), fetchEnv) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init), fetchEnv);
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init), fetchEnv);
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, type: a.headers.get('content-type'), body: aText ? JSON.parse(aText) : null, headers: a.headers };
}

for (const path of ['/compute/api/providers', '/compute/api/providers/']) {
  const unauth = await pair('lobby.getdasha.com', path);
  assert.equal(unauth.status, 401, `${path} unauth`);
  assert.deepEqual(unauth.body, { error: 'login required' });
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
  assert.equal(head.status, 401, `${path} HEAD`);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

const empty = await pair('lobby.getdasha.com', '/compute/api/providers', { headers: cookie });
assert.equal(empty.status, 200);
assert.deepEqual(empty.body, { providers: [] });
const emptyHead = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/', { method: 'HEAD', headers: cookie }));
assert.equal(emptyHead.status, 200);
assert.equal(await emptyHead.text(), '');

for (const path of ['/compute/api/healthz', '/compute/api/healthz/']) {
  const get = await pair('lobby.getdasha.com', path);
  assert.equal(get.status, 200, `${path} GET`);
  assert.equal(get.body.ok, true);
  assert.equal(get.body.service, 'dasha-compute');
  assert.equal(get.body.version, '0.3.0');
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
  assert.equal(head.status, 200, `${path} HEAD`);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

for (const path of ['/compute/api/sponsors', '/compute/api/sponsors/']) {
  const get = await pair('lobby.getdasha.com', path);
  assert.equal(get.status, 200, `${path} GET`);
  assert.equal(get.body.raised_usd, 0);
  assert.equal(get.body.goal_usd, 17292);
  assert.equal(get.body.machines.length, 8);
  assert.equal(get.body.credit.length, 0);
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
  assert.equal(head.status, 200, `${path} HEAD`);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
async function workerPair(host, path, init = {}) {
  return pair(host, path, init, (request) => worker.fetch(request, workerEnv));
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const providers = await workerPair(host, '/compute/api/providers');
  assert.equal(providers.status, 401, `${host} /providers GET`);
  assert.deepEqual(providers.body, { error: 'login required' });
  const providersHead = await worker.fetch(new Request(`https://${host}/compute/api/providers/`, { method: 'HEAD' }), workerEnv);
  assert.equal(providersHead.status, 401, `${host} /providers/ HEAD`);
  assert.match(providersHead.headers.get('content-type') || '', /application\/json/);
  assert.equal(await providersHead.text(), '');

  const health = await workerPair(host, '/compute/api/healthz');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  const healthHead = await worker.fetch(new Request(`https://${host}/compute/api/healthz/`, { method: 'HEAD' }), workerEnv);
  assert.equal(healthHead.status, 200);
  assert.equal(await healthHead.text(), '');

  const sponsors = await workerPair(host, '/compute/api/sponsors');
  assert.equal(sponsors.status, 200);
  assert.equal(sponsors.body.raised_usd, 0);
  const sponsorsHead = await worker.fetch(new Request(`https://${host}/compute/api/sponsors/`, { method: 'HEAD' }), workerEnv);
  assert.equal(sponsorsHead.status, 200);
  assert.equal(await sponsorsHead.text(), '');

  const status = await workerPair(host, '/compute/api/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.live, true);
  const statusHead = await worker.fetch(new Request(`https://${host}/compute/api/status/`, { method: 'HEAD' }), workerEnv);
  assert.equal(statusHead.status, 200);
  assert.equal(await statusHead.text(), '');

  const net = await workerPair(host, '/compute/api/network');
  assert.equal(net.status, 200);
  assert.equal(net.body.providers_online, 0);
  assert.deepEqual(net.body.models_available, []);
  assert.equal(net.body.jobs_queued, 0);
  const netHead = await worker.fetch(new Request(`https://${host}/compute/api/v1/network/`, { method: 'HEAD' }), workerEnv);
  assert.equal(netHead.status, 200);
  assert.equal(await netHead.text(), '');

  const jobs = await worker.fetch(new Request(`https://${host}/compute/api/jobs/`), workerEnv);
  assert.equal(jobs.status, 401);
  assert.deepEqual(await jobs.json(), { error: 'login required' });
  const models = await worker.fetch(new Request(`https://${host}/compute/api/v1/models/`), workerEnv);
  assert.equal(models.status, 401);
  assert.deepEqual(await models.json(), { error: { message: 'invalid API key', type: 'authentication_error', code: null } });
  const chat = await worker.fetch(new Request(`https://${host}/compute/api/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), workerEnv);
  assert.equal(chat.status, 401);
  assert.equal((await chat.json()).error.message, 'invalid API key');
  const completions = await worker.fetch(new Request(`https://${host}/compute/api/v1/chat/completions/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), workerEnv);
  assert.equal(completions.status, 401);
  assert.equal((await completions.json()).error.message, 'invalid API key');
  const foo = await worker.fetch(new Request(`https://${host}/compute/api/foo`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-providers-healthz-sponsors-slash-head: PASS');
