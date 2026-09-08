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
  assert.match(body.error, /email send failed/);
  assert.equal(downRows.has('emailLogins') && Boolean(downRows.get('emailLogins')['mac@example.com']), false, 'nothing stored on send failure');
  resendBehavior = async () => new Response(JSON.stringify({ id: 'mail_123' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

globalThis.fetch = realFetch;
console.log('dasha-email-login.test.mjs: all assertions passed');
