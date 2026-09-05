#!/usr/bin/env node
/** Sign in with Grok Bot — disk only. No publish. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  DashaLobby,
  GROK_BOT_JSON,
  SIWG_BUTTON_HTML,
  mintGrokPairCode,
  normalizeGrokPairCode,
  orderHomeLongPage,
  stripRetiredProductDoors,
} from './dasha-lobby-worker.mjs';
import { LOGIN_PAGE_HTML, X_CONNECT_JS } from './dasha-lobby-static-gen.mjs';
import {
  COOKIE,
  GROK_START_COOKIE,
  createGrokSessionToken,
} from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const loginSrc = readFileSync(join(root, 'dasha-login-page.html'), 'utf8');
const clientSrc = readFileSync(join(root, 'dasha-x-connect-prompt.js'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

function buttonOnly(html) {
  const m = String(html).match(/<a class="siwg"[\s\S]*?<\/a>/);
  return m ? m[0] : '';
}

function assertSiwgMarkup(html, label) {
  assert.match(html, /Sign in with Grok Bot/, `${label} label`);
  assert.match(html, /data-grok-login/, `${label} hook`);
  assert.match(html, /href="\/login#grok"/, `${label} href`);
  const btn = buttonOnly(html);
  assert.ok(btn, `${label} button`);
  assert.doesNotMatch(btn, /twimg|pbs\.twimg|platform\.twitter|twitter-tweet/i, `${label} no twimg/embed`);
  assert.doesNotMatch(btn, /x\.com/i, `${label} button is not an X embed`);
}

assertSiwgMarkup(loginSrc, 'login source');
assertSiwgMarkup(LOGIN_PAGE_HTML, 'LOGIN_PAGE_HTML');
assertSiwgMarkup(SIWG_BUTTON_HTML, 'shared button');
assert.match(loginSrc, /linear-gradient\(90deg,#7c3aed,#22d3ee\)/);
assert.match(LOGIN_PAGE_HTML, /linear-gradient\(90deg,#7c3aed,#22d3ee\)/);

const methods = loginSrc.split('data-login-methods')[1] || '';
assert.ok(methods.indexOf('data-grok-login') < methods.indexOf('data-x-login'), 'SIWG is first method');
assert.ok(methods.indexOf('data-x-login') < methods.indexOf('data-wallet-login'), 'X before wallet');

assert.match(clientSrc, /\/auth\/grok\/start/);
assert.match(clientSrc, /Logged in with Grok Bot\./);
assert.match(clientSrc, /location\.hash === '#grok'/);
assert.match(X_CONNECT_JS, /\/auth\/grok\/start/);
assert.match(X_CONNECT_JS, /Logged in with Grok Bot\./);
assert.match(LOGIN_PAGE_HTML, /data-grok-login/);
assert.match(LOGIN_PAGE_HTML, /Sign in with Grok Bot/);
assert.match(loginSrc, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112/);
assert.match(loginSrc, />Buy</, 'login leftover is Buy, not How to buy');
assert.match(LOGIN_PAGE_HTML, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112/);
assert.match(LOGIN_PAGE_HTML, />Buy</);
assert.doesNotMatch(loginSrc, /How to buy/);
assert.doesNotMatch(LOGIN_PAGE_HTML, /How to buy/);
assert.doesNotMatch(loginSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(LOGIN_PAGE_HTML, /plugin\.jup\.ag/);


assert.equal(normalizeGrokPairCode('abcd-efgh'), 'ABCD-EFGH');
assert.equal(normalizeGrokPairCode('ABCDEFGH'), 'ABCD-EFGH');
assert.equal(normalizeGrokPairCode('ILOUXXXX'), '');
assert.match(mintGrokPairCode(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7])), /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);

{
  const html = orderHomeLongPage('<main><header id="content">hero</header><section id="grwm">GRWM</section></main>');
  const grokAt = html.indexOf('id="grok-door"');
  const grwmAt = html.indexOf('id="grwm"');
  const chatAt = html.indexOf('id="chat-door"');
  const simpAt = html.indexOf('id="simp-door"');
  assert.ok(chatAt >= 0 && simpAt > chatAt, 'chat then simp');
  assert.ok(grwmAt > simpAt, 'grwm after first-paint doors');
  assert.ok(grokAt > grwmAt, 'grok-door after grwm');
  assert.match(html, /<p class="section-kicker">Grok Bot<\/p>/);
  assert.match(html, /<h2 class="section-title" id="grok-title">Sign in with Grok Bot\.<\/h2>/);
  assert.match(html, /Ray Fernando/);
  assert.match(html, /2092696487637737929/);
  assert.doesNotMatch(html, /generational wealth/i);
  const firstPaint = html.slice(0, grwmAt);
  assert.doesNotMatch(firstPaint, /id="grok-door"/);
  assert.match(firstPaint, /id="chat-door"/);
}

{
  const kept = stripRetiredProductDoors('<a href="/login#grok">Sign in with Grok Bot</a><a href="/studio">Studio</a>');
  assert.match(kept, /\/login#grok/);
  assert.doesNotMatch(kept, /\/studio/);
}

assert.equal(GROK_BOT_JSON.compatible, true);
assert.equal(GROK_BOT_JSON.name, 'getdasha.com');
assert.equal(GROK_BOT_JSON.login, 'https://www.getdasha.com/login');
assert.equal(GROK_BOT_JSON.sign_in.start, 'https://lobby.getdasha.com/auth/grok/start');
assert.equal(GROK_BOT_JSON.sign_in.status, 'https://lobby.getdasha.com/auth/grok/status');
assert.equal(GROK_BOT_JSON.sign_in.verify, 'https://lobby.getdasha.com/auth/grok/verify');
assert.equal(GROK_BOT_JSON.verify_prompt, 'sign me into getdasha.com with {code}');

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com', 'https://getdasha.com']) {
  const res = await edgeWorker.fetch(new Request(`${origin}/.well-known/grok-bot.json`), {});
  assert.equal(res.status, 200, `${origin} well-known`);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('x-dasha-edge'), 'grok-bot');
  const body = await res.json();
  assert.deepEqual(body, GROK_BOT_JSON);
  const opt = await edgeWorker.fetch(new Request(`${origin}/.well-known/grok-bot.json`, { method: 'OPTIONS' }), {});
  assert.equal(opt.status, 204, `${origin} well-known OPTIONS`);
  assert.equal(opt.headers.get('access-control-allow-origin'), '*');
}

{
  const login = await edgeWorker.fetch(new Request('https://www.getdasha.com/login'), {});
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('x-dasha-edge'), 'login');
  const body = await login.text();
  assertSiwgMarkup(body, 'served /login');
}

{
  const grok = await edgeWorker.fetch(new Request('https://www.getdasha.com/grok'), {});
  assert.equal(grok.status, 308, '/grok leftover 308');
  assert.equal(grok.headers.get('location'), 'https://www.getdasha.com/login#grok');
}
{
  for (const path of ['/siwg', '/siwg/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`, { method }), {});
      assert.equal(res.status, 308, `${method} ${path} leftover 308`);
      assert.equal(res.headers.get('location'), 'https://www.getdasha.com/login#grok', `${method} ${path} dest`);
    }
  }
}

{
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  const body = await privacy.text();
  assert.match(body, /Grok Bot login stores a browser session after you confirm a one-time code in Grok Bot/);
}

{
  const llms = await edgeWorker.fetch(new Request('https://www.getdasha.com/llms.txt'), {});
  const body = await llms.text();
  assert.match(body, /Grok Bot compatible/);
  assert.match(body, /\/login/);
}

{
  const env = { LOBBY_SESSION_SECRET: 'siwg-status-secret' };
  const token = await createGrokSessionToken(env, 'Ray');
  const res = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/auth/status', {
    headers: { Cookie: `${COOKIE}=${token}`, Origin: 'https://www.getdasha.com' },
  }), { ...env, ALLOWED_ORIGINS: 'https://www.getdasha.com' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.loggedIn, true);
  assert.equal(data.provider, 'grok');
  assert.equal(data.grok.display, 'Ray');
}

globalThis.WebSocketRequestResponsePair ||= class {};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) { if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item); else rows.set(key, value); },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
  async getAlarm() { return Date.now(); }, async setAlarm() {},
};
let ready;
const env = {
  LOBBY_SESSION_SECRET: 'siwg-do-secret',
  ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
};
const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
await ready;

const originHeaders = { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
const start = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/grok/start', {
  method: 'POST',
  headers: originHeaders,
  body: '{}',
}));
assert.equal(start.status, 200, 'start 200');
const started = await start.json();
assert.match(started.code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
assert.equal(started.expiresIn, 300);
assert.equal(started.poll, '/auth/grok/status');
const startCookie = start.headers.get('set-cookie') || '';
assert.match(startCookie, new RegExp(GROK_START_COOKIE));

const pending = await lobby.fetch(new Request(`https://lobby.getdasha.com/auth/grok/status?code=${started.code}`, {
  headers: { ...originHeaders, Cookie: startCookie.split(';')[0] },
}));
assert.equal((await pending.json()).state, 'pending');

const verify = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/grok/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: started.code, displayName: 'Ray' }),
}));
assert.equal(verify.status, 200, 'verify 200');
assert.equal(verify.headers.get('access-control-allow-origin'), '*');
assert.equal((await verify.json()).ok, true);

const stranger = await lobby.fetch(new Request(`https://lobby.getdasha.com/auth/grok/status?code=${started.code}`, {
  headers: originHeaders,
}));
const strangerBody = await stranger.json();
assert.equal(strangerBody.state, 'ok');
assert.doesNotMatch(stranger.headers.get('set-cookie') || '', new RegExp(COOKIE));

const ok = await lobby.fetch(new Request(`https://lobby.getdasha.com/auth/grok/status?code=${started.code}`, {
  headers: { ...originHeaders, Cookie: startCookie.split(';')[0] },
}));
assert.equal(ok.status, 200);
const okBody = await ok.json();
assert.equal(okBody.state, 'ok');
const sessionCookie = ok.headers.get('set-cookie') || '';
assert.match(sessionCookie, new RegExp(COOKIE));

const status = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/auth/status', {
  headers: { Origin: 'https://www.getdasha.com', Cookie: sessionCookie.split(';')[0] },
}), { LOBBY_SESSION_SECRET: env.LOBBY_SESSION_SECRET, ALLOWED_ORIGINS: env.ALLOWED_ORIGINS });
const logged = await status.json();
assert.equal(logged.provider, 'grok');
assert.equal(logged.grok.display, 'Ray');

const reuse = await lobby.fetch(new Request('https://lobby.getdasha.com/auth/grok/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: started.code }),
}));
assert.ok(reuse.status === 409 || reuse.status === 410, `one-use verify got ${reuse.status}`);

assert.doesNotMatch(workerSrc, /wrangler deploy|dasha-ship|Designer-publish/);
assert.match(workerSrc, /provider: 'grok'/);

{
  const wrangler = readFileSync(join(root, 'dasha-lobby-wrangler.deploy.jsonc'), 'utf8');
  assert.match(wrangler, /"pattern": "lobby\.getdasha\.com\/\*"/);
  assert.match(wrangler, /"pattern": "www\.getdasha\.com\/\*"/);
  assert.match(wrangler, /"pattern": "getdasha\.com\/\.well-known\/grok-bot\.json/);
  assert.match(wrangler, /"pattern": "getdasha\.com\/\.well-known\/\*"/);
  assert.doesNotMatch(wrangler, /"pattern": "getdasha\.com\/\*"/, 'apex catch-all would steal Webflow');
}

console.log('dasha-siwg: PASS (login SIWG, /siwg 308 login#grok, grok-door after grwm, well-known incl apex host, path-only apex route, start→verify→status ok, no twimg)');
