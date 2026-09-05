#!/usr/bin/env node
/** Night stays off chrome; no-Mac community path surfaces queue offer via /compute/api/night. */
import assert from 'node:assert/strict';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

assert.doesNotMatch(COMPUTE_PAGE_HTML, /id=["']schedule-night["']/);
assert.doesNotMatch(COMPUTE_PAGE_HTML, /Schedule Night Shift/);
assert.doesNotMatch(COMPUTE_PAGE_HTML, /id=["']tab-night["']/);
assert.doesNotMatch(COMPUTE_PAGE_HTML, /id=["']night-list["']/);
assert.match(COMPUTE_PAGE_HTML, /id=["']night-offer["']/);
assert.match(COMPUTE_PAGE_HTML, /id=["']queue-night["']/);
assert.match(COMPUTE_PAGE_HTML, /id=["']queue-night["'][^>]*>Queue</);
assert.doesNotMatch(COMPUTE_PAGE_HTML, /Queue for when a Mac is up/);
assert.match(COMPUTE_PAGE_HTML, /\/compute\/api\/night/);
assert.match(COMPUTE_PAGE_HTML, /'Running':'Queued'/);
assert.doesNotMatch(COMPUTE_PAGE_HTML, /Queued — runs when a Mac is up/);
assert.match(COMPUTE_PAGE_HTML, /showNightOffer/);
assert.match(COMPUTE_PAGE_HTML, /queueForMac/);
// first paint: offer starts hidden; no Night door in actions chrome
assert.match(COMPUTE_PAGE_HTML, /id=["']night-offer["'] hidden/);
assert.doesNotMatch(COMPUTE_PAGE_HTML, /id=["']pick-night["']/);
assert.match(COMPUTE_PAGE_HTML, /id=["']pick-provide["']/);
assert.match(COMPUTE_PAGE_HTML, /id=["']ocm-door["']/);

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'empty-night-queue-secret',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) { if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item); else rows.set(key, value); },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const token = await createSessionToken(env, { xId: 'night-q', handle: 'night_q' });
const res = await network.fetch(new Request('https://www.getdasha.com/compute/api/night', {
  method: 'POST',
  headers: { Cookie: `${COOKIE}=${token}`, 'Content-Type': 'application/json', Origin: 'https://www.getdasha.com' },
  body: JSON.stringify({ title: 'Ask later', prompt: 'Say hi when a Mac wakes.', template: 'custom', model: 'qwen3-8b', repeat: 'none' }),
}), 'https://www.getdasha.com');
assert.equal(res.status, 201, 'Night queue succeeds with 0 Macs');
const body = await res.json();
assert.equal(body.task.status, 'scheduled');
assert.equal(body.task.model, 'qwen3-8b');
assert.match(body.task.id, /^night_/);
assert.equal([...rows.keys()].some(k => k.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-empty-night-job: PASS');
