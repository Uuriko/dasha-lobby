#!/usr/bin/env node
/** GET+HEAD /compute/api/jobs and /jobs/ list owner jobs; no cookie 401; empty {jobs:[]}. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = { LOBBY_SESSION_SECRET: 'jobs-list-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const now = Date.now();
const session = await createSessionToken(env, { xId: 'jobs-owner', handle: 'jobs_owner' });
const otherSession = await createSessionToken(env, { xId: 'jobs-other', handle: 'jobs_other' });
const cookie = { Cookie: `${COOKIE}=${session}` };
const otherCookie = { Cookie: `${COOKIE}=${otherSession}` };

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

for (const path of ['/compute/api/jobs', '/compute/api/jobs/']) {
  const unauth = await pair('lobby.getdasha.com', path);
  assert.equal(unauth.status, 401, `${path} unauth`);
  assert.deepEqual(unauth.body, { error: 'login required' });
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
  assert.equal(head.status, 401);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

const empty = await pair('lobby.getdasha.com', '/compute/api/jobs', { headers: cookie });
assert.equal(empty.status, 200);
assert.deepEqual(empty.body, { jobs: [] });

const net = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/network'))).json();
assert.equal(net.providers_online, 0);
assert.deepEqual(net.models_available, []);
assert.equal(net.jobs_queued, 0);

await storage.put('compute:job:job_mine_new', {
  id: 'job_mine_new', owner: 'x:jobs-owner', status: 'queued', model: 'qwen3-8b',
  createdAt: now + 10, expiresAt: now + 5 * 60_000,
});
await storage.put('compute:job:job_mine_old', {
  id: 'job_mine_old', owner: 'x:jobs-owner', status: 'complete', model: 'gemma3-27b',
  createdAt: now, expiresAt: now + 5 * 60_000,
});
await storage.put('compute:job:job_other', {
  id: 'job_other', owner: 'x:jobs-other', status: 'queued', model: 'qwen3-8b',
  createdAt: now + 20, expiresAt: now + 5 * 60_000,
});
await storage.put('compute:job:job_cancelled', {
  id: 'job_cancelled', owner: 'x:jobs-owner', status: 'cancelled', model: 'qwen3-8b',
  createdAt: now + 30, expiresAt: now + 5 * 60_000,
});
await storage.put('compute:job:job_expired', {
  id: 'job_expired', owner: 'x:jobs-owner', status: 'queued', model: 'qwen3-8b',
  createdAt: now - 10, expiresAt: now - 1,
});

const listed = await pair('lobby.getdasha.com', '/compute/api/jobs', { headers: cookie });
assert.equal(listed.status, 200);
assert.deepEqual(listed.body.jobs.map(j => j.id), ['job_mine_new', 'job_mine_old']);
assert.deepEqual(listed.body.jobs[0], {
  id: 'job_mine_new',
  status: 'queued',
  model: 'qwen3-8b',
  expires_at: now + 5 * 60_000,
});
assert.equal(listed.body.jobs.some(j => j.id === 'job_other' || j.id === 'job_cancelled' || j.id === 'job_expired'), false);

const otherList = await pair('lobby.getdasha.com', '/compute/api/jobs', { headers: otherCookie });
assert.equal(otherList.status, 200);
assert.deepEqual(otherList.body.jobs.map(j => j.id), ['job_other']);

const authedHead = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', { method: 'HEAD', headers: cookie }));
assert.equal(authedHead.status, 200);
assert.match(authedHead.headers.get('content-type') || '', /application\/json/);
assert.equal(await authedHead.text(), '');

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
async function workerPair(host, path, init = {}) {
  return pair(host, path, init, (request) => worker.fetch(request, workerEnv));
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wUnauth = await workerPair(host, '/compute/api/jobs');
  assert.equal(wUnauth.status, 401, `${host} unauth`);
  assert.deepEqual(wUnauth.body, { error: 'login required' });
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/jobs/`, { method: 'HEAD' }), workerEnv);
  assert.equal(wHead.status, 401, `${host} HEAD slash`);
  assert.match(wHead.headers.get('content-type') || '', /application\/json/);
  assert.equal(await wHead.text(), '');
  const wList = await workerPair(host, '/compute/api/jobs', { headers: cookie });
  assert.equal(wList.status, 200, `${host} list`);
  assert.deepEqual(wList.body.jobs.map(j => j.id), ['job_mine_new', 'job_mine_old']);
  const wFoo = await worker.fetch(new Request(`https://${host}/compute/api/foo`), workerEnv);
  assert.equal(wFoo.status, 404);
  assert.deepEqual(await wFoo.json(), { error: 'not found' });
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-jobs-list: PASS');
