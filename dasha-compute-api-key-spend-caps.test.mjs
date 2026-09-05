#!/usr/bin/env node
/** API key dollar spend caps: create defaults, list fields, window reset, chat 402. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOSTED_ASK_PRICE_CENTS as PRICE } from './dasha-compute-credits.mjs';
import {
  API_KEY_LIMIT_DEFAULT_CENTS,
  ComputeNetwork,
  HOSTED_ASK_PRICE_CENTS,
  parseApiKeyLimitCents,
  parseApiKeyLimitReset,
  refreshApiKeySpendWindow,
  apiKeyPublicView,
} from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

assert.equal(PRICE, 5);
assert.equal(HOSTED_ASK_PRICE_CENTS, 5);
assert.equal(API_KEY_LIMIT_DEFAULT_CENTS, 500);

assert.equal(parseApiKeyLimitCents(undefined), 500);
assert.equal(parseApiKeyLimitCents(null), null);
assert.equal(parseApiKeyLimitCents(0), 500);
assert.equal(parseApiKeyLimitCents(99), 500);
assert.equal(parseApiKeyLimitCents(100), 100);
assert.equal(parseApiKeyLimitCents(100000), 100000);
assert.equal(parseApiKeyLimitCents(100001), 500);
assert.equal(parseApiKeyLimitReset('weekly'), 'weekly');
assert.equal(parseApiKeyLimitReset('nope'), 'monthly');

const now = Date.now();
const refreshed = refreshApiKeySpendWindow({
  id: 'key_test', limitCents: 500, limitReset: 'daily', spendCents: 40,
  spendWindowStart: now - 25 * 60 * 60_000, createdAt: now - 40 * 60 * 60_000,
}, now);
assert.equal(refreshed.spendCents, 0);
assert.ok(refreshed.spendWindowStart >= now - 1000);

const view = apiKeyPublicView({
  id: 'key_a', name: 'A', prefix: 'dsk_abcdefghij', createdAt: now, lastUsedAt: 0,
  limitCents: 500, limitReset: 'monthly', spendCents: 15, spendWindowStart: now,
}, now);
assert.equal(view.limit_cents, 500);
assert.equal(view.limit_remaining_cents, 485);
assert.equal(view.spend_cents, 15);
assert.equal(view.limit_reset, 'monthly');
assert.ok(!('tokenHash' in view) && !('api_key' in view));

const env = { LOBBY_SESSION_SECRET: 'api-key-spend-caps-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const session = await createSessionToken(env, { xId: 'spend-caps', handle: 'spend_caps' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const created = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'Capped' }),
}), origin);
assert.equal(created.status, 201, await created.clone().text());
const createdBody = await created.json();
assert.equal(createdBody.limit_cents, 500);
assert.equal(createdBody.limit_reset, 'monthly');
assert.equal(createdBody.spend_cents, 0);
assert.equal(createdBody.limit_remaining_cents, 500);
assert.match(createdBody.api_key || '', /^dsk_/);
const storedDefault = [...rows.values()].find(v => v?.name === 'Capped');
assert.equal(storedDefault.limitCents, 500);
assert.equal(storedDefault.spendCents, 0);
assert.ok(storedDefault.spendWindowStart);

const uncapped = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'Open', limit_cents: null, limit_reset: 'none' }),
}), origin);
assert.equal(uncapped.status, 201);
const uncappedBody = await uncapped.json();
assert.equal(uncappedBody.limit_cents, null);
assert.equal(uncappedBody.limit_reset, 'none');
assert.equal(uncappedBody.limit_remaining_cents, null);

const custom = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'Floor', limit_cents: 100, limit_reset: 'daily' }),
}), origin);
assert.equal(custom.status, 201);
const floor = await custom.json();
assert.equal(floor.limit_cents, 100);
assert.equal(floor.limit_reset, 'daily');

const listed = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', { headers: cookie }), origin);
assert.equal(listed.status, 200);
const listBody = await listed.json();
const floorRow = listBody.keys.find(k => k.id === floor.id);
assert.equal(floorRow.limit_cents, 100);
assert.equal(floorRow.limit_remaining_cents, 100);
assert.equal(floorRow.spend_cents, 0);
assert.ok(!('api_key' in floorRow) && !('tokenHash' in floorRow));

await storage.put('compute:provider:mac_spendcaps1', {
  id: 'mac_spendcaps1', owner: 'x:provider', name: 'Cap Mac', allowedModels: ['qwen3-8b'], models: ['qwen3-8b'],
  tokenHash: 'x', createdAt: now, lastSeenAt: Date.now(),
});

const apiHeaders = { Authorization: `Bearer ${floor.api_key}`, 'Content-Type': 'application/json' };

async function completeNextQueued(answer) {
  for (let i = 0; i < 40; i++) {
    const queued = [...rows.entries()].find(([k, v]) => k.startsWith('compute:job:') && v.status === 'queued');
    if (queued) {
      const [jobKey, job] = queued;
      await storage.put(jobKey, { ...job, status: 'complete', answer, messages: null, usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
      return job.id;
    }
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('no queued job');
}

const firstPromise = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: apiHeaders,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'one' }] }),
}));
await completeNextQueued('ok');
const first = await firstPromise;
assert.equal(first.status, 200, await first.clone().text());
assert.equal((await storage.get(`compute:api-key:${floor.id}`)).spendCents, 5);

// Push spend to the edge: 95 spent → next 5 ok → then block
const edge = await storage.get(`compute:api-key:${floor.id}`);
await storage.put(`compute:api-key:${floor.id}`, { ...edge, spendCents: 95 });

const secondPromise = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: apiHeaders,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'two' }] }),
}));
await completeNextQueued('ok2');
const second = await secondPromise;
assert.equal(second.status, 200, await second.clone().text());
assert.equal((await storage.get(`compute:api-key:${floor.id}`)).spendCents, 100);

const blocked = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: apiHeaders,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'three' }] }),
}));
assert.equal(blocked.status, 402);
const blockedBody = await blocked.json();
assert.match(blockedBody.error?.message || '', /key spend limit reached/);

const listed2 = await (await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', { headers: cookie }), origin)).json();
const floorRow2 = listed2.keys.find(k => k.id === floor.id);
assert.equal(floorRow2.spend_cents, 100);
assert.equal(floorRow2.limit_remaining_cents, 0);

const html = readFileSync(new URL('./dasha-compute.html', import.meta.url), 'utf8');
const page = readFileSync(new URL('./dasha-compute-page.mjs', import.meta.url), 'utf8');
assert.match(html, /id=["']api-key-limit["']/, 'html #api-key-limit');
assert.match(html, /Cap \$5 \/ month/, 'html default cap hint');
assert.match(html, /limit_cents/, 'html posts limit_cents');
assert.match(page, /api-key-limit/, 'page #api-key-limit');
assert.match(page, /Cap \$5 \/ month/, 'page default cap hint');
assert.match(page, /limit_cents/, 'page posts limit_cents');

console.log('dasha-compute-api-key-spend-caps: PASS');
