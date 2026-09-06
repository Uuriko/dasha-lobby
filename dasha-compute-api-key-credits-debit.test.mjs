#!/usr/bin/env node
/** API key prepaid credits debit: non-self v1/chat/completions requires + debits $0.05 (reason api-chat).
 *  Key limit_cents is runaway-only (not a free allowance). Self-route and session Community Ask stay free. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOSTED_ASK_PRICE_CENTS } from './dasha-compute-credits.mjs';
import { ComputeNetwork, computeApi } from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { USE_SKILL_MD } from './dasha-compute-skills.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

assert.equal(HOSTED_ASK_PRICE_CENTS, 5);

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /billing:\s*\{[\s\S]*chat_completions:/);
assert.match(src, /Prepaid credits \(\$0\.05\/job\) for community\/mixture; self-route free; key spend cap is runaway protection/);
assert.match(src, /reason: 'api-chat'/);
assert.match(src, /key spend cap is runaway-only|limit_cents is runaway-only/);
assert.match(src, /Non-self chat spends prepaid credits; cap limits runaway/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);

const html = readFileSync(new URL('./dasha-compute.html', import.meta.url), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs');
assert.match(html, /Credits · Cap \$5 \/ month/);
assert.match(html, /API billing: non-self/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);

const useDisk = readFileSync(new URL('./dasha-compute-skills/USE.md', import.meta.url), 'utf8');
assert.equal(USE_SKILL_MD, useDisk);
assert.match(USE_SKILL_MD, /API billing: non-self `v1\/chat\/completions` spends prepaid credits \(\$0\.05\/job\)/);
assert.match(USE_SKILL_MD, /key spend cap is runaway protection — not a free allowance/);

const payments = readFileSync(new URL('./COMPUTE-PAYMENTS-LAYERS-2026-09-04.md', import.meta.url), 'utf8');
assert.match(payments, /billing\.chat_completions/);
assert.match(payments, /reason `api-chat`/);
assert.match(payments, /Session UI Community Ask stays free/);
assert.match(payments, /limit_cents` is runaway-only/);
assert.match(payments, /Never invent auto treasury send/);
assert.doesNotMatch(payments, /plugin\.jup\.ag/);

const env = { LOBBY_SESSION_SECRET: 'api-key-credits-debit-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const session = await createSessionToken(env, { xId: 'debit-user', handle: 'debit_user' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
const now = Date.now();

const gw = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1'));
assert.equal(gw.status, 200);
const gateway = await gw.json();
assert.match(String(gateway.billing?.chat_completions || ''), /Prepaid credits \(\$0\.05\/job\)/);
assert.match(String(gateway.billing?.chat_completions || ''), /self-route free/);
assert.match(String(gateway.billing?.chat_completions || ''), /runaway protection/);

const created = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'Debit', limit_cents: 500, limit_reset: 'monthly' }),
}), origin);
assert.equal(created.status, 201, await created.clone().text());
const keyBody = await created.json();
assert.match(keyBody.note || '', /Non-self chat spends prepaid credits; cap limits runaway/);
assert.equal(keyBody.limit_cents, 500);
const apiHeaders = { Authorization: `Bearer ${keyBody.api_key}`, 'Content-Type': 'application/json' };

await storage.put('compute:provider:mac_other_debit', {
  id: 'mac_other_debit', owner: 'x:someoneelse', name: 'Fleet Mac', allowedModels: ['qwen3-8b'], models: ['qwen3-8b'],
  tokenHash: 'x', createdAt: now, lastSeenAt: Date.now(),
});

async function completeNextQueued(answer) {
  for (let i = 0; i < 40; i++) {
    const queued = [...rows.entries()].find(([k, v]) => k.startsWith('compute:job:') && v.status === 'queued');
    if (queued) {
      const [jobKey, job] = queued;
      await storage.put(jobKey, { ...job, status: 'complete', answer, messages: null, usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
      return job;
    }
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('no queued job');
}

function balance() {
  return Math.max(0, Math.floor(Number(rows.get('compute:credit-balance:x:debit-user')?.cents) || 0));
}

// Cap remaining is not a free allowance — 0 prepaid credits → 402 top up credits, no job.
const broke = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: apiHeaders,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'broke' }] }),
}));
assert.equal(broke.status, 402);
assert.match((await broke.json()).error?.message || '', /top up credits/);
assert.equal([...rows.keys()].some(k => k.startsWith('compute:job:')), false, 'no ghost job when prepaid is empty');
assert.equal((await storage.get(`compute:api-key:${keyBody.id}`)).spendCents, 0, 'cap must not be charged without prepaid');

await storage.put('compute:credit-balance:x:debit-user', { owner: 'x:debit-user', cents: 12, updatedAt: Date.now() });

const firstPromise = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: apiHeaders,
  body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'one' }] }),
}));
const firstJob = await completeNextQueued('ok');
const first = await firstPromise;
assert.equal(first.status, 200, await first.clone().text());
assert.equal(balance(), 7);
assert.equal((await storage.get(`compute:api-key:${keyBody.id}`)).spendCents, 5);
const spendRow = [...rows.entries()].find(([k]) => k.startsWith('compute:credit-spend:x:debit-user:'));
assert.ok(spendRow, 'api-chat spend row');
assert.equal(spendRow[1].reason, 'api-chat');
assert.equal(spendRow[1].cents, 5);
assert.equal(spendRow[0], `compute:credit-spend:x:debit-user:api:${firstJob.id}`);

// Session UI Community Ask stays free (same owner, same prepaid jar).
const sessionAsk = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
  method: 'POST', headers: cookie,
  body: JSON.stringify({ model: 'qwen3-8b', prompt: 'community free' }),
}), origin);
assert.equal(sessionAsk.status, 202, await sessionAsk.clone().text());
assert.equal(balance(), 7, 'session Community Ask must not debit prepaid');
const sessionJob = await sessionAsk.json();
await storage.delete(`compute:job:${sessionJob.id}`);

// Self-route (own Mac) stays free on the API key path.
const mine = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: cookie, body: JSON.stringify({ name: 'Mine', models: ['qwen3-8b'] }),
}), origin);
assert.equal(mine.status, 201);
const mineBody = await mine.json();
const mineProv = { Authorization: `Bearer ${mineBody.provider_token}`, 'Content-Type': 'application/json' };
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: mineProv, body: JSON.stringify({ provider_id: mineBody.provider_id, name: 'Mine', models: ['qwen3-8b'] }),
}), origin)).status, 204);

const selfPromise = network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', {
  method: 'POST', headers: apiHeaders,
  body: JSON.stringify({ model: 'qwen3-8b', route: 'self', messages: [{ role: 'user', content: 'self free' }] }),
}));
const selfJob = await completeNextQueued('self ok');
const selfRes = await selfPromise;
assert.equal(selfRes.status, 200, await selfRes.clone().text());
assert.equal(selfJob.route, 'self');
assert.equal(balance(), 7, 'self-route must not debit prepaid');
assert.equal((await storage.get(`compute:api-key:${keyBody.id}`)).spendCents, 5, 'self-route must not consume key cap');

// Session Hosted Ask free floor still free (computeApi, not API key).
env.LOBBY = {
  idFromName: () => 'public',
  get() { return { fetch: (req) => network.fetch(req, origin) }; },
};
const hosted = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST',
  headers: { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'hosted free floor' }] }),
}), env, origin);
assert.equal(hosted.status, 200, await hosted.clone().text());
assert.equal(balance(), 7, 'Hosted free floor must not debit');

console.log('dasha-compute-api-key-credits-debit: PASS');
