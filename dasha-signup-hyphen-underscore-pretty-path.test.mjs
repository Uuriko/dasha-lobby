#!/usr/bin/env node
/**
 * Leftover pretty path: live /sign-up /sign_up /log-in /log_in (+slash / Title-case)
 * html-404 while /signup /register /signin /sign-in /sign_in already
 * 308→https://www.getdasha.com/login. /Login already 308 via product casefold;
 * exact /login is 200. Dest is plain /login — NOT login#grok (/grok /siwg).
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_PLAIN_LOGIN_308_PATHS/, 'plain-login 308 set present');
assert.match(
  workerSrc,
  /\/signup \/register \/signin \/sign-in \/sign_in \/sign-up \/sign_up \/log-in \/log_in → plain \/login/,
  'plain-login leftover comment lists hyphen+underscore signup and login peers',
);

const LOGIN = 'https://www.getdasha.com/login';
const LOGIN_GROK = 'https://www.getdasha.com/login#grok';

const SIGN_UP_LEFTOVER = [
  '/sign-up', '/sign-up/', '/Sign-up', '/SIGN-UP', '/Sign-Up/',
  '/sign_up', '/sign_up/', '/Sign_up', '/SIGN_UP', '/Sign_Up/',
];
const LOG_IN_LEFTOVER = [
  '/log-in', '/log-in/', '/Log-in', '/LOG-IN', '/Log-In/',
  '/log_in', '/log_in/', '/Log_in', '/LOG_IN', '/Log_In/',
];
const PRIOR_PEERS = [
  '/signup', '/signup/', '/Signup', '/SIGNUP',
  '/register', '/register/', '/Register', '/REGISTER',
  '/signin', '/signin/', '/Signin', '/SIGNIN', '/SignIn/',
  '/sign-in', '/sign-in/', '/Sign-in', '/SIGN-IN', '/Sign-In/',
  '/sign_in', '/sign_in/', '/Sign_in', '/SIGN_IN', '/Sign_In/',
];
const PLAIN_LOGIN = [...SIGN_UP_LEFTOVER, ...LOG_IN_LEFTOVER, ...PRIOR_PEERS];

for (const path of PLAIN_LOGIN) {
  assert.equal(potterHome308Dest(path), LOGIN, path);
  assert.notEqual(potterHome308Dest(path), LOGIN_GROK, `${path} is not login#grok`);
}
assert.equal(potterHome308Dest('/login'), null, '/login stays 200');
assert.equal(potterHome308Dest('/login/'), null, '/login/ stays 200');
assert.equal(potterHome308Dest('/Login'), LOGIN, '/Login already 308 via product casefold');
assert.equal(potterHome308Dest('/LOGIN'), LOGIN, '/LOGIN already 308 via product casefold');
assert.equal(potterHome308Dest('/grok'), LOGIN_GROK, '/grok still login#grok');
assert.equal(potterHome308Dest('/siwg'), LOGIN_GROK, '/siwg still login#grok');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of PLAIN_LOGIN) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), LOGIN, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /#/, `${host} ${path} ${method} no hash`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const login = await edgeWorker.fetch(new Request(`https://${host}/login`), env);
  assert.equal(login.status, 200, `${host} /login stays 200`);
  const loginSlash = await edgeWorker.fetch(new Request(`https://${host}/login/`), env);
  assert.equal(loginSlash.status, 200, `${host} /login/ stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/sign-up', '/sign_up', '/log-in', '/log_in', '/signup', '/register', '/signin', '/sign-in', '/sign_in']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-signup-hyphen-underscore-pretty-path: PASS (/sign-up+/sign_up+/log-in+/log_in 308 /login; prior /signup /register /signin /sign-in /sign_in still fold; /Login 308; www+lobby GET+HEAD; /login 200; no plugin.jup.ag)');
