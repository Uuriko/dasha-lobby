import assert from 'node:assert/strict';
globalThis.WebSocketRequestResponsePair ||= class {};
import workerDefault, { DashaLobby } from './dasha-lobby-worker.mjs';
import { authSessionFromRequest } from './dasha-lobby-x.mjs';

function makeLobby(env) {
  const rows = new Map();
  const storage = {
    async get(key) { return rows.get(key); },
    async put(key, value) { rows.set(key, value); },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
    async getAlarm() { return Date.now(); }, async setAlarm() {},
  };
  let ready;
  const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
  return { lobby, ready, rows };
}

const originHeaders = { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
const EMAIL = 'fresh-mac-owner@example.com';

// ---- stub Resend ----
const realFetch = globalThis.fetch;
let resendCalls = [];
let resendBehavior = async () => new Response(JSON.stringify({ id: 'mail_123' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.resend.com/')) {
    resendCalls.push({ url: String(url), init });
    return resendBehavior(url, init);
  }
  return realFetch(url, init);
};

const env = {
  LOBBY_SESSION_SECRET: 'email-login-test-secret',
  ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
  RESEND_API_KEY: 're_test_key',
};
const { lobby, ready, rows } = makeLobby(env);
await ready;

// 1. start: sends a 6-digit code via Resend
const start = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
  method: 'POST', headers: originHeaders, body: JSON.stringify({ email: EMAIL }),
}));
assert.equal(start.status, 200, 'start 200');
assert.deepEqual(await start.json(), { ok: true, expiresIn: 600 });
assert.equal(resendCalls.length, 1, 'one resend call');
const resendBody = JSON.parse(resendCalls[0].init.body);
assert.deepEqual(resendBody.to, [EMAIL]);
assert.equal(resendCalls[0].init.headers.Authorization, 'Bearer re_test_key');
const code = resendBody.text.match(/\b(\d{6})\b/)[1];
assert.match(code, /^\d{6}$/);
// plaintext code never stored
const stored = rows.get('emailLogins')[EMAIL];
assert.ok(stored.codeHash && !JSON.stringify(stored).includes(code), 'hash only, no plaintext');

// 2. wrong code -> 401, attempts counted
const wrong = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/verify', {
  method: 'POST', headers: originHeaders, body: JSON.stringify({ email: EMAIL, code: code === '000000' ? '000001' : '000000' }),
}));
assert.equal(wrong.status, 401);
assert.equal(rows.get('emailLogins')[EMAIL].attempts, 1);

// 3. right code -> 200 + session cookie, one-time
const good = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/verify', {
  method: 'POST', headers: originHeaders, body: JSON.stringify({ email: EMAIL, code }),
}));
assert.equal(good.status, 200, 'verify 200');
const setCookie = good.headers.get('set-cookie') || '';
assert.match(setCookie, /Path=\//);
assert.match(setCookie, /HttpOnly/);
const cookiePair = setCookie.split(';')[0];
assert.equal(rows.has('emailLogins') && Boolean(rows.get('emailLogins')[EMAIL]), false, 'code consumed');
const replay = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/verify', {
  method: 'POST', headers: originHeaders, body: JSON.stringify({ email: EMAIL, code }),
}));
assert.equal(replay.status, 409, 'replay rejected');

// 4. session decodes as email provider; /auth/status surfaces it
const session = await authSessionFromRequest(env, new Request('https://lobby.getdasha.com/auth/status', { headers: { Cookie: cookiePair } }));
assert.deepEqual(session, { provider: 'email', email: EMAIL });
const statusRes = await workerDefault.fetch(new Request('https://lobby.getdasha.com/auth/status', { headers: { Origin: originHeaders.Origin, Cookie: cookiePair } }), env);
const statusBody = await statusRes.json();
assert.deepEqual(statusBody.email, { address: EMAIL });

// 5. bad email -> 400
const bad = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
  method: 'POST', headers: originHeaders, body: JSON.stringify({ email: 'not-an-email' }),
}));
assert.equal(bad.status, 400);

// 6. RESEND_API_KEY unset -> honest 503, no send
{
  const { lobby: noKey, ready: r2 } = makeLobby({ ...env, RESEND_API_KEY: '' });
  await r2;
  const before = resendCalls.length;
  const res = await noKey.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ email: EMAIL }),
  }));
  assert.equal(res.status, 503);
  assert.equal(resendCalls.length, before, 'no resend call without key');
}

// 7. Resend outage -> 502 and nothing stored
{
  const { lobby: downLobby, ready: r3, rows: downRows } = makeLobby(env);
  await r3;
  resendBehavior = async () => new Response('{"error":"down"}', { status: 500 });
  const res = await downLobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ email: EMAIL }),
  }));
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.match(body.error, /Could not send the sign-in code/);
  assert.equal(downRows.has('emailLogins') && Boolean(downRows.get('emailLogins')['mac@example.com']), false, 'nothing stored on send failure');
  resendBehavior = async () => new Response(JSON.stringify({ id: 'mail_123' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// 8. Persistent send cap: max 3 codes per 10 minutes per email
{
  const { lobby: capLobby, ready: r4 } = makeLobby(env);
  await r4;
  const capEmail = 'resend-cap@example.com';
  for (let i = 0; i < 3; i++) {
    const res = await capLobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
      method: 'POST', headers: originHeaders, body: JSON.stringify({ email: capEmail }),
    }));
    assert.equal(res.status, 200, `send ${i + 1} 200`);
  }
  const fourth = await capLobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ email: capEmail }),
  }));
  assert.equal(fourth.status, 429, '4th send capped');
  const fourthBody = await fourth.json();
  assert.ok(Number(fourthBody.waitMs) > 0, 'waitMs present');
}

// 9. Retry queue + classification: transient 500 -> queued; pump delivers after recovery;
//    config 401 -> never queued. All observable, browser copy stays generic.
{
  const { lobby: retryLobby, ready: r5, rows: retryRows } = makeLobby(env);
  await r5;
  const retryEmail = 'retry-flow@example.com';
  resendBehavior = async () => new Response('{"error":"boom"}', { status: 500 });
  const before = resendCalls.length;
  const res = await retryLobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ email: retryEmail }),
  }));
  assert.equal(res.status, 502);
  assert.equal(resendCalls.length, before + 1, 'one attempt');
  const metricKey = (n) => `compute:metric:${new Date().toISOString().slice(0, 10)}:${n}`;
  assert.equal(retryRows.get(metricKey('signin:fail:email')), 1, 'fail metric');
  assert.equal(retryRows.get(metricKey('signin:fail:email:transient')), 1, 'classified transient metric');
  assert.equal(retryRows.get(metricKey('mail:send:fail:transient')), 1, 'rail metric');
  assert.equal(retryRows.get(metricKey('mail:retry:queued')), 1, 'retry queued metric');
  const lastErr = retryRows.get('emailLoginLastError');
  assert.equal(lastErr.kind, 'transient', 'last error classified');
  assert.equal(lastErr.retryable, true, 'transient is retryable');
  assert.equal(retryRows.has('emailLogins') && Boolean(retryRows.get('emailLogins')[retryEmail]), false, 'pending login not stored before delivery');
  const queue = retryRows.get('mailRetryQueue');
  assert.equal(queue.length, 1, 'one retry entry');
  assert.equal(queue[0].kind, 'email-login', 'entry kind');
  assert.equal(queue[0].lastKind, 'transient', 'entry failure kind');
  assert.ok(queue[0].payload && queue[0].payload.login && queue[0].payload.login.codeHash, 'payload carries code hash, not plaintext');
  // plaintext code rests only inside the bounded queue entry (needed to deliver it)
  const queuedCode = queue[0].text.match(/\b(\d{6})\b/)[1];
  assert.match(queuedCode, /^\d{6}$/);

  // pump endpoint is internal-only
  const noGate = await retryLobby.fetch(new Request('https://lobby.getdasha.com/internal/mail/retry', { method: 'POST' }));
  assert.equal(noGate.status, 403, 'retry pump gated');
  const getPump = await retryLobby.fetch(new Request('https://lobby.getdasha.com/internal/mail/retry', {
    method: 'GET', headers: { 'x-dasha-internal': 'email-login-test-secret' },
  }));
  assert.equal(getPump.status, 405, 'pump is POST-only');

  // provider recovers; make the entry due and pump via the internal endpoint
  resendBehavior = async () => new Response(JSON.stringify({ id: 'mail_retry_ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  retryRows.get('mailRetryQueue')[0].nextAt = Date.now() - 1;
  const pump = await retryLobby.fetch(new Request('https://lobby.getdasha.com/internal/mail/retry', {
    method: 'POST', headers: { 'x-dasha-internal': 'email-login-test-secret' },
  }));
  assert.equal(pump.status, 200, 'pump 200');
  const pumpBody = await pump.json();
  assert.deepEqual([pumpBody.ok, pumpBody.sent, pumpBody.pending], [true, 1, 0], 'pump delivered');
  assert.equal(retryRows.has('mailRetryQueue'), false, 'queue drained');
  assert.equal(retryRows.get(metricKey('mail:send:ok')), 1, 'send ok metric on retry delivery');
  // pending login persisted on delivery (hash-only) and the delivered code verifies
  const stored = retryRows.get('emailLogins')[retryEmail];
  assert.ok(stored.codeHash && !JSON.stringify(stored).includes(queuedCode), 'hash only after delivery');
  const verify = await retryLobby.fetch(new Request('https://lobby.getdasha.com/auth/email/verify', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ email: retryEmail, code: queuedCode }),
  }));
  assert.equal(verify.status, 200, 'retried code verifies');

  // config failure (bad key): 502 honest copy, classified config, NEVER queued
  resendBehavior = async () => new Response(JSON.stringify({ name: 'invalid_api_key' }), { status: 401 });
  const cfg = await retryLobby.fetch(new Request('https://lobby.getdasha.com/auth/email/start', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ email: 'cfg-fail@example.com' }),
  }));
  assert.equal(cfg.status, 502);
  assert.match((await cfg.json()).error, /Could not send the sign-in code/);
  assert.equal(retryRows.get(metricKey('signin:fail:email:config')), 1, 'config classified');
  assert.equal(retryRows.get('emailLoginLastError').kind, 'config', 'last error config');
  assert.equal(retryRows.has('mailRetryQueue'), false, 'config failures never queued');
  resendBehavior = async () => new Response(JSON.stringify({ id: 'mail_123' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

globalThis.fetch = realFetch;
console.log('dasha-email-login.test.mjs: all assertions passed');
