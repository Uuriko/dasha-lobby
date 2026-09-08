#!/usr/bin/env node
/**
 * Quiet /login doors copy for Compute growth.
 * One line near Grok Bot / X / wallet. No email lecture. No Google door.
 * Disk only. No wrangler. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { LOGIN_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const loginSrc = readFileSync(join(root, 'dasha-login-page.html'), 'utf8');

const QUIET = 'Sign in. Grok Bot, X, or a wallet.';
const QUIET_P = `<p>${QUIET}</p>`;

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

function visible(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

function assertQuietLogin(html, label) {
  const body = visible(html);
  assert.equal((html.match(/<p>Sign in\. Grok Bot, X, or a wallet\.<\/p>/g) || []).length, 1, `${label} one quiet line`);
  assert.match(body, /data-login-methods/, `${label} methods`);
  const methodsAt = body.indexOf('data-login-methods');
  const lineAt = body.indexOf(QUIET_P);
  assert.ok(lineAt >= 0 && methodsAt > lineAt, `${label} line sits near doors`);
  assert.match(body, /data-grok-login/, `${label} Grok Bot door`);
  assert.match(body, /data-x-login/, `${label} X door`);
  assert.match(body, /data-wallet-login/, `${label} wallet door`);
  assert.doesNotMatch(body, /Sign in with Google|accounts\.google|data-google-login/i, `${label} no Google door`);
  assert.doesNotMatch(body, /email, or a Solana wallet\. One login at a time/, `${label} no email lecture`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertQuietLogin(loginSrc, 'login source');
assertQuietLogin(LOGIN_PAGE_HTML, 'LOGIN_PAGE_HTML');

{
  const login = await edgeWorker.fetch(new Request('https://www.getdasha.com/login'), {});
  assert.equal(login.status, 200, '/login 200');
  assert.equal(login.headers.get('x-dasha-edge'), 'login', '/login edge');
  const html = await login.text();
  assertQuietLogin(html, 'served /login');
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200, 'home 200');
  const html = await home.text();
  const grwmAt = html.indexOf('id="grwm"');
  const paint = grwmAt >= 0 ? html.slice(0, grwmAt) : html;
  assert.match(paint, /\$<b>dasha<\/b>/, 'home first paint wordmark');
  assert.match(paint, />Buy</, 'home first paint Buy');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'home no plugin.jup.ag');
}

console.log('dasha-login-quiet-copy: PASS (quiet doors line once; Grok/X/wallet stay; no Google; home first paint intact)');
