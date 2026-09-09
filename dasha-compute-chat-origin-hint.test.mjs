#!/usr/bin/env node
/**
 * Fail-loud Origin CSRF for Hosted session chat: same 403, plus a short hint.
 * GET /compute/api advertises the browser-session vs API-key split.
 */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { computeApi, ComputeNetwork, ORIGIN_REQUIRED, ORIGIN_REQUIRED_HINT } from './dasha-compute-network.mjs';

const env = { LOBBY_SESSION_SECRET: 'chat-origin-hint-secret', AI: { run: async () => ({ response: 'ok' }) } };
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
const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
const chatBody = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] });

assert.equal(ORIGIN_REQUIRED.error, 'origin required');
assert.equal(ORIGIN_REQUIRED.hint, ORIGIN_REQUIRED_HINT);
assert.match(ORIGIN_REQUIRED_HINT, /Origin from getdasha\.com/);
assert.match(ORIGIN_REQUIRED_HINT, /\/compute\/api\/v1\/chat\/completions/);
assert.doesNotMatch(ORIGIN_REQUIRED_HINT, /plugin\.jup\.ag/);

async function pair(host, path, init, fetchImpl) {
  const a = await fetchImpl(new Request(`https://${host}${path}`, init));
  const slash = path.endsWith('/') ? path.slice(0, -1) : path + '/';
  const b = await fetchImpl(new Request(`https://${host}${slash}`, init));
  const aText = await a.text();
  const bText = await b.text();
  assert.equal(a.status, b.status, `${host} ${path} status parity`);
  assert.equal(a.headers.get('content-type'), b.headers.get('content-type'), `${host} ${path} type parity`);
  assert.equal(aText, bText, `${host} ${path} body parity`);
  assert.match(a.headers.get('content-type') || '', /application\/json/);
  return { status: a.status, body: aText ? JSON.parse(aText) : null };
}

for (const path of ['/compute/api/chat', '/compute/api/chat/']) {
  const noOrigin = await pair('lobby.getdasha.com', path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: chatBody,
  }, (req) => computeApi(req, env, null));
  assert.equal(noOrigin.status, 403, `${path} no Origin stays 403`);
  assert.deepEqual(noOrigin.body, {
    error: 'origin required',
    hint: 'Browser session needs Origin from getdasha.com. API keys use POST /compute/api/v1/chat/completions.',
  });

  const withOrigin = await computeApi(new Request(`https://lobby.getdasha.com${path}`, {
    method: 'POST',
    headers: { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' },
    body: chatBody,
  }), env, 'https://www.getdasha.com');
  assert.equal(withOrigin.status, 401, `${path} Origin + no login stays 401`);
  assert.deepEqual(await withOrigin.json(), { error: 'login required' });
}

for (const path of ['/compute/api', '/compute/api/']) {
  const root = await computeApi(new Request(`https://www.getdasha.com${path}`), env, null);
  assert.equal(root.status, 200, `${path} GET`);
  const body = await root.json();
  assert.equal(body.session_chat, ORIGIN_REQUIRED_HINT, `${path} session_chat`);
  assert.equal(body.login_required, true);
  assert.equal(typeof body.usage, 'string');
  assert.equal(typeof body.billing, 'object');
}

const netRoot = await network.fetch(new Request('https://lobby.getdasha.com/compute/api'));
assert.equal(netRoot.status, 200);
assert.equal((await netRoot.json()).session_chat, ORIGIN_REQUIRED_HINT, 'ComputeNetwork /compute/api session_chat');

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const wNoOrigin = await pair(host, '/compute/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: chatBody,
  }, (request) => worker.fetch(request, workerEnv));
  assert.equal(wNoOrigin.status, 403, `${host} POST /compute/api/chat no Origin`);
  assert.deepEqual(wNoOrigin.body, ORIGIN_REQUIRED);

  const wRoot = await worker.fetch(new Request(`https://${host}/compute/api`), workerEnv);
  assert.equal(wRoot.status, 200, `${host} GET /compute/api`);
  const wBody = await wRoot.json();
  assert.equal(wBody.session_chat, ORIGIN_REQUIRED_HINT, `${host} /compute/api session_chat`);
  assert.equal(wBody.login_required, true);
}

assert.equal([...rows.keys()].some(key => key.startsWith('compute:provider:')), false, 'must not invent Macs');
console.log('dasha-compute-chat-origin-hint: PASS (403 hint + GET /compute/api session_chat; security unchanged)');
