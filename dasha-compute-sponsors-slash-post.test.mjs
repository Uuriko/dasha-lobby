#!/usr/bin/env node
/** POST /compute/api/sponsors and /sponsors/ same origin 403; GET/HEAD slash stay 200. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = { LOBBY_SESSION_SECRET: 'sponsors-slash-post-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const session = await createSessionToken(env, { xId: 'sponsor-slash', handle: 'sponsor_slash' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

async function pair(host, path, init = {}, fetchImpl, fetchEnv) {
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

for (const path of ['/compute/api/sponsors', '/compute/api/sponsors/']) {
  const get = await pair('lobby.getdasha.com', path, {}, (req) => network.fetch(req));
  assert.equal(get.status, 200, `${path} GET`);
  assert.equal(get.body.raised_usd, 0);
  assert.equal(get.body.goal_usd, 17292);
  assert.equal(get.body.machines.length, 8);
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
  assert.equal(head.status, 200, `${path} HEAD`);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

const noOrigin = await pair('lobby.getdasha.com', '/compute/api/sponsors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, (req, allowed) => network.fetch(req, allowed), null);
assert.equal(noOrigin.status, 403);
assert.notEqual(noOrigin.status, 404);
assert.deepEqual(noOrigin.body, { error: 'origin required' });

const unauth = await pair('lobby.getdasha.com', '/compute/api/sponsors', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }, (req) => network.fetch(req, origin));
assert.equal(unauth.status, 401);
assert.deepEqual(unauth.body, { error: 'login required' });

const namedBare = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors', {
  method: 'POST', headers: cookie, body: JSON.stringify({ machine: 'mbp-16', name: 'slash_one' }),
}), origin);
assert.equal(namedBare.status, 201);
assert.equal((await namedBare.json()).machines.find(m => m.id === 'mbp-16').status, 'named');

const namedSlash = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/', {
  method: 'POST', headers: cookie, body: JSON.stringify({ machine: 'air-13', name: 'slash_two' }),
}), origin);
assert.equal(namedSlash.status, 201);
assert.equal((await namedSlash.json()).machines.find(m => m.id === 'air-13').status, 'named');

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
  const wGet = await pair(host, '/compute/api/sponsors', {}, (request) => worker.fetch(request, workerEnv));
  assert.equal(wGet.status, 200, `${host} GET`);
  assert.equal(wGet.body.raised_usd, 0);
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/sponsors/`, { method: 'HEAD' }), workerEnv);
  assert.equal(wHead.status, 200, `${host} HEAD slash`);
  assert.equal(await wHead.text(), '');

  const wPost = await pair(host, '/compute/api/sponsors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, (request) => worker.fetch(request, workerEnv));
  assert.equal(wPost.status, 403, `${host} POST no origin`);
  assert.notEqual(wPost.status, 404);
  assert.deepEqual(wPost.body, { error: 'origin required' });

  const wPostOrigin = await pair(host, '/compute/api/sponsors/', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }, (request) => worker.fetch(request, workerEnv));
  assert.equal(wPostOrigin.status, 401, `${host} POST origin unauth`);
  assert.deepEqual(wPostOrigin.body, { error: 'login required' });

  const foo = await worker.fetch(new Request(`https://${host}/compute/api/foo`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-sponsors-slash-post: PASS');
