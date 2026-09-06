#!/usr/bin/env node
/**
 * Leftover: live /signin /sign-in (+slash / Title-case) html-404 while
 * /signup /register already 308→https://www.getdasha.com/login and /login is 200.
 * Dest is plain /login — NOT login#grok (/grok /siwg).
 * Leftover /profile /settings /compute/profile /compute/settings html-404 while
 * /account /you already 308→https://www.getdasha.com/compute and /compute is 200.
 * Disk only. No Designer. Never plugin.jup.ag.
 * Do not invent /terms /tos /legal /help /faq /cookie /aeo /shorts /dev.
 * /sdk /cli now fold via settlement-billing-endpoint leftover → /compute/api.
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
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');

const LOGIN = 'https://www.getdasha.com/login';
const LOGIN_GROK = 'https://www.getdasha.com/login#grok';
const COMPUTE = 'https://www.getdasha.com/compute';

const PLAIN_LOGIN = [
  '/signin', '/signin/', '/Signin', '/SIGNIN', '/SignIn/',
  '/sign-in', '/sign-in/', '/Sign-in', '/SIGN-IN', '/Sign-In/',
  '/signup', '/signup/', '/Signup', '/SIGNUP',
  '/register', '/register/', '/Register', '/REGISTER',
];
const COMPUTE_TABS = [
  '/profile', '/profile/', '/Profile', '/PROFILE', '/pRoFiLe/',
  '/settings', '/settings/', '/Settings', '/SETTINGS',
  '/compute/profile', '/compute/profile/', '/Compute/profile', '/COMPUTE/PROFILE',
  '/compute/settings', '/compute/settings/', '/Compute/settings', '/COMPUTE/SETTINGS',
  '/account', '/account/', '/Account', '/ACCOUNT',
  '/you', '/you/', '/You', '/YOU',
];
const INVENTED = [
  '/terms', '/tos', '/legal', '/help', '/faq',
  '/cookie', '/aeo', '/shorts', '/dev',
];

for (const path of PLAIN_LOGIN) {
  assert.equal(potterHome308Dest(path), LOGIN, path);
  assert.notEqual(potterHome308Dest(path), LOGIN_GROK, `${path} is not login#grok`);
}
for (const path of COMPUTE_TABS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/login'), null, '/login stays 200');
assert.equal(potterHome308Dest('/login/'), null, '/login/ stays 200');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/grok'), LOGIN_GROK, '/grok still login#grok');
assert.equal(potterHome308Dest('/siwg'), LOGIN_GROK, '/siwg still login#grok');
for (const path of INVENTED) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
}

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of PLAIN_LOGIN) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), LOGIN, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /#/, `${host} ${path} ${method} no hash`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of COMPUTE_TABS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /#/, `${host} ${path} ${method} no hash`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const login = await edgeWorker.fetch(new Request(`https://${host}/login`), env);
  assert.equal(login.status, 200, `${host} /login stays 200`);
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/signin', '/sign-in', '/signup', '/register', '/profile', '/settings', '/account']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-signin-profile-pretty-path: PASS (/signin+/sign-in 308 /login; /profile+/settings 308 /compute; www+lobby GET+HEAD; /login+/compute 200; no plugin.jup.ag)');
