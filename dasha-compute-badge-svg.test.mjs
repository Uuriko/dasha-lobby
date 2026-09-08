#!/usr/bin/env node
/**
 * Compute status badge (task 23): /compute/badge.svg serves a public SVG of
 * providers_online with a 60s cache, aggregate count only, singular/plural honest.
 */
import assert from 'node:assert/strict';
import { ComputeNetwork, computeBadgeSvg } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-badge-test-secret',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) {
    return new Map([...rows].filter(([key]) => key.startsWith(prefix)));
  },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';

// zero providers -> honest 0
let res = await network.fetch(new Request('https://lobby.getdasha.com/compute/badge.svg'), origin);
assert.equal(res.status, 200, 'badge 200');
assert.equal(res.headers.get('Content-Type'), 'image/svg+xml; charset=utf-8');
assert.equal(res.headers.get('Cache-Control'), 'public, max-age=60', '60s cache');
assert.equal(res.headers.get('Cross-Origin-Resource-Policy'), 'cross-origin', 'embeddable');
assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
let body = await res.text();
assert.match(body, /^<svg /);
assert.ok(body.includes('>0 Macs online<'), 'zero state honest');

// HEAD: no body, same headers
res = await network.fetch(new Request('https://lobby.getdasha.com/compute/badge.svg', { method: 'HEAD' }), origin);
assert.equal(res.status, 200);
assert.equal(await res.text(), '', 'HEAD empty body');
assert.equal(res.headers.get('Cache-Control'), 'public, max-age=60');

// register one provider + heartbeat -> 1 Mac online (singular)
const session = await createSessionToken(env, { xId: '77', handle: 'badge_mac' });
const register = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST',
  headers: { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Badge Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(register.status, 201);
const credentials = await register.json();
const hb = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/verify', {
  method: 'POST',
  headers: { Authorization: `Bearer ${credentials.provider_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider_id: credentials.provider_id, name: 'Badge Mac', models: ['qwen3-8b'] }),
}), origin);
assert.ok(hb.status < 300, 'verify accepted');
const poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST',
  headers: { Authorization: `Bearer ${credentials.provider_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider_id: credentials.provider_id, name: 'Badge Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(poll.status, 204, 'poll (advertise) accepted');

res = await network.fetch(new Request('https://lobby.getdasha.com/compute/badge.svg'), origin);
body = await res.text();
assert.ok(body.includes('>1 Mac online<'), 'singular label');
assert.ok(!body.includes(credentials.provider_id), 'no provider id leaks');
assert.ok(!body.includes('badge_mac'), 'no account data leaks');

// builder sanity: plural + clamp
assert.ok(computeBadgeSvg(3).includes('>3 Macs online<'));
assert.ok(computeBadgeSvg(-5).includes('>0 Macs online<'));
assert.ok(computeBadgeSvg('nope').includes('>0 Macs online<'));

console.log('dasha-compute-badge-svg: PASS');
