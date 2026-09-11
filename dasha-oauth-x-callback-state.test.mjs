#!/usr/bin/env node
/**
 * P0: Provide / Link X callback crashed with
 * "Could not link X" + "Cannot read properties of undefined (reading 'state')".
 * handleOAuth is a Worker free function; it used this.state after a good
 * token exchange, so the session cookie was never set.
 * Disk only. Never plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, {
  bumpLobbyMetric,
  oauthLinkErrorMessage,
} from './dasha-lobby-worker.mjs';
import { COOKIE, signPayload } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const oauthSrc = workerSrc.slice(
  workerSrc.indexOf('async function handleOAuth'),
  workerSrc.indexOf('async function handleGithubOAuth'),
);
assert.ok(oauthSrc.includes('async function handleOAuth'), 'handleOAuth slice');
assert.doesNotMatch(oauthSrc, /this\.state\.storage/, 'X OAuth must not read room DO storage (Worker isolate has none)');
assert.doesNotMatch(oauthSrc, /bumpLobbyMetric\(this/, 'X sign-in metric must not use this');
assert.match(oauthSrc, /st\?\.state/, 'callback uses optional state on the signed cookie payload');

const SECRET = 'oauth-x-callback-state-secret';
const envBase = {
  X_CLIENT_ID: 'oauth-x-test-client',
  X_CLIENT_SECRET: 'oauth-x-test-secret',
  LOBBY_SESSION_SECRET: SECRET,
};

function memoryStorage() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.get(key); },
    async put(key, value) { map.set(key, value); },
  };
}

async function callback(url, { cookie, env } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  return worker.fetch(new Request(url, { headers }), env || envBase);
}

async function signedStateCookie(state, verifier, extra = {}) {
  const token = await signPayload(SECRET, {
    v: 1,
    kind: 'oauth_state',
    state,
    verifier,
    exp: Date.now() + 15 * 60_000,
    ...extra,
  });
  return `__Host-dasha_x_oauth=${token}`;
}

function installXFetch({ tokenOk = true, userOk = true, handle = 'ihwylie' } = {}) {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/oauth2/token')) {
      if (!tokenOk) {
        return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'code expired' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ access_token: 'x-access-test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (href.includes('/users/me')) {
      if (!userOk) {
        return new Response(JSON.stringify({ title: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        data: {
          id: '42',
          username: handle,
          name: 'Ian',
          created_at: '2018-01-01T00:00:00.000Z',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('unexpected fetch', { status: 599 });
  };
  return () => { globalThis.fetch = prev; };
}

assert.equal(
  oauthLinkErrorMessage(new TypeError("Cannot read properties of undefined (reading 'state')")),
  'Link failed. Try again.',
  'TypeError reading state stays a short honest error',
);
assert.equal(oauthLinkErrorMessage(new Error('code expired')), 'code expired');

await assert.doesNotReject(() => bumpLobbyMetric(undefined, 'signin:success:x'));
await assert.doesNotReject(() => bumpLobbyMetric(null, 'signin:success:x'));
await assert.doesNotReject(() => bumpLobbyMetric({}, 'signin:success:x'));
const store = memoryStorage();
await bumpLobbyMetric(store, 'signin:success:x');
assert.equal([...store.map.values()].reduce((n, v) => n + Number(v), 0), 1, 'real storage still increments');

const missingState = await callback('https://lobby.getdasha.com/oauth/x/callback?code=abc');
assert.equal(missingState.status, 400, 'missing URL state is 400 not 502');
const missingStateBody = await missingState.text();
assert.match(missingStateBody, /Invalid OAuth state/);
assert.doesNotMatch(missingStateBody, /reading ['"]state['"]/);
assert.doesNotMatch(missingStateBody, /Cannot read propert/);

const missingCookie = await callback('https://lobby.getdasha.com/oauth/x/callback?code=abc&state=xyz');
assert.equal(missingCookie.status, 400, 'missing signed cookie is 400');
const missingCookieBody = await missingCookie.text();
assert.match(missingCookieBody, /Invalid OAuth state/);
assert.doesNotMatch(missingCookieBody, /reading ['"]state['"]/);

const restoreOk = installXFetch();
const state = 'state-ok-1';
const cookie = await signedStateCookie(state, 'verifier-ok-1');
const linked = await callback(
  `https://lobby.getdasha.com/oauth/x/callback?code=good&state=${state}`,
  { cookie },
);
const linkedBody = await linked.text();
restoreOk();
assert.equal(linked.status, 200, 'valid callback links without this.state');
assert.match(linkedBody, /Linked @ihwylie/);
assert.doesNotMatch(linkedBody, /Could not link X/);
assert.doesNotMatch(linkedBody, /reading ['"]state['"]/);
assert.match(String(linked.headers.get('set-cookie') || linked.headers.getSetCookie?.().join('\n') || ''), new RegExp(COOKIE));

const metricStore = memoryStorage();
const restoreMetric = installXFetch({ handle: 'potter' });
const state2 = 'state-ok-2';
const linkedMetric = await callback(
  `https://lobby.getdasha.com/oauth/x/callback?code=good2&state=${state2}`,
  {
    cookie: await signedStateCookie(state2, 'verifier-ok-2'),
    env: { ...envBase, __lobbyMetricStorage: metricStore },
  },
);
restoreMetric();
assert.equal(linkedMetric.status, 200, 'optional metric storage does not break link');
assert.match(await linkedMetric.text(), /Linked @potter/);
assert.equal([...metricStore.map.values()].reduce((n, v) => n + Number(v), 0), 1, 'X sign-in metric bumps when storage is provided');

const restoreFail = installXFetch({ tokenOk: false });
const state3 = 'state-fail-1';
const failed = await callback(
  `https://lobby.getdasha.com/oauth/x/callback?code=bad&state=${state3}`,
  { cookie: await signedStateCookie(state3, 'verifier-fail-1') },
);
const failedBody = await failed.text();
restoreFail();
assert.equal(failed.status, 502, 'honest provider failure stays 502');
assert.match(failedBody, /Could not link X/);
assert.match(failedBody, /code expired/);
assert.doesNotMatch(failedBody, /reading ['"]state['"]/);

console.log('dasha-oauth-x-callback-state: PASS (undefined this.state no crash; missing state 400; good callback 200)');
