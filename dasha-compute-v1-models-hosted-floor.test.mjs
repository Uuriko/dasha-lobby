#!/usr/bin/env node
/**
 * Empty Community network still lists the Hosted Ask floor on GET /v1/models.
 * gpt-oss-20b is Hosted (owned_by dasha-hosted) — never a Community Mac.
 * gpt-6-astra / deepseek-flash stay out of the live list. No invented tok/s.
 * /network stays honest: providers_online:0 + models_available:[] when no Macs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker from './dasha-lobby-worker.mjs';
import {
  ComputeNetwork,
  HOSTED_FLOOR_MODEL_ID,
  HOSTED_FLOOR_OWNED_BY,
  v1HostedFloorListing,
  v1ModelsListData,
} from './dasha-compute-network.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /Hosted floor gpt-oss-20b always, plus advertised Community ids/);
assert.match(src, /Never Astra\/Flash SKUs/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);
assert.doesNotMatch(src, /potter[_-]?key|DASHA_POTTER|people-data/i);

const HOSTED = v1HostedFloorListing();
assert.equal(HOSTED.id, HOSTED_FLOOR_MODEL_ID);
assert.equal(HOSTED.owned_by, HOSTED_FLOOR_OWNED_BY);
assert.equal(HOSTED.owned_by, 'dasha-hosted');
assert.match(HOSTED.description, /Hosted/);
assert.doesNotMatch(HOSTED.owned_by, /community/i);
assert.equal(HOSTED.providers_online, 0);
assert.equal('measured_tok_per_sec' in HOSTED, false, 'Hosted floor does not invent tok/s');
assert.deepEqual(v1ModelsListData([]), [HOSTED]);

const env = { LOBBY_SESSION_SECRET: 'v1-models-hosted-floor-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const token = 'dsk_hostedfloorx.abcdefghijklmnopqrstuvwx';
const id = 'key_hostedfloorx';
await storage.put(`compute:api-key:${id}`, {
  id,
  owner: 'x:hostedfloor',
  name: 'Developer key',
  prefix: token.slice(0, 12),
  tokenHash: createHash('sha256').update(token).digest('hex'),
  createdAt: Date.now(),
  lastUsedAt: 0,
});
const auth = { Authorization: `Bearer ${token}` };

function assertHostedFloor(body, label) {
  assert.equal(body.object, 'list', `${label} list object`);
  assert.ok(Array.isArray(body.data), `${label} data array`);
  const hosted = body.data.find((row) => row.id === 'gpt-oss-20b');
  assert.ok(hosted, `${label} includes gpt-oss-20b`);
  assert.equal(hosted.object, 'model', `${label} OpenAI model object`);
  assert.equal(hosted.owned_by, 'dasha-hosted', `${label} owned_by Hosted`);
  assert.match(String(hosted.description || ''), /Hosted/, `${label} description says Hosted`);
  assert.doesNotMatch(JSON.stringify(hosted), /dasha-community/, `${label} never claims Community`);
  assert.equal(hosted.providers_online, 0, `${label} no invented Community providers_online`);
  assert.equal('measured_tok_per_sec' in hosted, false, `${label} no invented tok/s`);
  assert.equal(body.data.some((row) => row.id === 'gpt-6-astra'), false, `${label} no live Astra`);
  assert.equal(body.data.some((row) => row.id === 'deepseek-flash'), false, `${label} no live Flash`);
}

const empty = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models'));
assert.equal(empty.status, 200);
const emptyBody = await empty.json();
assert.deepEqual(emptyBody, { object: 'list', data: [HOSTED] });
assertHostedFloor(emptyBody, 'empty network unauth');

const emptyAuth = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models', { headers: auth }));
assert.equal(emptyAuth.status, 200);
assert.deepEqual(await emptyAuth.json(), { object: 'list', data: [HOSTED] });

const net = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/network'))).json();
assert.equal(net.providers_online, 0, 'network stays empty');
assert.deepEqual(net.models_available, [], 'network does not invent Community models');
assert.deepEqual(net.capacity, [], 'network does not invent capacity / tok/s');

const retrieveHosted = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models/gpt-oss-20b', { headers: auth }));
assert.equal(retrieveHosted.status, 200, 'retrieve Hosted floor when no Macs');
assert.deepEqual(await retrieveHosted.json(), HOSTED);

const retrieveMiss = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models/qwen3-8b', { headers: auth }));
assert.equal(retrieveMiss.status, 404, 'empty fleet retrieve does not invent a Mac');

await storage.put('compute:provider:mac_live', {
  id: 'mac_live',
  owner: 'x:hostedfloor',
  name: 'Live Mac',
  models: ['gemma3-12b', 'gpt-oss-20b'],
  lastSeenAt: Date.now(),
});
const live = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models'))).json();
assertHostedFloor(live, 'live community still lists Hosted floor');
assert.equal(live.data.filter((row) => row.id === 'gpt-oss-20b').length, 1, 'no duplicate gpt-oss-20b');
assert.deepEqual(live.data.find((row) => row.id === 'gemma3-12b'), {
  id: 'gemma3-12b',
  object: 'model',
  created: 0,
  owned_by: 'dasha-community',
  pricing: HOSTED.pricing,
  providers_online: 1,
});
assert.equal(live.data.some((row) => row.id === 'gemma3-12b' && row.owned_by === 'dasha-community'), true);

const liveNet = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/network'))).json();
assert.equal(liveNet.providers_online, 1);
assert.deepEqual(liveNet.models_available, ['gemma3-12b', 'gpt-oss-20b']);

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wList = await worker.fetch(new Request(`https://${host}/compute/api/v1/models`), workerEnv);
  assert.equal(wList.status, 200, `${host} worker list`);
  const wBody = await wList.json();
  assertHostedFloor(wBody, `${host} worker`);
  assert.equal(wBody.data.some((row) => row.id === 'gemma3-12b'), true, `${host} community still listed`);
}

assert.equal([...rows.keys()].some((k) => /email|phone|ssn/i.test(k)), false, 'no people-data keys');
console.log('dasha-compute-v1-models-hosted-floor: PASS (empty network still lists Hosted gpt-oss-20b)');
