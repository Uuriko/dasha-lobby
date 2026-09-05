#!/usr/bin/env node
/** GET+HEAD /compute/api/night/summary and /summary/; origin/auth gates; empty HEAD; slash parity. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = { LOBBY_SESSION_SECRET: 'night-summary-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const session = await createSessionToken(env, { xId: 'nsummary-owner', handle: 'nsummary' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin };

async function pair(host, path, init = {}, fetchImpl) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type parity`);
  const aBody = aText ? JSON.parse(aText) : null;
  const bBody = bText ? JSON.parse(bText) : null;
  const dropTick = (row) => {
    if (!row || typeof row !== 'object' || !('generated_at' in row)) return row;
    const { generated_at, ...rest } = row;
    return rest;
  };
  assert.deepEqual(dropTick(aBody), dropTick(bBody), `${host} ${path} body parity`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, type: a.headers.get('content-type'), body: aBody, headers: a.headers };
}

for (const path of ['/compute/api/night/summary', '/compute/api/night/summary/']) {
  const noOrigin = await pair('lobby.getdasha.com', path, {}, (req) => network.fetch(req, null));
  assert.equal(noOrigin.status, 403, `${path} no origin`);
  assert.notEqual(noOrigin.status, 404, `${path} must not 404`);
  assert.deepEqual(noOrigin.body, { error: 'origin required' });
  const headNoOrigin = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }), null);
  assert.equal(headNoOrigin.status, 403, `${path} HEAD no origin`);
  assert.notEqual(headNoOrigin.status, 404, `${path} HEAD must not 404`);
  assert.match(headNoOrigin.headers.get('content-type') || '', /application\/json/);
  assert.equal(await headNoOrigin.text(), '');

  const unauth = await pair('lobby.getdasha.com', path, { headers: { Origin: origin } }, (req) => network.fetch(req, origin));
  assert.equal(unauth.status, 401, `${path} unauth`);
  assert.deepEqual(unauth.body, { error: 'login required' });
  const headUnauth = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD', headers: { Origin: origin } }), origin);
  assert.equal(headUnauth.status, 401, `${path} HEAD unauth`);
  assert.equal(await headUnauth.text(), '');
}

const empty = await pair('lobby.getdasha.com', '/compute/api/night/summary', { headers: cookie }, (req) => network.fetch(req, origin));
assert.equal(empty.status, 200);
assert.ok(Number.isFinite(empty.body.generated_at));
assert.deepEqual(empty.body.artifacts, []);
const emptyHead = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/night/summary/', { method: 'HEAD', headers: cookie }), origin);
assert.equal(emptyHead.status, 200);
assert.match(emptyHead.headers.get('content-type') || '', /application\/json/);
assert.equal(await emptyHead.text(), '');

const now = Date.now();
await storage.put('compute:night:night_mine_aaaaaa', {
  id: 'night_mine_aaaaaa', owner: 'x:nsummary-owner', title: 'Mine', prompt: 'p', model: 'qwen3-8b',
  template: 'custom', repeat: 'none', status: 'complete', createdAt: now + 10,
  artifacts: [{ content: 'Mine report.', completed_at: now + 30 }],
});
await storage.put('compute:night:night_other_bbbbbb', {
  id: 'night_other_bbbbbb', owner: 'x:other', title: 'Other', prompt: 'p', model: 'qwen3-8b',
  template: 'custom', repeat: 'none', status: 'complete', createdAt: now + 20,
  artifacts: [{ content: 'Other report.', completed_at: now + 40 }],
});

const listed = await pair('lobby.getdasha.com', '/compute/api/night/summary', { headers: cookie }, (req) => network.fetch(req, origin));
assert.equal(listed.status, 200);
assert.equal(listed.body.artifacts.length, 1);
assert.equal(listed.body.artifacts[0].task_id, 'night_mine_aaaaaa');
assert.equal(listed.body.artifacts[0].title, 'Mine');
assert.equal(listed.body.artifacts[0].content, 'Mine report.');
const listedHead = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/night/summary', { method: 'HEAD', headers: cookie }), origin);
assert.equal(listedHead.status, 200);
assert.equal(await listedHead.text(), '');

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

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wNoOrigin = await pair(host, '/compute/api/night/summary', {}, (request) => worker.fetch(request, workerEnv));
  assert.equal(wNoOrigin.status, 403, `${host} summary no origin`);
  assert.notEqual(wNoOrigin.status, 404);
  assert.deepEqual(wNoOrigin.body, { error: 'origin required' });
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/night/summary/`, { method: 'HEAD' }), workerEnv);
  assert.equal(wHead.status, 403, `${host} summary/ HEAD`);
  assert.notEqual(wHead.status, 404);
  assert.match(wHead.headers.get('content-type') || '', /application\/json/);
  assert.equal(await wHead.text(), '');

  const wBareHead = await worker.fetch(new Request(`https://${host}/compute/api/night/summary`, { method: 'HEAD' }), workerEnv);
  assert.equal(wBareHead.status, 403, `${host} summary HEAD`);
  assert.equal(await wBareHead.text(), '');

  const wAuth = await pair(host, '/compute/api/night/summary', { headers: cookie }, (request) => worker.fetch(request, workerEnv));
  assert.equal(wAuth.status, 200, `${host} summary authed`);
  assert.equal(wAuth.body.artifacts.length, 1);
  assert.equal(wAuth.body.artifacts[0].task_id, 'night_mine_aaaaaa');
  const wAuthHead = await worker.fetch(new Request(`https://${host}/compute/api/night/summary/`, { method: 'HEAD', headers: cookie }), workerEnv);
  assert.equal(wAuthHead.status, 200, `${host} summary/ HEAD authed`);
  assert.equal(await wAuthHead.text(), '');

  const night = await worker.fetch(new Request(`https://${host}/compute/api/night`, { headers: cookie }), workerEnv);
  assert.equal(night.status, 200);
  assert.deepEqual((await night.json()).tasks.map(t => t.id), ['night_mine_aaaaaa']);

  const net = await pair(host, '/compute/api/network', {}, (request) => worker.fetch(request, workerEnv));
  assert.equal(net.status, 200);
  assert.equal(net.body.providers_online, 0);

  const foo = await worker.fetch(new Request(`https://${host}/compute/api/foo`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-night-summary-slash-head: PASS');
