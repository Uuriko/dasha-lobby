#!/usr/bin/env node
/** GET+HEAD+POST /compute/api/night and /night/; origin/auth gates; empty HEAD. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = { LOBBY_SESSION_SECRET: 'night-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: 'night-owner', handle: 'night_owner' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin };
const cookieOnly = { Cookie: `${COOKIE}=${session}` };

async function pair(host, path, init = {}, fetchImpl = (req) => network.fetch(req, init._origin), fetchEnv) {
  const { _origin, ...reqInit } = init;
  const a = await fetchImpl(new Request(`https://${host}${path}`, reqInit), fetchEnv);
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, reqInit), fetchEnv);
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, type: a.headers.get('content-type'), body: aText ? JSON.parse(aText) : null, headers: a.headers };
}

for (const path of ['/compute/api/night', '/compute/api/night/']) {
  const noOrigin = await pair('lobby.getdasha.com', path, {}, (req) => network.fetch(req, null));
  assert.equal(noOrigin.status, 403, `${path} no origin`);
  assert.deepEqual(noOrigin.body, { error: 'origin required' });
  const headNoOrigin = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }), null);
  assert.equal(headNoOrigin.status, 403, `${path} HEAD no origin`);
  assert.match(headNoOrigin.headers.get('content-type') || '', /application\/json/);
  assert.equal(await headNoOrigin.text(), '');

  const unauth = await pair('lobby.getdasha.com', path, { headers: { Origin: origin }, _origin: origin }, (req) => network.fetch(req, origin));
  assert.equal(unauth.status, 401, `${path} unauth`);
  assert.deepEqual(unauth.body, { error: 'login required' });
  const headUnauth = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD', headers: { Origin: origin } }), origin);
  assert.equal(headUnauth.status, 401, `${path} HEAD unauth`);
  assert.equal(await headUnauth.text(), '');
}

const empty = await pair('lobby.getdasha.com', '/compute/api/night', { headers: cookie, _origin: origin }, (req) => network.fetch(req, origin));
assert.equal(empty.status, 200);
assert.deepEqual(empty.body, { tasks: [] });
const emptyHead = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/night/', { method: 'HEAD', headers: cookie }), origin);
assert.equal(emptyHead.status, 200);
assert.match(emptyHead.headers.get('content-type') || '', /application\/json/);
assert.equal(await emptyHead.text(), '');

const now = Date.now();
await storage.put('compute:night:night_mine_aaaaaa', {
  id: 'night_mine_aaaaaa', owner: 'x:night-owner', title: 'Mine', prompt: 'p', model: 'qwen3-8b',
  template: 'custom', repeat: 'none', status: 'scheduled', createdAt: now + 10, artifacts: [],
});
await storage.put('compute:night:night_other_bbbbbb', {
  id: 'night_other_bbbbbb', owner: 'x:other', title: 'Other', prompt: 'p', model: 'qwen3-8b',
  template: 'custom', repeat: 'none', status: 'scheduled', createdAt: now + 20, artifacts: [],
});
const listed = await pair('lobby.getdasha.com', '/compute/api/night', { headers: cookie, _origin: origin }, (req) => network.fetch(req, origin));
assert.equal(listed.status, 200);
assert.deepEqual(listed.body.tasks.map(t => t.id), ['night_mine_aaaaaa']);
const listedHead = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/night', { method: 'HEAD', headers: cookie }), origin);
assert.equal(listedHead.status, 200);
assert.equal(await listedHead.text(), '');

const postSlash = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/night/', {
  method: 'POST',
  headers: { ...cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Morning', prompt: 'Research.', template: 'research', model: 'qwen3-8b', repeat: 'none' }),
}), origin);
assert.equal(postSlash.status, 201, 'Night schedules with 0 Macs');
const postBody = await postSlash.json();
assert.equal(postBody.task.status, 'scheduled');
assert.equal(postBody.task.title, 'Morning');
assert.match(postBody.task.id, /^night_/);
assert.ok([...rows.keys()].some(k => k.startsWith('compute:night:') && k !== 'compute:night:night_mine_aaaaaa' && k !== 'compute:night:night_other_bbbbbb'));
// Drop the just-created task so later list asserts stay on the seeded fixture.
await storage.delete(`compute:night:${postBody.task.id}`);

const lobby = {
  idFromName: () => 'public',
  get: () => ({
    fetch: (request) => {
      const o = request.headers.get('Origin');
      const allowed = o === origin ? origin : null;
      return network.fetch(request, allowed);
    },
  }),
};
const workerEnv = { ...env, ALLOWED_ORIGINS: origin, LOBBY: lobby };
async function workerPair(host, path, init = {}) {
  return pair(host, path, init, (request) => worker.fetch(request, workerEnv));
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wNoOrigin = await workerPair(host, '/compute/api/night');
  assert.equal(wNoOrigin.status, 403, `${host} night no origin`);
  assert.deepEqual(wNoOrigin.body, { error: 'origin required' });
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/night/`, { method: 'HEAD' }), workerEnv);
  assert.equal(wHead.status, 403, `${host} night/ HEAD`);
  assert.match(wHead.headers.get('content-type') || '', /application\/json/);
  assert.equal(await wHead.text(), '');

  const wBareHead = await worker.fetch(new Request(`https://${host}/compute/api/night`, { method: 'HEAD' }), workerEnv);
  assert.equal(wBareHead.status, 403, `${host} night HEAD`);
  assert.equal(await wBareHead.text(), '');

  const wAuth = await workerPair(host, '/compute/api/night', { headers: cookie });
  assert.equal(wAuth.status, 200, `${host} night authed`);
  assert.deepEqual(wAuth.body.tasks.map(t => t.id), ['night_mine_aaaaaa']);
  const wAuthHead = await worker.fetch(new Request(`https://${host}/compute/api/night/`, { method: 'HEAD', headers: cookie }), workerEnv);
  assert.equal(wAuthHead.status, 200, `${host} night/ HEAD authed`);
  assert.equal(await wAuthHead.text(), '');

  const net = await workerPair(host, '/compute/api/network');
  assert.equal(net.status, 200);
  assert.equal(net.body.providers_online, 0);
  assert.deepEqual(net.body.models_available, []);
  assert.equal(net.body.jobs_queued, 0);

  const jobs = await worker.fetch(new Request(`https://${host}/compute/api/jobs/`), workerEnv);
  assert.equal(jobs.status, 401);
  assert.deepEqual(await jobs.json(), { error: 'login required' });
  const foo = await worker.fetch(new Request(`https://${host}/compute/api/foo`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-night-slash-head: PASS');
