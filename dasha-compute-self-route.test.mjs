#!/usr/bin/env node
/** Self-route / My Mac free — Darkbloom-inspired own-Mac path. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ComputeNetwork,
  resolveJobRoute,
  HOSTED_ASK_PRICE_CENTS,
} from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

assert.match(html, /id=["']eng-self["'][^>]*hidden[^>]*>My Mac · free</);
assert.match(html, /id=["']ask-mymac["'][^>]*hidden[^>]*>My Mac · free</);
assert.match(html, /ownMacOnline/);
assert.match(html, /paintAskMyMac/);
assert.match(html, /route=['"]self['"]/);
assert.match(html, /Your Mac is offline\./);
assert.doesNotMatch(html, /fake Mac|Designer|#44/);

const now = 1_000_000;
const owned = { id: 'mac_mine', owner: 'x:1', models: ['qwen3-8b'], lastSeenAt: now };
const other = { id: 'mac_other', owner: 'x:2', models: ['qwen3-8b'], lastSeenAt: now };
assert.equal(resolveJobRoute('x:1', { model: 'qwen3-8b', route: 'self' }, [owned], now).route, 'self');
assert.equal(resolveJobRoute('x:1', { model: 'qwen3-8b', route: 'self' }, [other], now).ownedOnline.length, 0);
assert.equal(resolveJobRoute('x:1', { model: 'qwen3-8b', prefer_self: true }, [owned], now).route, 'self');
assert.equal(resolveJobRoute('x:1', { model: 'qwen3-8b', prefer_self: true }, [other], now).route, 'community');
assert.equal(resolveJobRoute('x:1', { model: 'qwen3-8b', route: 'mixture', prefer_self: true }, [owned], now).route, 'self');
assert.equal(resolveJobRoute('x:1', { model: 'qwen3-8b', route: 'mixture', prefer_self: true }, [], now).route, 'mixture');

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'self-route-secret',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: '1', handle: 'self_owner' });
const otherSession = await createSessionToken(env, { xId: '2', handle: 'other_mac' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
const otherHeaders = { Cookie: `${COOKIE}=${otherSession}`, Origin: origin, 'Content-Type': 'application/json' };

const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Mine', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201);
const mine = await reg.json();

const reg2 = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: otherHeaders, body: JSON.stringify({ name: 'Theirs', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg2.status, 201);
const theirs = await reg2.json();

const mineProv = { Authorization: `Bearer ${mine.provider_token}`, 'Content-Type': 'application/json' };
const theirProv = { Authorization: `Bearer ${theirs.provider_token}`, 'Content-Type': 'application/json' };
const beatMine = { provider_id: mine.provider_id, name: 'Mine', models: ['qwen3-8b'] };
const beatTheirs = { provider_id: theirs.provider_id, name: 'Theirs', models: ['qwen3-8b'] };

assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: mineProv, body: JSON.stringify(beatMine),
}), origin)).status, 204);
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: theirProv, body: JSON.stringify(beatTheirs),
}), origin)).status, 204);

const offline = await network.fetch(new Request('https://www.getdasha.com/compute/api/jobs', {
  method: 'POST', headers: userHeaders,
  body: JSON.stringify({ prompt: 'hi', model: 'gemma3-27b', route: 'self' }),
}), origin);
assert.equal(offline.status, 503);
assert.match((await offline.json()).error, /Your Mac is offline/);

async function queueAndFinish({ body, expectRoute, leaser, beat, providerId, expectEarn }) {
  const queued = await network.fetch(new Request('https://www.getdasha.com/compute/api/jobs', {
    method: 'POST', headers: userHeaders, body: JSON.stringify(body),
  }), origin);
  assert.equal(queued.status, 202, JSON.stringify(body));
  const submitted = await queued.json();
  assert.equal(rows.get(`compute:job:${submitted.id}`).route, expectRoute);
  const steal = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: theirProv, body: JSON.stringify(beatTheirs),
  }), origin);
  if (expectRoute === 'self') assert.equal(steal.status, 204, 'other Mac must not steal self-route');
  else if (steal.status === 200) {
    // community may be taken by theirs — finish there
    const id = (await steal.json()).job.id;
    await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${id}/result`, {
      method: 'POST', headers: theirProv,
      body: JSON.stringify({ provider_id: theirs.provider_id, content: 'from fleet', usage: { completion_tokens: 10 } }),
    }), origin);
    return submitted.id;
  }
  const lease = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: leaser, body: JSON.stringify(beat),
  }), origin);
  assert.equal(lease.status, 200);
  const leased = await lease.json();
  assert.equal(leased.job.id, submitted.id);
  await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${submitted.id}/result`, {
    method: 'POST', headers: leaser,
    body: JSON.stringify({ provider_id: providerId, content: 'hello from mac', usage: { completion_tokens: 10 } }),
  }), origin);
  if (expectEarn) assert.ok(rows.has(`compute:provider-earn:${providerId}`));
  else {
    assert.equal(rows.has(`compute:provider-earn-job:${submitted.id}`), false);
  }
  return submitted.id;
}

const selfId = await queueAndFinish({
  body: { prompt: 'hi self', model: 'qwen3-8b', route: 'self' },
  expectRoute: 'self',
  leaser: mineProv,
  beat: beatMine,
  providerId: mine.provider_id,
  expectEarn: false,
});
assert.equal(rows.has(`compute:provider-earn:${mine.provider_id}`), false, 'self jobs accrue 0 earn');

await queueAndFinish({
  body: { prompt: 'prefer', model: 'qwen3-8b', prefer_self: true },
  expectRoute: 'self',
  leaser: mineProv,
  beat: beatMine,
  providerId: mine.provider_id,
  expectEarn: false,
});

const hdr = await network.fetch(new Request('https://www.getdasha.com/compute/api/jobs', {
  method: 'POST',
  headers: { ...userHeaders, 'X-Dasha-Route': 'self' },
  body: JSON.stringify({ prompt: 'hdr', model: 'qwen3-8b' }),
}), origin);
assert.equal(hdr.status, 202);
const hdrJob = await hdr.json();
assert.equal(rows.get(`compute:job:${hdrJob.id}`).route, 'self');
{
  assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: theirProv, body: JSON.stringify(beatTheirs),
  }), origin)).status, 204);
  const L = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: mineProv, body: JSON.stringify(beatMine),
  }), origin);
  assert.equal(L.status, 200);
  await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${hdrJob.id}/result`, {
    method: 'POST', headers: mineProv,
    body: JSON.stringify({ provider_id: mine.provider_id, content: 'hdr done' }),
  }), origin);
}

await queueAndFinish({
  body: { prompt: 'fleet', model: 'qwen3-8b' },
  expectRoute: 'community',
  leaser: theirProv,
  beat: beatTheirs,
  providerId: theirs.provider_id,
  expectEarn: true,
});

assert.equal(HOSTED_ASK_PRICE_CENTS, 5);
assert.ok(selfId);
console.log('dasha-compute-self-route: PASS (route self / prefer_self / no steal / no earn / My Mac UI)');
