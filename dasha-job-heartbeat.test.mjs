#!/usr/bin/env node
/**
 * Lobby alarm heartbeat. The DashaLobby 5-minute alarm used to re-arm only on
 * success, so one throw could end the chain (chess clocks, compute job expiry,
 * Night Shift) with no signal. It now always re-arms, records lastSuccessAt /
 * lastError, and GET /compute/api/health/jobs exposes it (503 when stale or
 * failing). Disk only. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import worker, { DashaLobby } from './dasha-lobby-worker.mjs';
import { LOBBY_ALARM_HEARTBEAT_KEY, jobHealthBody, nextAlarmHeartbeat, redactJobError } from './dasha-job-heartbeat.mjs';

globalThis.WebSocketRequestResponsePair ||= class {};

function makeLobby(env) {
  const rows = new Map();
  const alarms = [];
  const storage = {
    async get(key) { return rows.get(key); },
    async put(key, value) {
      if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
      else rows.set(key, value);
    },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
    async getAlarm() { return alarms.at(-1) ?? null; },
    async setAlarm(at) { alarms.push(at); },
  };
  let ready;
  const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
  return { lobby, ready, rows, alarms };
}

const env = { LOBBY_SESSION_SECRET: 'job-heartbeat-test-secret', ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com' };

// Pure helpers
{
  const now = Date.parse('2026-09-24T22:00:00Z');
  assert.equal(jobHealthBody(undefined, now).status, 'stale', 'never-run alarm is stale');
  const ok = nextAlarmHeartbeat(undefined, { ok: true, at: now - 60_000 });
  assert.equal(jobHealthBody(ok, now).status, 'ok');
  assert.equal(jobHealthBody(ok, now + 15 * 60_000).status, 'stale', 'stale beyond 3x the 5-minute period');
  const bad = nextAlarmHeartbeat(ok, { ok: false, at: now, error: 'boom token=abc https://x.test/p?sig=1' });
  const view = jobHealthBody(bad, now);
  assert.equal(view.status, 'failing');
  assert.equal(view.jobs[0].consecutiveFailures, 1);
  assert.ok(!/abc|sig=1/.test(view.jobs[0].lastError), view.jobs[0].lastError);
  assert.ok(redactJobError('x'.repeat(999)).length <= 240);
}

// alarm() re-arms and records success
const { lobby, ready, rows, alarms } = makeLobby(env);
await ready;
alarms.length = 0;
await lobby.alarm();
assert.equal(alarms.length, 1, 'alarm re-armed after success');
assert.equal(rows.get(LOBBY_ALARM_HEARTBEAT_KEY).consecutiveFailures, 0);
assert.ok(Number.isFinite(rows.get(LOBBY_ALARM_HEARTBEAT_KEY).lastSuccessAt));

// alarm() still re-arms when the tick throws, and records the failure
const realPrune = lobby.compute.prune.bind(lobby.compute);
lobby.compute.prune = async () => { throw new Error('prune exploded'); };
const originalError = console.error; const logged = [];
console.error = (line) => logged.push(String(line));
try { await lobby.alarm(); } finally { console.error = originalError; }
assert.equal(alarms.length, 2, 'alarm re-armed even though the tick threw');
const failed = rows.get(LOBBY_ALARM_HEARTBEAT_KEY);
assert.equal(failed.consecutiveFailures, 1);
assert.match(failed.lastError, /prune exploded/);
assert.ok(logged.some((line) => line.startsWith('[lobby-alarm] tick failed')), 'failure is logged loudly');
lobby.compute.prune = realPrune;

// GET /compute/api/health/jobs through the Worker -> public lobby DO
const workerEnv = { ...env, LOBBY: { idFromName: () => 'public', get: () => ({ fetch: (request) => lobby.fetch(request) }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  let res = await worker.fetch(new Request(`https://${host}/compute/api/health/jobs`), workerEnv);
  assert.equal(res.status, 503, `${host} failing alarm -> 503`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  let body = await res.json();
  assert.equal(body.schema, 'dasha.job-health/1');
  assert.equal(body.jobs[0].name, 'lobby-alarm');
  assert.equal(body.status, 'failing');
}
await lobby.alarm();
{
  const res = await worker.fetch(new Request('https://www.getdasha.com/compute/api/health/jobs/'), workerEnv);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.jobs[0].consecutiveFailures, 0);
  const head = await worker.fetch(new Request('https://www.getdasha.com/compute/api/health/jobs', { method: 'HEAD' }), workerEnv);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
}
// Unbound DO -> 503 unavailable, never a fake ok
{
  const res = await worker.fetch(new Request('https://www.getdasha.com/compute/api/health/jobs'), env);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).status, 'unavailable');
}
// Healthz contract unchanged
{
  const res = await worker.fetch(new Request('https://www.getdasha.com/compute/api/healthz'), workerEnv);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
}
console.log('dasha-job-heartbeat: ok');
