#!/usr/bin/env node
/** GET+HEAD+POST /compute/api/keys and /keys/; origin/auth gates; empty HEAD; slash parity. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = { LOBBY_SESSION_SECRET: 'keys-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const session = await createSessionToken(env, { xId: 'keys-owner', handle: 'keys_owner' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin };

async function pair(host, path, init = {}, fetchImpl) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, type: a.headers.get('content-type'), body: aText ? JSON.parse(aText) : null, headers: a.headers };
}

for (const path of ['/compute/api/keys', '/compute/api/keys/']) {
  const noOrigin = await pair('lobby.getdasha.com', path, {}, (req) => network.fetch(req, null));
  assert.equal(noOrigin.status, 403, `${path} no origin`);
  assert.deepEqual(noOrigin.body, { error: 'origin required' });
  const headNoOrigin = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }), null);
  assert.equal(headNoOrigin.status, 403, `${path} HEAD no origin`);
  assert.match(headNoOrigin.headers.get('content-type') || '', /application\/json/);
  assert.equal(await headNoOrigin.text(), '');

  const unauth = await pair('lobby.getdasha.com', path, { headers: { Origin: origin } }, (req) => network.fetch(req, origin));
  assert.equal(unauth.status, 401, `${path} unauth`);
  assert.deepEqual(unauth.body, { error: 'login required' });
  const headUnauth = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD', headers: { Origin: origin } }), origin);
  assert.equal(headUnauth.status, 401, `${path} HEAD unauth`);
  assert.equal(await headUnauth.text(), '');
}

const empty = await pair('lobby.getdasha.com', '/compute/api/keys', { headers: cookie }, (req) => network.fetch(req, origin));
assert.equal(empty.status, 200);
assert.deepEqual(empty.body, { keys: [] });
const emptyHead = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys/', { method: 'HEAD', headers: cookie }), origin);
assert.equal(emptyHead.status, 200);
assert.match(emptyHead.headers.get('content-type') || '', /application\/json/);
assert.equal(await emptyHead.text(), '');

const created = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys/', {
  method: 'POST', headers: { ...cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'SDK' }),
}), origin);
assert.equal(created.status, 201);
const createdBody = await created.json();
assert.match(createdBody.api_key || '', /^dsk_/);
assert.equal(createdBody.name, 'SDK');

const listed = await pair('lobby.getdasha.com', '/compute/api/keys', { headers: cookie }, (req) => network.fetch(req, origin));
assert.equal(listed.status, 200);
assert.equal(listed.body.keys.length, 1);
assert.equal(listed.body.keys[0].id, createdBody.id);
assert.equal(listed.body.keys[0].name, 'SDK');
assert.equal(listed.body.keys[0].limit_cents, 500);
assert.equal(listed.body.keys[0].limit_reset, 'monthly');
assert.equal(listed.body.keys[0].spend_cents, 0);
assert.equal(listed.body.keys[0].limit_remaining_cents, 500);
assert.ok(!('api_key' in listed.body.keys[0]) && !('tokenHash' in listed.body.keys[0]), 'list must not leak raw key');
assert.equal(createdBody.limit_cents, 500);
assert.equal(createdBody.limit_reset, 'monthly');

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request, origin) }),
};
const workerEnv = { ...env, LOBBY: lobby };

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wNoOrigin = await pair(host, '/compute/api/keys', {}, (request) => worker.fetch(request, workerEnv));
  // worker computeApi passes allowedOrigin; when Origin missing, www may still call with null
  assert.ok([403, 401].includes(wNoOrigin.status), `${host} keys status`);
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/keys/`, { method: 'HEAD' }), workerEnv);
  assert.ok([403, 401].includes(wHead.status), `${host} keys/ HEAD`);
  assert.match(wHead.headers.get('content-type') || '', /application\/json/);
  assert.equal(await wHead.text(), '');
  assert.notEqual(wHead.status, 404, `${host} keys/ HEAD must not 404`);

  const foo = await worker.fetch(new Request(`https://${host}/compute/api/keyz`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-keys-slash-head: PASS');
