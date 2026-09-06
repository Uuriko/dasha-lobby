#!/usr/bin/env node
/** GET+HEAD /compute/api/jobs/:id and /:id/; login gate; empty HEAD; slash parity. */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = { LOBBY_SESSION_SECRET: 'jobs-id-slash-head-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const session = await createSessionToken(env, { xId: 'jobs-id-owner', handle: 'jobs_id' });
const cookie = { Cookie: `${COOKIE}=${session}` };
const fake = 'job_xxxxx';

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

for (const path of [`/compute/api/jobs/${fake}`, `/compute/api/jobs/${fake}/`]) {
  const unauth = await pair('lobby.getdasha.com', path, {}, (req) => network.fetch(req));
  assert.equal(unauth.status, 401, `${path} unauth`);
  assert.notEqual(unauth.status, 404, `${path} must not 404`);
  assert.deepEqual(unauth.body, { error: 'login required' });
  const head = await network.fetch(new Request(`https://lobby.getdasha.com${path}`, { method: 'HEAD' }));
  assert.equal(head.status, 401, `${path} HEAD unauth`);
  assert.notEqual(head.status, 404, `${path} HEAD must not 404`);
  assert.match(head.headers.get('content-type') || '', /application\/json/);
  assert.equal(await head.text(), '');
}

const missing = await pair('lobby.getdasha.com', `/compute/api/jobs/${fake}`, { headers: cookie }, (req) => network.fetch(req));
assert.equal(missing.status, 404);
assert.deepEqual(missing.body, { error: 'job not found' });
const missingHead = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${fake}/`, { method: 'HEAD', headers: cookie }));
assert.equal(missingHead.status, 404);
assert.equal(await missingHead.text(), '');

const now = Date.now();
await storage.put(`compute:job:${fake}`, {
  id: fake, owner: 'x:jobs-id-owner', status: 'queued', model: 'qwen3-8b',
  createdAt: now, expiresAt: now + 5 * 60_000,
});

const shown = await pair('lobby.getdasha.com', `/compute/api/jobs/${fake}`, { headers: cookie }, (req) => network.fetch(req));
assert.equal(shown.status, 200);
assert.equal(shown.body.id, fake);
assert.equal(shown.body.status, 'queued');
assert.equal(shown.body.model, 'qwen3-8b');
assert.equal(shown.body.queue_position, 1);
const shownHead = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${fake}/`, { method: 'HEAD', headers: cookie }));
assert.equal(shownHead.status, 200);
assert.match(shownHead.headers.get('content-type') || '', /application\/json/);
assert.equal(await shownHead.text(), '');

const short = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs/job_x'));
assert.equal(short.status, 404);
assert.deepEqual(await short.json(), { error: 'not found' });

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wUnauth = await pair(host, `/compute/api/jobs/${fake}`, {}, (request) => worker.fetch(request, workerEnv));
  assert.equal(wUnauth.status, 401, `${host} unauth`);
  assert.notEqual(wUnauth.status, 404);
  assert.deepEqual(wUnauth.body, { error: 'login required' });
  const wHead = await worker.fetch(new Request(`https://${host}/compute/api/jobs/${fake}/`, { method: 'HEAD' }), workerEnv);
  assert.equal(wHead.status, 401, `${host} HEAD slash`);
  assert.notEqual(wHead.status, 404);
  assert.match(wHead.headers.get('content-type') || '', /application\/json/);
  assert.equal(await wHead.text(), '');
  const wBareHead = await worker.fetch(new Request(`https://${host}/compute/api/jobs/${fake}`, { method: 'HEAD' }), workerEnv);
  assert.equal(wBareHead.status, 401, `${host} HEAD bare`);
  assert.equal(await wBareHead.text(), '');

  const wAuth = await pair(host, `/compute/api/jobs/${fake}`, { headers: cookie }, (request) => worker.fetch(request, workerEnv));
  assert.equal(wAuth.status, 200, `${host} authed`);
  assert.equal(wAuth.body.id, fake);
  const wAuthHead = await worker.fetch(new Request(`https://${host}/compute/api/jobs/${fake}/`, { method: 'HEAD', headers: cookie }), workerEnv);
  assert.equal(wAuthHead.status, 200, `${host} HEAD authed slash`);
  assert.equal(await wAuthHead.text(), '');

  const list = await worker.fetch(new Request(`https://${host}/compute/api/jobs/`, { headers: cookie }), workerEnv);
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).jobs.map(j => j.id), [fake]);

  const net = await pair(host, '/compute/api/network', {}, (request) => worker.fetch(request, workerEnv));
  assert.equal(net.status, 200);
  assert.equal(net.body.providers_online, 0);

  const foo = await worker.fetch(new Request(`https://${host}/compute/api/foo`), workerEnv);
  assert.equal(foo.status, 404);
  assert.deepEqual(await foo.json(), { error: 'not found' });
}

const streamId = 'job_stream';
await storage.put(`compute:job:${streamId}`, {
  id: streamId, owner: 'x:jobs-id-owner', status: 'leased', model: 'gemma3-27b',
  stream: true, chunks: ['Hel', 'lo'], createdAt: now, expiresAt: now + 5 * 60_000, providerId: 'p1',
});
const streaming = await pair('lobby.getdasha.com', `/compute/api/jobs/${streamId}`, { headers: cookie }, (req) => network.fetch(req));
assert.equal(streaming.status, 200);
assert.equal(streaming.body.status, 'leased');
assert.equal(streaming.body.answer, 'Hello', 'stream job GET must join chunks before complete');
assert.equal(streaming.body.model, 'gemma3-27b');
assert.equal('usage' in streaming.body, false, 'no usage when absent');
assert.equal('route' in streaming.body, false, 'no route when absent');

const honestId = 'job_honest';
await storage.put(`compute:job:${honestId}`, {
  id: honestId, owner: 'x:jobs-id-owner', status: 'complete', model: 'qwen3-8b',
  route: 'community', answer: 'done',
  usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const honest = await pair('lobby.getdasha.com', `/compute/api/jobs/${honestId}`, { headers: cookie }, (req) => network.fetch(req));
assert.equal(honest.status, 200);
assert.equal(honest.body.route, 'community');
assert.deepEqual(honest.body.usage, { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 });

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-jobs-id-slash-head: PASS');
