#!/usr/bin/env node
/** GET+HEAD /compute/api/providers/{verify,poll} and trailing slash → 405; empty HEAD; POST bare+slash still 401 invalid token. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'providers-verify-poll-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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

for (const route of ['verify', 'poll']) {
  for (const path of [`/compute/api/providers/${route}`, `/compute/api/providers/${route}/`]) {
    const get = await pair('lobby.getdasha.com', path, {}, (req) => network.fetch(req));
    assert.equal(get.status, 405, `${path} GET`);
    assert.notEqual(get.status, 404, `${path} must not 404`);
    assert.deepEqual(get.body, { error: 'method not allowed' });
    const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
    assert.equal(head.status, 405, `${path} HEAD`);
    assert.notEqual(head.status, 404, `${path} HEAD must not 404`);
    assert.match(head.headers.get('content-type') || '', /application\/json/);
    assert.equal(await head.text(), '');
  }

  for (const path of [`/compute/api/providers/${route}`, `/compute/api/providers/${route}/`]) {
    const post = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    assert.equal(post.status, 401, `${path} POST unauth`);
    assert.deepEqual(await post.json(), { error: 'invalid provider token' });
  }
}

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
  for (const route of ['verify', 'poll']) {
    const wGet = await pair(host, `/compute/api/providers/${route}`, {}, (request) => worker.fetch(request, workerEnv));
    assert.equal(wGet.status, 405, `${host} ${route} GET`);
    assert.notEqual(wGet.status, 404);
    assert.deepEqual(wGet.body, { error: 'method not allowed' });
    const wHead = await worker.fetch(new Request(`https://${host}/compute/api/providers/${route}/`, { method: 'HEAD' }), workerEnv);
    assert.equal(wHead.status, 405, `${host} ${route}/ HEAD`);
    assert.notEqual(wHead.status, 404);
    assert.match(wHead.headers.get('content-type') || '', /application\/json/);
    assert.equal(await wHead.text(), '');
    const wBareHead = await worker.fetch(new Request(`https://${host}/compute/api/providers/${route}`, { method: 'HEAD' }), workerEnv);
    assert.equal(wBareHead.status, 405, `${host} ${route} HEAD`);
    assert.equal(await wBareHead.text(), '');

    const wPost = await worker.fetch(new Request(`https://${host}/compute/api/providers/${route}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }), workerEnv);
    assert.equal(wPost.status, 401, `${host} ${route}/ POST`);
    assert.deepEqual(await wPost.json(), { error: 'invalid provider token' });
  }

  const foo = await worker.fetch(new Request(`https://${host}/compute/api/providers/verifyx`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

console.log('dasha-compute-providers-verify-poll-slash-head: PASS');
