#!/usr/bin/env node
/** GET+HEAD /compute/api/status and /status/; live:true; empty HEAD. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'status-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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

for (const path of ['/compute/api/status', '/compute/api/status/']) {
  const get = await pair('lobby.getdasha.com', path);
  assert.equal(get.status, 200, `${path} GET`);
  assert.equal(get.body.live, true);
  assert.equal(get.body.model, 'gpt-oss-20b');
  assert.equal(get.body.login_required, true);
  assert.equal(get.body.limit, '3 free / 10 min · then credits');
  assert.match(get.body.billing?.chat_completions || '', /Prepaid credits.*key spend cap is runaway protection/);
  assert.match(get.body.billing?.keys || '', /Create-time spend cap default \$5\/month/);
  assert.match(get.body.billing?.keys || '', /402 on exceed/);
  assert.match(get.body.billing?.keys || '', /\/caps/);
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
  const wGet = await workerPair(host, '/compute/api/status');
  assert.equal(wGet.status, 200, `${host} /compute/api/status GET`);
  assert.equal(wGet.body.live, true);
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/status/`, { method: 'HEAD' }), workerEnv);
  assert.equal(wHead.status, 200, `${host} /compute/api/status/ HEAD`);
  assert.match(wHead.headers.get('content-type') || '', /application\/json/);
  assert.equal(await wHead.text(), '');

  const net = await workerPair(host, '/compute/api/network');
  assert.equal(net.status, 200);
  assert.equal(net.body.providers_online, 0);
  assert.deepEqual(net.body.models_available, []);
  assert.equal(net.body.jobs_queued, 0);

  const jobs = await worker.fetch(new Request(`https://${host}/compute/api/jobs`), workerEnv);
  assert.equal(jobs.status, 401);
  assert.deepEqual(await jobs.json(), { error: 'login required' });
  const models = await worker.fetch(new Request(`https://${host}/compute/api/v1/models/`), workerEnv);
  assert.equal(models.status, 401);
  assert.deepEqual(await models.json(), { error: { message: 'invalid API key', type: 'authentication_error', code: null } });
  const chat = await worker.fetch(new Request(`https://${host}/compute/api/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), workerEnv);
  assert.equal(chat.status, 401);
  assert.equal((await chat.json()).error.message, 'invalid API key');
  const foo = await worker.fetch(new Request(`https://${host}/compute/api/foo`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

for (const path of ['/compute/api', '/compute/api/']) {
  const root = await network.fetch(new Request(`https://lobby.getdasha.com${path}`));
  assert.equal(root.status, 200, `${path} GET`);
  const body = await root.json();
  assert.match(body.billing?.keys || '', /Create-time spend cap default \$5\/month/);
  assert.match(body.billing?.chat_completions || '', /runaway protection/);
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-status-slash-head: PASS');
