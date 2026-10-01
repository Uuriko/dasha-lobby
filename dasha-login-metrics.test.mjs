#!/usr/bin/env node
/**
 * Login observability tests (TASKS.md theme e: tasks 40 + 43).
 * - dasha-login-metrics.mjs unit: whitelist validation, PII-free logging,
 *   latency histograms, alerting thresholds, worker->DO forwarding.
 * - DO integration: semantic funnel events + automatic completion/latency on
 *   the /auth/* routes, internal /auth/__login-metrics ingest rules.
 * - Perf budget: /login HTML size, SRI, no render-blocking JS.
 * No network. No wrangler. No deploys.
 */
import assert from 'node:assert/strict';
globalThis.WebSocketRequestResponsePair ||= class {};
import workerDefault, { DashaLobby } from './dasha-lobby-worker.mjs';
import {
  recordLoginEvent,
  recordWorkerLoginMetric,
  evaluateLoginAlerts,
  listLoginAlerts,
  readLoginMetrics,
  readMethodOutcomes,
  loginObservedRoute,
  loginCompletionOutcome,
  ALERT_MIN_TERMINAL,
  ALERT_SUCCESS_RATE_FLOOR,
  ALERT_PROVIDER_ERROR_MIN,
} from './dasha-login-metrics.mjs';

function memoryStorage() {
  const map = new Map();
  return {
    map,
    async get(k) { return map.get(k); },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
    async list({ prefix = '' } = {}) { return new Map([...map].filter(([k]) => k.startsWith(prefix))); },
  };
}

// ---------- unit: validation ----------

const bad = await recordLoginEvent(memoryStorage(), { method: 'nope', route: 'start', outcome: 'start' });
assert.equal(bad, false, 'unknown method dropped');
assert.equal(await recordLoginEvent(memoryStorage(), { method: 'email', route: 'nope', outcome: 'start' }), false, 'unknown route dropped');
assert.equal(await recordLoginEvent(memoryStorage(), { method: 'email', route: 'start', outcome: 'nope' }), false, 'unknown outcome dropped');
assert.equal(await recordLoginEvent(memoryStorage(), null), false, 'null event dropped');
assert.equal(await recordLoginEvent(undefined, { method: 'email', route: 'start', outcome: 'start' }), false, 'missing storage -> false');
assert.equal(await recordLoginEvent(null, { method: 'email', route: 'start', outcome: 'start' }), false, 'null storage -> false');
assert.equal(await recordLoginEvent({}, { method: 'email', route: 'start', outcome: 'start' }), false, 'storage without get/put -> false');

// ---------- unit: PII-free ----------

{
  const store = memoryStorage();
  const ok = await recordLoginEvent(store, {
    method: 'email', route: 'start', outcome: 'provider-error', latencyMs: 42,
    email: 'victim@example.com', token: 'secret-token', ip: '1.2.3.4', handle: '@someone',
  });
  assert.equal(ok, true, 'event with extra fields still records the aggregate');
  const dump = JSON.stringify([...store.map.values()]);
  assert.doesNotMatch(dump, /victim@example\.com/, 'email never stored');
  assert.doesNotMatch(dump, /secret-token/, 'token never stored');
  assert.doesNotMatch(dump, /1\.2\.3\.4/, 'ip never stored');
  assert.doesNotMatch(dump, /@someone/, 'handle never stored');
}

// ---------- unit: counters + cumulative latency histogram ----------

{
  const store = memoryStorage();
  await recordLoginEvent(store, { method: 'wallet', route: 'verify', outcome: 'success', latencyMs: 120 });
  await recordLoginEvent(store, { method: 'wallet', route: 'verify', outcome: 'success', latencyMs: 3000 });
  const c = await readLoginMetrics(store);
  assert.equal(c['wallet:verify:success'], 2, 'event counter');
  assert.equal(c['lat:wallet:verify:count'], 2, 'latency observation count');
  assert.equal(c['lat:wallet:verify:le50'] || 0, 0, '120ms not in le50');
  assert.equal(c['lat:wallet:verify:le100'] || 0, 0, '120ms not in le100');
  assert.equal(c['lat:wallet:verify:le250'], 1, '120ms in le250 (cumulative)');
  assert.equal(c['lat:wallet:verify:le5000'], 2, 'both observations in le5000');
  assert.equal(c['lat:wallet:verify:le10000'], 2, 'both observations in le10000');
  // latency omitted / out of range: event records, no histogram
  await recordLoginEvent(store, { method: 'wallet', route: 'verify', outcome: 'fail' });
  await recordLoginEvent(store, { method: 'wallet', route: 'verify', outcome: 'fail', latencyMs: -5 });
  await recordLoginEvent(store, { method: 'wallet', route: 'verify', outcome: 'fail', latencyMs: 99999999 });
  const c2 = await readLoginMetrics(store);
  assert.equal(c2['wallet:verify:fail'], 3, 'fail events recorded');
  assert.equal(c2['lat:wallet:verify:count'], 2, 'no histogram rows for missing/bad latency');
}

// ---------- unit: route/outcome mapping ----------

assert.deepEqual(loginObservedRoute('/auth/email/start'), ['email', 'start'], 'route map');
assert.deepEqual(loginObservedRoute('/auth/email/start/'), ['email', 'start'], 'trailing slash');
assert.deepEqual(loginObservedRoute('/oauth/x/callback'), ['x', 'callback'], 'x callback map');
assert.deepEqual(loginObservedRoute('/login'), ['login', 'page'], 'login page map');
assert.equal(loginObservedRoute('/nope'), null, 'unmapped route');
assert.equal(loginCompletionOutcome(200), 'ok', '2xx -> ok');
assert.equal(loginCompletionOutcome(302), 'ok', '302 start redirect -> ok');
assert.equal(loginCompletionOutcome(400), 'client-error', '4xx');
assert.equal(loginCompletionOutcome(429), 'client-error', '429 is client-error');
assert.equal(loginCompletionOutcome(502), 'server-error', '5xx');

// ---------- unit: alerting ----------

{
  // success-rate drop: 1/5 = 20% < 50% floor, terminal >= 5
  const store = memoryStorage();
  await recordLoginEvent(store, { method: 'email', route: 'verify', outcome: 'success', latencyMs: 10 });
  for (let i = 0; i < 4; i++) await recordLoginEvent(store, { method: 'email', route: 'verify', outcome: 'fail', latencyMs: 10 });
  const raised = await listLoginAlerts(store);
  assert.equal(raised.length, 1, 'alerting hook raised the alert during recording');
  assert.equal(raised[0].kind, 'success-rate-drop', 'kind');
  assert.equal(raised[0].rate, 0.2, 'rate recorded');
  assert.equal(raised[0].method, 'email', 'alert method');
  const alerts = await evaluateLoginAlerts(store, { method: 'email' });
  assert.equal(alerts.length, 1, 'one alert');
  assert.equal(alerts[0].fresh, false, 'same-day re-evaluation is idempotent');
  const listed = await listLoginAlerts(store);
  assert.equal(listed.length, 1, 'no duplicate alert row');
}
{
  // healthy method: no alert
  const store = memoryStorage();
  for (let i = 0; i < 5; i++) await recordLoginEvent(store, { method: 'x', route: 'callback', outcome: 'success', latencyMs: 10 });
  assert.deepEqual(await evaluateLoginAlerts(store, { method: 'x' }), [], 'healthy method raises nothing');
}
{
  // below minimum terminal volume: no alert even at 0% success
  const store = memoryStorage();
  for (let i = 0; i < ALERT_MIN_TERMINAL - 1; i++) await recordLoginEvent(store, { method: 'grok', route: 'status', outcome: 'fail', latencyMs: 10 });
  assert.deepEqual(await evaluateLoginAlerts(store, { method: 'grok' }), [], 'low volume stays quiet');
}
{
  // provider-error spike: the quiet-failure hook (e.g. Resend dying silently)
  const store = memoryStorage();
  for (let i = 0; i < ALERT_PROVIDER_ERROR_MIN; i++) await recordLoginEvent(store, { method: 'email', route: 'start', outcome: 'provider-error', latencyMs: 10 });
  const alerts = await evaluateLoginAlerts(store, { method: 'email' });
  assert.ok(alerts.some((a) => a.kind === 'provider-errors'), 'provider-error spike raises alert');
}
{
  // readMethodOutcomes aggregation across routes
  const store = memoryStorage();
  await recordLoginEvent(store, { method: 'email', route: 'start', outcome: 'start' });
  await recordLoginEvent(store, { method: 'email', route: 'verify', outcome: 'success' });
  await recordLoginEvent(store, { method: 'wallet', route: 'verify', outcome: 'success' });
  const o = await readMethodOutcomes(store, { method: 'email' });
  assert.deepEqual(o, { start: 1, success: 1, fail: 0, 'provider-error': 0, 'rate-limited': 0 }, 'per-method aggregation');
}

// ---------- recordWorkerLoginMetric ----------

{
  // direct storage path (tests)
  const store = memoryStorage();
  assert.equal(await recordWorkerLoginMetric({ __lobbyMetricStorage: store }, { method: 'x', route: 'callback', outcome: 'success', latencyMs: 5 }), true);
  const c = await readLoginMetrics(store);
  assert.equal(c['x:callback:success'], 1, 'direct write path');
}
{
  // forwarding path via fake LOBBY stub: only whitelisted fields cross
  let seen = null;
  const fakeStub = {
    async fetch(req) {
      seen = { url: req.url, method: req.method, body: JSON.parse(await req.text()) };
      return { ok: true };
    },
  };
  const fakeLobby = { idFromName: (n) => n, get: () => fakeStub };
  const ok = await recordWorkerLoginMetric({ LOBBY: fakeLobby }, {
    method: 'google', route: 'callback', outcome: 'provider-error', latencyMs: 7,
    email: 'victim@example.com', token: 'sekret',
  });
  assert.equal(ok, true, 'forward ok');
  assert.equal(seen.url, 'https://internal/auth/__login-metrics', 'internal ingest route');
  assert.equal(seen.method, 'POST', 'POST');
  assert.deepEqual(Object.keys(seen.body).sort(), ['latencyMs', 'method', 'outcome', 'route'], 'only whitelisted fields forwarded');
  assert.equal(seen.body.method, 'google', 'method forwarded');
}
assert.equal(await recordWorkerLoginMetric({}, { method: 'x', route: 'start', outcome: 'start' }), false, 'no bindings -> false');
assert.equal(await recordWorkerLoginMetric(null, null), false, 'null-safe');

// ---------- DO integration ----------

function makeLobby(env) {
  const rows = new Map();
  const storage = {
    async get(key) { return rows.get(key); },
    async put(key, value) { rows.set(key, value); },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
    async getAlarm() { return Date.now(); },
    async setAlarm() {},
  };
  let ready;
  const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
  return { lobby, ready, rows };
}

const originHeaders = { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
const env = {
  LOBBY_SESSION_SECRET: 'login-metrics-test-secret',
  ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
  RESEND_API_KEY: 're_test_key',
};

const realFetch = globalThis.fetch;
let resendBehavior = async () => new Response(JSON.stringify({ id: 'mail_123' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.resend.com/')) return resendBehavior(url, init);
  return realFetch(url, init);
};

async function counters(lobbyRows) {
  const store = { async get(k) { return lobbyRows.get(k); } };
  return readLoginMetrics(store);
}

{ // email/start provider failure -> 502 + provider-error event (quiet-failure signal)
  const { lobby, ready, rows } = makeLobby(env);
  await ready;
  resendBehavior = async () => new Response(JSON.stringify({ message: 'provider down' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  const r = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ email: 'quiet-fail@example.com' }),
  }));
  assert.equal(r.status, 502, 'resend failure stays 502');
  const c = await counters(rows);
  assert.equal(c['email:start:provider-error'], 1, 'provider-error funnel event recorded');
  assert.equal(c['email:start:server-error'], 1, 'automatic completion outcome recorded');
  assert.ok(c['lat:email:start:count'] >= 1, 'latency histogram observed');
  const alerts = await listLoginAlerts({ async get(k) { return rows.get(k); }, async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); } });
  assert.ok(Array.isArray(alerts), 'alerts readable');
}

{ // email/start success -> start event
  const { lobby, ready, rows } = makeLobby(env);
  await ready;
  resendBehavior = async () => new Response(JSON.stringify({ id: 'mail_123' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const r = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ email: 'ok-user@example.com' }),
  }));
  assert.equal(r.status, 200, 'start 200');
  const c = await counters(rows);
  assert.equal(c['email:start:start'], 1, 'start funnel event recorded');
  assert.equal(c['email:start:ok'], 1, 'completion ok recorded');
}

{ // wallet/challenge success -> start event + completion
  const { lobby, ready, rows } = makeLobby(env);
  await ready;
  const r = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/wallet/challenge', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ publicKey: '11111111111111111111111111111111' }),
  }));
  assert.equal(r.status, 200, 'challenge 200');
  const c = await counters(rows);
  assert.equal(c['wallet:challenge:start'], 1, 'wallet start event recorded');
  assert.equal(c['wallet:challenge:ok'], 1, 'wallet completion ok recorded');
  assert.ok(c['lat:wallet:challenge:count'] >= 1, 'wallet latency observed');
}

{ // wallet/challenge invalid address -> 400 + completion client-error
  const { lobby, ready, rows } = makeLobby(env);
  await ready;
  const r = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/wallet/challenge', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ publicKey: 'not-an-address' }),
  }));
  assert.equal(r.status, 400, 'bad address 400');
  const c = await counters(rows);
  assert.equal(c['wallet:challenge:client-error'], 1, 'completion client-error recorded');
}

{ // internal ingest route rules
  const { lobby, ready, rows } = makeLobby(env);
  await ready;
  const post = (body, headers = {}) => lobby.fetch(new Request('https://lobby.getdasha.com/auth/__login-metrics', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  }));
  const browserLike = await post({ method: 'x', route: 'start', outcome: 'start' }, { Origin: 'https://www.getdasha.com' });
  assert.equal(browserLike.status, 403, 'browser-like POST with Origin rejected');
  const badPayload = await post({ method: 'x', route: 'start', outcome: 'nope' });
  assert.equal(badPayload.status, 400, 'invalid outcome rejected');
  const good = await post({ method: 'x', route: 'start', outcome: 'start', latencyMs: 3, email: 'sneaky@example.com' });
  assert.equal(good.status, 200, 'valid internal event accepted');
  const c = await counters(rows);
  assert.equal(c['x:start:start'], 1, 'forwarded event recorded');
  assert.doesNotMatch(JSON.stringify([...rows.values()]), /sneaky@example\.com/, 'no PII stored via ingest');
  const get = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/__login-metrics', { method: 'GET' }));
  assert.equal(get.status, 405, 'GET rejected');
}

globalThis.fetch = realFetch;

// ---------- perf budget: /login page ----------

{
  const res = await workerDefault.fetch(new Request('https://www.getdasha.com/login'), {
    ALLOWED_ORIGINS: 'https://www.getdasha.com',
  });
  assert.equal(res.status, 200, '/login 200');
  const html = await res.text();
  assert.ok(html.length < 40 * 1024, `login HTML under 40KB budget (got ${html.length} bytes)`);
  assert.doesNotMatch(html, /__X_CONNECT_SRI__/, 'no unresolved SRI placeholder');
  assert.match(html, /integrity="sha384-[A-Za-z0-9+/=]+"/, 'real SRI hash on client script');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.doesNotMatch(head, /<script/i, 'no render-blocking scripts in <head>');
  for (const m of html.matchAll(/<script[^>]*\bsrc=[^>]*>/gi)) {
    assert.match(m[0], /\b(defer|async)\b/, `external script is deferred: ${m[0].slice(0, 60)}`);
  }
}

console.log('dasha-login-metrics: PASS (validation, PII-free, histograms, alerting, forwarding, DO integration, perf budget)');
