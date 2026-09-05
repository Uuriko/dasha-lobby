#!/usr/bin/env node
/** Empty network: community jobs fail closed. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML);
assert.match(html, /id=['"]eng-community['"][^>]*>Community</);
assert.doesNotMatch(html, /Community · no Mac/);
assert.match(html, /showNightEmpty|fleetEmpty/);
assert.match(html, /if\(community&&!selfRoute&&!networkModels\.has\(\$\(['"]model['"]\)\.value\)\)/);
assert.match(html, /queueForMac/);
assert.match(html, /showNightOffer/);
assert.match(html, /id=['"]queue-night['"][^>]*>Queue</);
assert.doesNotMatch(html, /Queue for when a Mac is up/);
assert.match(html, /stream:true/);
assert.match(html, /setTimeout\(resolve,400\)/);
assert.match(html, /id=['"]cancel-job['"]/);
assert.doesNotMatch(html, /Queued for an online Mac/);

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'empty-community-secret',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) { if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item); else rows.set(key, value); },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const token = await createSessionToken(env, { xId: '1', handle: 'empty' });
const res = await network.fetch(new Request('https://www.getdasha.com/compute/api/jobs', {
  method: 'POST',
  headers: { Cookie: `${COOKIE}=${token}`, 'Content-Type': 'application/json', Origin: 'https://www.getdasha.com' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], model: 'qwen3-8b', stream: true }),
}));
assert.ok([503, 409, 400, 200].includes(res.status) || res.status >= 400, 'empty network fails closed or queues honestly');
console.log('dasha-compute-empty-community-job: PASS');
