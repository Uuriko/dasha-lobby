#!/usr/bin/env node
/**
 * Compute Drives v0 — Files layer.
 * create / put / get / list, owner isolation, quota, unbound R2 fail-loud.
 * Drives work with providers_online=0. Chat stays fail-loud no_mac_online.
 * No wrangler deploy. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { mintGuestKey } from './dasha-compute-guest-key.mjs';
import {
  DREAM_JSON_PATH,
  DREAM_MD_PATH,
  DREAM_MODEL,
  DRIVE_OBJECT_MAX_BYTES,
  DRIVE_QUOTA_BYTES,
  DRIVES_BINDING,
  DRIVES_BUCKET,
  normalizeObjectPath,
  normalizePrefix,
  readDriveId,
  selectDreamSources,
} from './dasha-compute-drives.mjs';
import { COMPUTE_LLMS_TXT, COMPUTE_SKILL_MD } from './dasha-compute-agent.mjs';
import { DOCS_OPENAPI_JSON } from './dasha-docs-page.mjs';

assert.equal(DRIVES_BINDING, 'DRIVES');
assert.equal(DRIVES_BUCKET, 'dasha-compute-drives');
assert.equal(DRIVE_OBJECT_MAX_BYTES, 8 * 1024 * 1024);
assert.equal(DRIVE_QUOTA_BYTES, 1024 * 1024 * 1024);
assert.equal(normalizeObjectPath('../secret'), null);
assert.equal(normalizeObjectPath('memory/note.txt'), 'memory/note.txt');
assert.equal(normalizePrefix('memory/'), 'memory/');
assert.equal(normalizePrefix('..'), null);
assert.equal(readDriveId(undefined), null);
assert.equal(readDriveId('drv_not-valid'), false);
assert.equal(typeof readDriveId('drv_abcdefghijkl'), 'string');
assert.deepEqual(selectDreamSources(['notes/b.txt', 'memory/a.txt', DREAM_JSON_PATH]), { scope: 'memory', paths: ['memory/a.txt'] });
assert.deepEqual(selectDreamSources(['notes/b.txt', DREAM_MD_PATH]), { scope: 'drive', paths: ['notes/b.txt'] });
assert.deepEqual(selectDreamSources([]), { scope: 'empty', paths: [] });
assert.equal(selectDreamSources(Array.from({ length: 10 }, (_, i) => `memory/f${i}.txt`)).paths.length, 8);

assert.match(COMPUTE_SKILL_MD, /^## Brain \/ Hands \/ Files$/m);
assert.match(COMPUTE_SKILL_MD, /Brain: Workers gateway \+ Hosted Ask \+ signed receipt chain\./);
assert.match(COMPUTE_SKILL_MD, /Hands: Community Mac at \/compute#provide/);
assert.match(COMPUTE_SKILL_MD, /Files: Drives\./);
assert.match(COMPUTE_SKILL_MD, /providers_online=0 means no Mac/);
assert.match(COMPUTE_SKILL_MD, /drives_unavailable/);
assert.match(COMPUTE_SKILL_MD, /Binding DRIVES/);
assert.match(COMPUTE_LLMS_TXT, /^Brain: Workers gateway \+ Hosted Ask \+ signed receipt chain\.$/m);
assert.match(COMPUTE_LLMS_TXT, /^Hands: Community Mac \(\/compute#provide\)/m);
assert.match(COMPUTE_LLMS_TXT, /^Files: Drives\./m);
assert.match(COMPUTE_LLMS_TXT, /Works with providers_online=0/);
assert.doesNotMatch(COMPUTE_SKILL_MD, /plugin\.jup\.ag/);
assert.doesNotMatch(COMPUTE_LLMS_TXT, /plugin\.jup\.ag/);

const spec = JSON.parse(DOCS_OPENAPI_JSON);
assert.ok(spec.paths['/compute/api/v1/drives']?.post, 'openapi POST drives');
assert.ok(spec.paths['/compute/api/v1/drives']?.get, 'openapi GET drives');
assert.ok(spec.paths['/compute/api/v1/drives/{id}/objects/{path}']?.put, 'openapi PUT object');
assert.match(spec.info.description, /Files: Drives/);
assert.match(spec.info.description, /DRIVES/);

const wrangler = readFileSync(new URL('./dasha-lobby-wrangler.deploy.jsonc', import.meta.url), 'utf8');
// Tip must not require the missing bucket. The comment names the binding a follow-up PR re-adds.
assert.match(wrangler, /dasha-compute-drives/);
assert.match(wrangler, /follow-up PR re-adds/);
const wranglerLive = wrangler.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert.doesNotMatch(wranglerLive, /"r2_buckets"/);
assert.doesNotMatch(wranglerLive, /"binding": "DRIVES"/);
assert.doesNotMatch(wranglerLive, /"bucket_name": "dasha-compute-drives"/);

function memoryStorage() {
  const rows = new Map();
  return {
    rows,
    async get(key) { return rows.get(key); },
    async put(key, value) {
      if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
      else rows.set(key, value);
    },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
  };
}

function memoryR2() {
  const objects = new Map();
  return {
    objects,
    async put(key, value, opts) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      objects.set(key, { bytes, httpMetadata: opts?.httpMetadata || {}, customMetadata: opts?.customMetadata || {} });
    },
    async head(key) {
      const row = objects.get(key);
      if (!row) return null;
      return { size: row.bytes.byteLength, httpMetadata: row.httpMetadata, customMetadata: row.customMetadata };
    },
    async get(key) {
      const row = objects.get(key);
      if (!row) return null;
      return {
        body: row.bytes,
        size: row.bytes.byteLength,
        httpMetadata: row.httpMetadata,
        customMetadata: row.customMetadata,
        async arrayBuffer() {
          return row.bytes.buffer.slice(row.bytes.byteOffset, row.bytes.byteOffset + row.bytes.byteLength);
        },
      };
    },
    async delete(key) { objects.delete(key); },
    async list({ prefix } = {}) {
      const keys = [...objects.keys()].filter((k) => !prefix || k.startsWith(prefix)).sort();
      return {
        objects: keys.map((k) => ({ key: k, size: objects.get(k).bytes.byteLength })),
        truncated: false,
      };
    },
  };
}

function sha(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

const dreamCalls = [];
const env = {
  LOBBY_SESSION_SECRET: 'drives-v0-secret',
  AI: {
    run: async (model, payload) => {
      dreamCalls.push({ model, payload });
      return { response: 'ok' };
    },
  },
};
const storage = memoryStorage();
const bucket = memoryR2();
const network = new ComputeNetwork({ storage }, { ...env, DRIVES: bucket });
const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, DRIVES: bucket, LOBBY: lobby };

const minted = await mintGuestKey({ storage, rates: new Map(), ip: '203.0.113.50', name: 'files' });
assert.equal(minted.status, 201);
const guest = minted.body.api_key;
const auth = { Authorization: `Bearer ${guest}`, 'Content-Type': 'application/json' };

const bare = new ComputeNetwork({ storage: memoryStorage() }, env);
const bareSlug = 'drvownerkey1';
const bareSecret = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const bareToken = `dsk_${bareSlug}.${bareSecret}`;
await bare.state.storage.put(`compute:api-key:key_${bareSlug}`, {
  id: `key_${bareSlug}`,
  owner: 'x:bare',
  name: 'bare',
  prefix: bareToken.slice(0, 12),
  tokenHash: sha(bareToken),
  createdAt: Date.now(),
  lastUsedAt: 0,
  limitCents: 500,
  limitReset: 'monthly',
  spendCents: 0,
  spendWindowStart: Date.now(),
});
const unbound = await bare.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/drives', {
  method: 'POST',
  headers: { Authorization: `Bearer ${bareToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'agent-workspace' }),
}));
assert.equal(unbound.status, 503);
const unboundBody = await unbound.json();
assert.equal(unboundBody.reason, 'drives_unavailable');
assert.equal(unboundBody.status, 'failed');
assert.equal(unboundBody.error.code, 'drives_unavailable');
assert.equal(unboundBody.error.type, 'server_error');
assert.match(unboundBody.hint, /DRIVES/);
assert.match(unboundBody.hint, /Mac/);
assert.ok(unboundBody.next.some((step) => step.path === '/compute/api/v1/drives'));
assert.doesNotMatch(JSON.stringify(unboundBody), /providers_online":\s*[1-9]/);

const anon = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/drives'));
assert.equal(anon.status, 401);
assert.equal((await anon.json()).reason, 'invalid_api_key');

const created = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/drives', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ name: 'agent-workspace' }),
}), workerEnv);
assert.equal(created.status, 201);
const drive = await created.json();
assert.equal(drive.created, true);
assert.equal(drive.object, 'drive');
assert.equal(drive.name, 'agent-workspace');
assert.equal(drive.binding, 'DRIVES');
assert.equal(drive.bytes, 0);
assert.equal(drive.quota_bytes, DRIVE_QUOTA_BYTES);
assert.match(drive.id, /^drv_[A-Za-z0-9_-]{12}$/);
assert.equal('owner' in drive, false);
assert.doesNotMatch(JSON.stringify(drive), /providers_online|macs_online/i);

const again = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/drives/', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ name: 'Agent-Workspace' }),
}));
assert.equal(again.status, 200);
const againBody = await again.json();
assert.equal(againBody.created, false);
assert.equal(againBody.id, drive.id);

const badName = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/drives', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ name: '../nope' }),
}));
assert.equal(badName.status, 400);
assert.equal((await badName.json()).reason, 'invalid_drive_name');

const listed = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/drives', {
  headers: { Authorization: `Bearer ${guest}` },
}));
assert.equal(listed.status, 200);
const listBody = await listed.json();
assert.equal(listBody.object, 'list');
assert.equal(listBody.data.length, 1);
assert.equal(listBody.data[0].id, drive.id);

const meta = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}`, {
  headers: { Authorization: `Bearer ${guest}` },
}));
assert.equal(meta.status, 200);
assert.equal((await meta.json()).id, drive.id);

const slug = 'dskdrivekey1';
const secret = 'abcdefghijklmnopqrstuvwx';
const dsk = `dsk_${slug}.${secret}`;
await storage.put(`compute:api-key:key_${slug}`, {
  id: `key_${slug}`,
  owner: 'x:other',
  name: 'other',
  prefix: dsk.slice(0, 12),
  tokenHash: sha(dsk),
  createdAt: Date.now(),
  lastUsedAt: 0,
  limitCents: 500,
  limitReset: 'monthly',
  spendCents: 0,
  spendWindowStart: Date.now(),
});
const foreign = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}`, {
  headers: { Authorization: `Bearer ${dsk}` },
}));
assert.equal(foreign.status, 404);
assert.equal((await foreign.json()).reason, 'drive_not_found');

const put = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects/memory/note.txt`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${guest}`, 'Content-Type': 'text/plain' },
  body: 'remember this',
}));
assert.equal(put.status, 201);
const putBody = await put.json();
assert.equal(putBody.path, 'memory/note.txt');
assert.equal(putBody.bytes, 'remember this'.length);
assert.equal(putBody.content_type, 'text/plain');

const got = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects/memory/note.txt`, {
  headers: { Authorization: `Bearer ${guest}` },
}));
assert.equal(got.status, 200);
assert.match(got.headers.get('content-type') || '', /^text\/plain/);
assert.equal(await got.text(), 'remember this');

await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects/other.txt`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${guest}` },
  body: 'nope',
}));
const prefix = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects?prefix=memory/`, {
  headers: { Authorization: `Bearer ${guest}` },
}));
assert.equal(prefix.status, 200);
const prefixBody = await prefix.json();
assert.deepEqual(prefixBody.data.map((row) => row.path), ['memory/note.txt']);

const traversal = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects/memory/note%20txt`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${guest}` },
  body: 'no',
}));
assert.equal(traversal.status, 400);
assert.equal((await traversal.json()).reason, 'invalid_object_path');

const tooBig = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects/big.bin`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${guest}`,
    'Content-Length': String(DRIVE_OBJECT_MAX_BYTES + 1),
  },
  body: 'x',
}));
assert.equal(tooBig.status, 413);
assert.equal((await tooBig.json()).reason, 'object_too_large');

const snap = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/snapshot`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${guest}` },
}));
assert.equal(snap.status, 201);
const snapBody = await snap.json();
assert.equal(snapBody.object, 'drive.snapshot');
assert.equal(snapBody.note, 'metadata only');
assert.equal(snapBody.drive_id, drive.id);

const row = await storage.get(`compute:drive:${drive.id}`);
row.bytes = DRIVE_QUOTA_BYTES - 2;
await storage.put(`compute:drive:${drive.id}`, row);
const over = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects/quota.bin`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${guest}` },
  body: 'abcd',
}));
assert.equal(over.status, 413);
assert.equal((await over.json()).reason, 'drive_quota');

const net = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network'));
assert.equal(net.status, 200);
assert.equal((await net.json()).providers_online, 0);

const chat = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }] }),
}));
assert.equal(chat.status, 503);
const chatBody = await chat.json();
assert.equal(chatBody.reason, 'no_mac_online');
assert.doesNotMatch(JSON.stringify(chatBody), /drives_unavailable/);

const gw = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1'), workerEnv);
assert.equal(gw.status, 200);
const gwBody = await gw.json();
assert.equal(gwBody.drives, '/compute/api/v1/drives');
assert.equal(gwBody.layers.brain.chat_completions, '/compute/api/v1/chat/completions');
assert.equal(gwBody.layers.brain.hosted_ask, '/compute/api/chat');
assert.match(gwBody.layers.brain.summary, /gateway/);
assert.equal(gwBody.layers.hands.providers, '/compute/api/providers');
assert.equal(gwBody.layers.hands.network, '/compute/api/v1/network');
assert.equal(gwBody.layers.hands.provide, '/compute#provide');
assert.equal(gwBody.layers.hands.kit, '/compute/skill.md');
assert.equal(gwBody.layers.hands.online_count.path, '/compute/api/v1/network');
assert.equal(gwBody.layers.hands.online_count.field, 'providers_online');
assert.equal(gwBody.layers.hands.providers_online, undefined);
assert.match(gwBody.layers.hands.summary, /Community Mac/);
assert.equal(gwBody.layers.files.drives, '/compute/api/v1/drives');
assert.equal(gwBody.layers.files.dream, '/compute/api/v1/drives/:id/dream');
assert.equal(gwBody.layers.files.unbound.reason, 'drives_unavailable');
assert.match(gwBody.layers.files.summary, /Drives/);
assert.match(gwBody.layers.files.summary, /providers_online=0/);
assert.match(gwBody.layers.files.summary, /Dream via Hosted Ask/);
assert.equal(gwBody.dream, '/compute/api/v1/drives/:id/dream');

const removed = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects/other.txt`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${guest}` },
}));
assert.equal(removed.status, 200);
assert.equal((await removed.json()).deleted, true);
const gone = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${drive.id}/objects/other.txt`, {
  headers: { Authorization: `Bearer ${guest}` },
}));
assert.equal(gone.status, 404);
assert.equal((await gone.json()).reason, 'object_not_found');

const page = readFileSync(new URL('./dasha-compute.html', import.meta.url), 'utf8');
assert.match(page, /id="compute-layers">Brain · gateway\. Hands · Macs\. Files · Drives\.</);

assert.ok(spec.paths['/compute/api/v1/drives/{id}/dream']?.post, 'openapi POST dream');
assert.match(COMPUTE_SKILL_MD, /POST \/compute\/api\/v1\/drives\/:id\/dream/);
assert.match(COMPUTE_SKILL_MD, /hosted_offline/);
assert.match(COMPUTE_SKILL_MD, /does not put a Mac online/);
assert.match(COMPUTE_LLMS_TXT, /POST \/compute\/api\/v1\/drives\/:id\/dream/);
assert.match(COMPUTE_LLMS_TXT, /does not invent a Mac/);

const dskAuth = { Authorization: `Bearer ${dsk}`, 'Content-Type': 'application/json' };
async function makeDrive(name) {
  const res = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/drives', {
    method: 'POST',
    headers: dskAuth,
    body: JSON.stringify({ name }),
  }));
  assert.equal(res.status, 201, name);
  return res.json();
}
async function putObject(id, objectPath, body, contentType = 'text/plain') {
  const res = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${id}/objects/${objectPath}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${dsk}`, 'Content-Type': contentType },
    body,
  }));
  assert.equal(res.status, 201, objectPath);
  return res;
}

const memoryDrive = await makeDrive('dream-lab');
await putObject(memoryDrive.id, 'memory/note.txt', 'remember the room');
await putObject(memoryDrive.id, 'notes/skip.txt', 'not memory');
const dreamed = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${memoryDrive.id}/dream`, {
  method: 'POST',
  headers: dskAuth,
  body: '{}',
}));
assert.equal(dreamed.status, 200);
const dreamBody = await dreamed.json();
assert.equal(dreamBody.object, 'drive.dream');
assert.equal(dreamBody.drive_id, memoryDrive.id);
assert.equal(dreamBody.path, DREAM_JSON_PATH);
assert.equal(dreamBody.route, 'hosted');
assert.equal(dreamBody.model, 'gpt-oss-20b');
assert.equal(dreamBody.scope, 'memory');
assert.deepEqual(dreamBody.read, ['memory/note.txt']);
assert.equal(dreamBody.text, 'ok');
assert.equal(dreamBody.bytes > 0, true);
assert.doesNotMatch(JSON.stringify(dreamBody), /providers_online|macs_online/i);
assert.equal(dreamCalls.at(-1).model, DREAM_MODEL);
assert.equal(dreamCalls.at(-1).payload.max_tokens, 256);
assert.equal(dreamCalls.at(-1).payload.temperature, 0.6);
assert.match(dreamCalls.at(-1).payload.messages[0].content, /not a community Mac/);
assert.match(dreamCalls.at(-1).payload.messages[0].content, /Never invent Macs/);
assert.match(dreamCalls.at(-1).payload.messages[1].content, /remember the room/);
assert.doesNotMatch(dreamCalls.at(-1).payload.messages[1].content, /not memory/);
const dreamedFile = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${memoryDrive.id}/objects/${DREAM_JSON_PATH}`, {
  headers: { Authorization: `Bearer ${dsk}` },
}));
assert.equal(dreamedFile.status, 200);
const storedDream = JSON.parse(await dreamedFile.text());
assert.equal(storedDream.text, 'ok');
assert.equal(storedDream.scope, 'memory');

const plainDrive = await makeDrive('dream-plain');
await putObject(plainDrive.id, 'notes/a.txt', 'whole drive');
const plainDream = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${plainDrive.id}/dream`, {
  method: 'POST',
  headers: dskAuth,
  body: JSON.stringify({ format: 'md' }),
}));
assert.equal(plainDream.status, 200);
const plainBody = await plainDream.json();
assert.equal(plainBody.scope, 'drive');
assert.equal(plainBody.path, DREAM_MD_PATH);
assert.deepEqual(plainBody.read, ['notes/a.txt']);
const mdFile = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${plainDrive.id}/objects/${DREAM_MD_PATH}`, {
  headers: { Authorization: `Bearer ${dsk}` },
}));
assert.equal(mdFile.status, 200);
assert.equal(await mdFile.text(), 'ok');

const emptyDrive = await makeDrive('dream-empty');
const emptyDream = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${emptyDrive.id}/dream`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${dsk}` },
}));
assert.equal(emptyDream.status, 200);
const emptyBody = await emptyDream.json();
assert.equal(emptyBody.scope, 'empty');
assert.deepEqual(emptyBody.read, []);
assert.match(dreamCalls.at(-1).payload.messages[1].content, /Scope: empty/);

const nulDrive = await makeDrive('dream-nul');
await putObject(nulDrive.id, 'memory/bin.dat', '\0secret');
await putObject(nulDrive.id, 'notes/keep.txt', 'kept');
const nulDream = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${nulDrive.id}/dream`, {
  method: 'POST',
  headers: dskAuth,
  body: '{}',
}));
assert.equal(nulDream.status, 200);
const nulBody = await nulDream.json();
assert.equal(nulBody.scope, 'drive');
assert.deepEqual(nulBody.read, ['notes/keep.txt']);
assert.doesNotMatch(dreamCalls.at(-1).payload.messages[1].content, /secret/);

const offline = new ComputeNetwork({ storage }, { LOBBY_SESSION_SECRET: env.LOBBY_SESSION_SECRET, DRIVES: bucket });
const offlineRes = await offline.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${emptyDrive.id}/dream`, {
  method: 'POST',
  headers: dskAuth,
  body: '{}',
}));
assert.equal(offlineRes.status, 503);
const offlineBody = await offlineRes.json();
assert.equal(offlineBody.reason, 'hosted_offline');
assert.equal(offlineBody.status, 'failed');
assert.match(offlineBody.hint, /Mac is not required/);
assert.equal(offlineBody.error.code, null);

const boom = new ComputeNetwork({ storage }, {
  LOBBY_SESSION_SECRET: env.LOBBY_SESSION_SECRET,
  DRIVES: bucket,
  AI: { run: async () => { throw new Error('cut'); } },
});
const boomRes = await boom.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${emptyDrive.id}/dream`, {
  method: 'POST',
  headers: dskAuth,
  body: '{}',
}));
assert.equal(boomRes.status, 502);
assert.equal((await boomRes.json()).reason, 'hosted_failed');

const silent = new ComputeNetwork({ storage }, {
  LOBBY_SESSION_SECRET: env.LOBBY_SESSION_SECRET,
  DRIVES: bucket,
  AI: { run: async () => ({ response: '   ' }) },
});
const silentRes = await silent.fetch(new Request(`https://lobby.getdasha.com/compute/api/v1/drives/${emptyDrive.id}/dream`, {
  method: 'POST',
  headers: dskAuth,
  body: '{}',
}));
assert.equal(silentRes.status, 502);
assert.equal((await silentRes.json()).reason, 'hosted_failed');

const still = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network'));
assert.equal((await still.json()).providers_online, 0);
const chatAfter = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }], drive_id: memoryDrive.id }),
}));
assert.equal(chatAfter.status, 503);
assert.equal((await chatAfter.json()).reason, 'no_mac_online');
const jobsAfter = await storage.list({ prefix: 'compute:job:' });
assert.equal([...jobsAfter.values()].some((job) => job.drive_id), false);

const badDrive = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'hi' }], drive_id: 'nope' }),
}));
assert.equal(badDrive.status, 400);
const badDriveBody = await badDrive.json();
assert.equal(badDriveBody.reason, 'invalid_drive_id');
assert.match(badDriveBody.error.message, /^drive_id must be drv_/);
assert.match(badDriveBody.hint, /does not put a Mac online/);

const stubStorage = memoryStorage();
const stubNet = new ComputeNetwork({ storage: stubStorage }, env);
const stubNow = Date.now();
await stubStorage.put('compute:provider:mac_dreamstub', {
  id: 'mac_dreamstub',
  owner: 'x:hands',
  name: 'Hands',
  models: ['qwen3-8b'],
  lastSeenAt: stubNow,
});
const badQueued = await stubNet.queueJob('x:dreamer', {
  model: 'qwen3-8b',
  messages: [{ role: 'user', content: 'attach later' }],
  drive_id: 'drv_short',
}, stubNow);
assert.equal(badQueued.status, 400);
assert.match(badQueued.error, /^drive_id must be drv_/);
const queued = await stubNet.queueJob('x:dreamer', {
  model: 'qwen3-8b',
  messages: [{ role: 'user', content: 'attach later' }],
  drive_id: memoryDrive.id,
}, stubNow);
assert.equal(queued.error, undefined);
assert.equal(queued.job.drive_id, memoryDrive.id);
assert.equal(queued.job.providerId, null);
assert.doesNotMatch(JSON.stringify(queued.job), /providers_online/);
const stillBad = await stubNet.queueJob('x:dreamer', {
  model: 'qwen3-8b',
  messages: [{ role: 'user', content: 'attach later' }],
  drive_id: 'nope',
}, stubNow);
assert.equal(stillBad.status, 400);
const storedJob = await stubStorage.get(`compute:job:${queued.job.id}`);
storedJob.status = 'complete';
storedJob.answer = 'later';
storedJob.completedAt = stubNow;
storedJob.providerId = null;
await stubStorage.put(`compute:job:${storedJob.id}`, storedJob);
const stubSlug = 'dreamstubky1';
const stubSecret = 'cccccccccccccccccccccccc';
const stubToken = `dsk_${stubSlug}.${stubSecret}`;
await stubStorage.put(`compute:api-key:key_${stubSlug}`, {
  id: `key_${stubSlug}`,
  owner: 'x:dreamer',
  name: 'dreamer',
  prefix: stubToken.slice(0, 12),
  tokenHash: sha(stubToken),
  createdAt: stubNow,
  lastUsedAt: 0,
  limitCents: 500,
  limitReset: 'monthly',
  spendCents: 0,
  spendWindowStart: stubNow,
});
const jobGet = await stubNet.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${storedJob.id}`, {
  headers: { Authorization: `Bearer ${stubToken}` },
}));
assert.equal(jobGet.status, 200);
const jobBody = await jobGet.json();
assert.equal(jobBody.drive_id, memoryDrive.id);
assert.equal(jobBody.provider, null);
assert.equal(jobBody.receipt.drive_id, memoryDrive.id);
assert.equal(jobBody.receipt.provider_class, 'community');
const metaQueued = await stubNet.queueJob('x:dreamer', {
  model: 'qwen3-8b',
  messages: [{ role: 'user', content: 'meta' }],
  metadata: { drive_id: memoryDrive.id },
}, stubNow + 1);
assert.equal(metaQueued.job.drive_id, memoryDrive.id);
const stubOnline = await stubNet.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network'));
assert.equal((await stubOnline.json()).providers_online, 1);
const mainOnline = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network'));
assert.equal((await mainOnline.json()).providers_online, 0);

console.log('dasha-compute-drives: PASS (create/put/get/list, dream hosted, drive_id stub, unbound drives_unavailable, providers_online=0, chat still no_mac_online)');
