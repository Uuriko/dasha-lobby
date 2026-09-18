#!/usr/bin/env node
/**
 * License gate before catalog advertise — community bench stays off Ask/Provide
 * until commercial-serve is explicit. Mirror: Gajesh/Qwen 3.8 Flash hold.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canAdvertiseModel,
  filterAdvertisableModels,
  modelLicenseStatus,
  HELD_COMMUNITY_MODELS,
  LICENSE_CLEARED,
  LICENSE_HELD,
  LICENSE_UNKNOWN,
} from './dasha-compute-model-license.mjs';
import {
  COMPUTE_CATALOG_MODELS,
  growAllowedModels,
  v1ModelsListData,
  ComputeNetwork,
} from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const docs = readFileSync(join(root, 'MODEL-LICENSE.md'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

assert.equal(modelLicenseStatus('qwen3-8b'), LICENSE_CLEARED);
assert.equal(canAdvertiseModel('qwen3-8b'), true);
assert.equal(canAdvertiseModel('ternary-bonsai-2-27b'), true);
assert.equal(modelLicenseStatus('qwen3.8-flash'), LICENSE_HELD);
assert.equal(canAdvertiseModel('qwen3.8-flash'), false, 'Qwen 3.8 Flash stays held');
assert.equal(canAdvertiseModel('qwen3-8-flash'), false);
assert.equal(modelLicenseStatus('totally-unknown-mlx'), LICENSE_UNKNOWN);
assert.equal(canAdvertiseModel('totally-unknown-mlx'), false, 'unknown fail-closed');
assert.ok(HELD_COMMUNITY_MODELS.includes('qwen3.8-flash'));

assert.deepEqual(filterAdvertisableModels(['qwen3-8b', 'qwen3.8-flash', 'qwen3-8b']), ['qwen3-8b']);
assert.deepEqual(filterAdvertisableModels(['qwen3.8-flash']), []);

assert.ok(!growAllowedModels(['qwen3-8b'], ['qwen3.8-flash']).includes('qwen3.8-flash'));
const pretendCatalog = new Set(['qwen3.8-flash', 'qwen3-8b']);
assert.ok(
  !growAllowedModels([], ['qwen3.8-flash'], pretendCatalog).includes('qwen3.8-flash'),
  'held id never grows even if someone adds it to MODELS',
);
assert.deepEqual(growAllowedModels(['qwen3-8b'], ['qwen3-4b'], pretendCatalog).sort(), ['qwen3-8b']);

for (const id of COMPUTE_CATALOG_MODELS) {
  assert.equal(canAdvertiseModel(id), true, `live catalog ${id} stays cleared`);
}

const now = 1_000_000;
const sneaky = { id: 'mac_held', owner: 'x:9', models: ['qwen3.8-flash', 'qwen3-8b'], lastSeenAt: now };
const listed = v1ModelsListData([sneaky], now).map((row) => row.id);
assert.ok(listed.includes('qwen3-8b'));
assert.ok(!listed.includes('qwen3.8-flash'), '/v1/models must not advertise held community weights');

assert.match(html, /id=["']model-license-fine["'][^>]*>License-cleared weights only\.</);
assert.match(html, /id=["']provide-license-fine["'][^>]*>Advertise license-cleared models only\.</);
assert.match(html, /qwen3\.8-flash/);
assert.doesNotMatch(html, /value=["']qwen3\.8-flash["']/, 'picker has no held value');
assert.doesNotMatch(html, /\['qwen3\.8-flash'/, 'MODELS array has no held row');
assert.match(docs, /community bench → license clear → Provide advertise → Ask route/);
assert.match(docs, /qwen3\.8-flash/);
assert.match(docs, /UNKNOWN/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'model-license-secret',
};
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
const session = await createSessionToken(env, { xId: '9', handle: 'license' });
const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const heldReg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers, body: JSON.stringify({ name: 'Held', models: ['qwen3.8-flash'] }),
}), origin);
assert.equal(heldReg.status, 400, 'register rejects held-only model list');
assert.match((await heldReg.json()).error, /supported model/);

const okReg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers, body: JSON.stringify({ name: 'Mine', models: ['qwen3-8b'] }),
}), origin);
assert.equal(okReg.status, 201);
const mine = await okReg.json();
const beat = { Authorization: `Bearer ${mine.provider_token}`, 'Content-Type': 'application/json' };
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: beat, body: JSON.stringify({ provider_id: mine.provider_id, name: 'Mine', models: ['qwen3-8b', 'qwen3.8-flash'] }),
}), origin)).status, 204);

const net = await network.fetch(new Request('https://www.getdasha.com/compute/api/network'), origin);
assert.equal(net.status, 200);
const body = await net.json();
assert.ok(body.models_available.includes('qwen3-8b'));
assert.ok(!body.models_available.includes('qwen3.8-flash'), 'network advertise drops held ids');
assert.ok(!(body.capacity || []).some((row) => row.model === 'qwen3.8-flash'));

const job = await network.fetch(new Request('https://www.getdasha.com/compute/api/jobs', {
  method: 'POST', headers, body: JSON.stringify({ prompt: 'hi', model: 'qwen3.8-flash', route: 'community' }),
}), origin);
assert.equal(job.status, 400);
assert.match((await job.json()).error, /unsupported model/);

console.log('dasha-compute-model-license: PASS (held qwen3.8-flash never advertised; catalog stays cleared)');
