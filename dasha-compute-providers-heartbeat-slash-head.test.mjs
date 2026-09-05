#!/usr/bin/env node
/** GET+HEAD /compute/api/providers/heartbeat (and jobs/:id/heartbeat) + slash → 405; empty HEAD; POST bare+slash 401 invalid token. No lastSeenAt on named POST. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'providers-heartbeat-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const jobId = 'job_hb01';
const jobHb = `/compute/api/providers/jobs/${jobId}/heartbeat`;
const named = '/compute/api/providers/heartbeat';

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

for (const path of [named, `${named}/`, jobHb, `${jobHb}/`]) {
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

for (const path of [named, `${named}/`, jobHb, `${jobHb}/`]) {
  const post = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }));
  assert.equal(post.status, 401, `${path} POST unauth`);
  assert.deepEqual(await post.json(), { error: 'invalid provider token' });
}

const beforeSeen = Date.now();
await storage.put('compute:provider:mac_hbtest', {
  id: 'mac_hbtest', owner: 'x:hb', name: 'HB Mac', allowedModels: ['qwen3-8b'], models: ['qwen3-8b'],
  tokenHash: 'nope', createdAt: beforeSeen, lastSeenAt: 0,
});
const namedPost = await network.fetch(new Request(`https://lobby.getdasha.com${named}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dcp_notreal' },
  body: JSON.stringify({}),
}));
assert.equal(namedPost.status, 401);
const stored = await storage.get('compute:provider:mac_hbtest');
assert.equal(stored.lastSeenAt, 0, 'named heartbeat POST must not mark a Mac online');

const short = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/jobs/hb_x/heartbeat'));
assert.equal(short.status, 404);
assert.deepEqual(await short.json(), { error: 'not found' });

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
  for (const path of [named, jobHb]) {
    const wGet = await pair(host, path, {}, (request) => worker.fetch(request, workerEnv));
    assert.equal(wGet.status, 405, `${host} ${path} GET`);
    assert.notEqual(wGet.status, 404);
    assert.deepEqual(wGet.body, { error: 'method not allowed' });
    const wHead = await worker.fetch(new Request(`https://${host}${path}/`, { method: 'HEAD' }), workerEnv);
    assert.equal(wHead.status, 405, `${host} ${path}/ HEAD`);
    assert.notEqual(wHead.status, 404);
    assert.match(wHead.headers.get('content-type') || '', /application\/json/);
    assert.equal(await wHead.text(), '');
    const wBareHead = await worker.fetch(new Request(`https://${host}${path}`, { method: 'HEAD' }), workerEnv);
    assert.equal(wBareHead.status, 405, `${host} ${path} HEAD`);
    assert.equal(await wBareHead.text(), '');

    const wPost = await worker.fetch(new Request(`https://${host}${path}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }), workerEnv);
    assert.equal(wPost.status, 401, `${host} ${path}/ POST`);
    assert.deepEqual(await wPost.json(), { error: 'invalid provider token' });
  }

  const foo = await worker.fetch(new Request(`https://${host}/compute/api/providers/heartbeatx`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

console.log('dasha-compute-providers-heartbeat-slash-head: PASS');
