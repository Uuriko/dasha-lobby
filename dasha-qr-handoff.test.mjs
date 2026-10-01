#!/usr/bin/env node
/** QR cross-device handoff: approve on old device, fresh session on new device. */
import assert from 'node:assert/strict';
globalThis.WebSocketRequestResponsePair ||= class {};
import { DashaLobby } from './dasha-lobby-worker.mjs';
import { createEmailSessionToken, authSessionFromRequest, COOKIE } from './dasha-lobby-x.mjs';

function makeLobby(env) {
  const rows = new Map();
  const storage = {
    async get(key) { return rows.get(key); },
    async put(key, value) { rows.set(key, value); },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
    async getAlarm() { return Date.now(); },
    async setAlarm() {},
  };
  let ready;
  const lobby = new DashaLobby(
    { storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } },
    env,
  );
  return { lobby, ready, rows };
}

const env = {
  LOBBY_SESSION_SECRET: 'test-only-handoff-secret-0123456789',
  ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
};
const originHeaders = { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
const OLD_EMAIL = 'old-device@example.com';

async function startHandoff(lobby) {
  const res = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/handoff/start', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({}),
  }));
  assert.equal(res.status, 200, 'start 200');
  const body = await res.json();
  assert.match(body.token, /^[A-Za-z0-9_-]{16,64}$/);
  assert.match(body.code, /^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
  assert.ok(body.approveUrl.includes(body.token), 'approveUrl carries token');
  assert.ok(body.qrSvg.includes('<svg'), 'qr svg returned');
  assert.equal(body.expiresIn, 120);
  assert.equal(body.poll, '/auth/handoff/status');
  // QR payload holds only the approval URL + opaque token: no session, no secret
  assert.ok(!body.qrSvg.includes('dasha_x') && !body.qrSvg.includes(OLD_EMAIL), 'qr has no credentials');
  const setCookie = res.headers.get('set-cookie') || '';
  assert.match(setCookie, /__Host-dasha_qr_handoff=/);
  assert.match(setCookie, /HttpOnly/);
  return { body, starterCookie: setCookie.split(';')[0] };
}

async function oldSessionCookie() {
  const token = await createEmailSessionToken(env, OLD_EMAIL);
  return `${COOKIE}=${token}`;
}

// ---- 1. happy path: start -> approve page -> approve -> status mints fresh session ----
{
  const { lobby, ready } = makeLobby(env);
  await ready;
  const { body, starterCookie } = await startHandoff(lobby);
  const oldCookie = await oldSessionCookie();

  // approve page requires a signed-in old device
  const anonPage = await lobby.fetch(new Request(`https://lobby.getdasha.com${new URL(body.approveUrl).pathname}?h=${body.token}`));
  assert.equal(anonPage.status, 401, 'approve page needs session');
  const page = await lobby.fetch(new Request(body.approveUrl, { headers: { Cookie: oldCookie } }));
  assert.equal(page.status, 200, 'approve page 200 for signed-in old device');
  const html = await page.text();
  assert.ok(html.includes(body.code), 'page shows matching code');
  assert.ok(html.includes('Approve sign-in'), 'page has approve control');
  assert.ok(html.includes('Deny'), 'page has deny control');

  // pending before approval: no session
  const pending = await lobby.fetch(new Request(
    `https://lobby.getdasha.com/auth/handoff/status?token=${body.token}`,
    { headers: { ...originHeaders, Cookie: starterCookie } },
  ));
  assert.deepEqual(await pending.json(), { state: 'pending' });
  assert.equal(pending.headers.get('set-cookie'), null, 'no session while pending');

  // decision requires a signed-in old device
  const anonDecision = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/handoff/decision', {
    method: 'POST', headers: originHeaders, body: JSON.stringify({ token: body.token, decision: 'approve' }),
  }));
  assert.equal(anonDecision.status, 401, 'decision needs session');
  const decision = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/handoff/decision', {
    method: 'POST', headers: { ...originHeaders, Cookie: oldCookie },
    body: JSON.stringify({ token: body.token, decision: 'approve' }),
  }));
  assert.equal(decision.status, 200);
  assert.deepEqual(await decision.json(), { ok: true, decision: 'approve' });

  // status without the starter cookie: approved but no session minted, not consumed
  const noCookie = await lobby.fetch(new Request(
    `https://lobby.getdasha.com/auth/handoff/status?token=${body.token}`, { headers: originHeaders },
  ));
  assert.deepEqual(await noCookie.json(), { state: 'ok' });
  assert.equal(noCookie.headers.get('set-cookie'), null, 'no session without starter cookie');

  // status with the starter cookie: fresh session, single use
  const done = await lobby.fetch(new Request(
    `https://lobby.getdasha.com/auth/handoff/status?token=${body.token}`,
    { headers: { ...originHeaders, Cookie: starterCookie } },
  ));
  assert.equal(done.status, 200);
  assert.deepEqual(await done.json(), { state: 'ok', provider: 'email' });
  const sessionCookie = (done.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(sessionCookie.startsWith(`${COOKIE}=`), 'fresh session cookie set');
  const session = await authSessionFromRequest(env, { headers: new Headers({ Cookie: sessionCookie }) });
  assert.deepEqual(session, { provider: 'email', email: OLD_EMAIL }, 'new session is for the approved identity');

  // replay: already consumed
  const replay = await lobby.fetch(new Request(
    `https://lobby.getdasha.com/auth/handoff/status?token=${body.token}`,
    { headers: { ...originHeaders, Cookie: starterCookie } },
  ));
  assert.deepEqual(await replay.json(), { state: 'expired' });
  assert.equal(replay.headers.get('set-cookie'), null, 'no session on replay');
}

// ---- 2. deny blocks redemption ----
{
  const { lobby, ready } = makeLobby(env);
  await ready;
  const { body, starterCookie } = await startHandoff(lobby);
  const oldCookie = await oldSessionCookie();
  const deny = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/handoff/decision', {
    method: 'POST', headers: { ...originHeaders, Cookie: oldCookie },
    body: JSON.stringify({ token: body.token, decision: 'deny' }),
  }));
  assert.deepEqual(await deny.json(), { ok: true, decision: 'deny' });
  const status = await lobby.fetch(new Request(
    `https://lobby.getdasha.com/auth/handoff/status?token=${body.token}`,
    { headers: { ...originHeaders, Cookie: starterCookie } },
  ));
  assert.deepEqual(await status.json(), { state: 'denied' });
  assert.equal(status.headers.get('set-cookie'), null, 'no session after deny');
}

// ---- 3. expiry (120s TTL) ----
{
  const { lobby, ready, rows } = makeLobby(env);
  await ready;
  const { body } = await startHandoff(lobby);
  const handoffs = rows.get('qrHandoffs');
  handoffs[body.token].exp = Date.now() - 1;
  await rows.set('qrHandoffs', handoffs);
  const status = await lobby.fetch(new Request(
    `https://lobby.getdasha.com/auth/handoff/status?token=${body.token}`, { headers: originHeaders },
  ));
  assert.deepEqual(await status.json(), { state: 'expired' });
  const page = await lobby.fetch(new Request(body.approveUrl, { headers: { Cookie: await oldSessionCookie() } }));
  assert.equal(page.status, 410, 'approve page 410 after expiry');
}

// ---- 4. tampered / unknown token ----
{
  const { lobby, ready } = makeLobby(env);
  await ready;
  const bad = await lobby.fetch(new Request(
    'https://lobby.getdasha.com/auth/handoff/status?token=AAAAAAAAAAAAAAAAAAAAAAAA', { headers: originHeaders },
  ));
  assert.deepEqual(await bad.json(), { state: 'expired' });
  const decision = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/handoff/decision', {
    method: 'POST', headers: { ...originHeaders, Cookie: await oldSessionCookie() },
    body: JSON.stringify({ token: 'AAAAAAAAAAAAAAAAAAAAAAAA', decision: 'approve' }),
  }));
  assert.equal(decision.status, 410);
  const malformed = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/handoff/decision', {
    method: 'POST', headers: { ...originHeaders, Cookie: await oldSessionCookie() },
    body: JSON.stringify({ token: 'not a token!!', decision: 'approve' }),
  }));
  assert.equal(malformed.status, 400);
}

// ---- 5. origin binding: starter cookie from another origin cannot redeem ----
{
  const { lobby, ready } = makeLobby(env);
  await ready;
  const { body } = await startHandoff(lobby); // origin https://www.getdasha.com
  const oldCookie = await oldSessionCookie();
  await lobby.fetch(new Request('https://lobby.getdasha.com/auth/handoff/decision', {
    method: 'POST', headers: { ...originHeaders, Cookie: oldCookie },
    body: JSON.stringify({ token: body.token, decision: 'approve' }),
  }));
  // forge a starter cookie signed for a different origin
  const { signPayload } = await import('./dasha-lobby-x.mjs');
  const forged = await signPayload(env.LOBBY_SESSION_SECRET, {
    kind: 'qr_handoff_start', token: body.token, nonce: 'wrong-nonce',
    origin: 'https://evil.example', exp: Date.now() + 60000,
  });
  const status = await lobby.fetch(new Request(
    `https://lobby.getdasha.com/auth/handoff/status?token=${body.token}`,
    { headers: { ...originHeaders, Cookie: `__Host-dasha_qr_handoff=${forged}` } },
  ));
  assert.deepEqual(await status.json(), { state: 'ok' });
  assert.equal(status.headers.get('set-cookie'), null, 'forged starter cookie mints nothing');
}

console.log('qr-handoff: all assertions passed');
