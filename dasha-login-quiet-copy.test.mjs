#!/usr/bin/env node
/**
 * Quiet /login doors copy for Compute growth.
 * One line near Grok Bot / X / Google / wallet. No email lecture.
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

const QUIET = 'Sign in. Grok Bot, X, Google, email, or a wallet.';
const QUIET_P = `<p>${QUIET}</p>`;

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

function visible(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

function assertQuietLogin(html, label) {
  const body = visible(html);
  assert.equal((html.match(/<p>Sign in\. Grok Bot, X, Google, email, or a wallet\.<\/p>/g) || []).length, 1, `${label} one quiet line`);
  assert.match(body, /data-login-methods/, `${label} methods`);
  const methodsAt = body.indexOf('data-login-methods');
  const lineAt = body.indexOf(QUIET_P);
  assert.ok(lineAt >= 0 && methodsAt > lineAt, `${label} line sits near doors`);
  assert.match(body, /data-grok-login/, `${label} Grok Bot door`);
  assert.match(body, /data-x-login/, `${label} X door`);
  assert.match(body, /data-google-login/, `${label} Google door`);
  assert.match(body, /Continue with Google/, `${label} Google button copy`);
  assert.match(body, /data-wallet-login/, `${label} wallet door`);
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

console.log('dasha-login-quiet-copy: PASS (quiet doors line once; Grok/X/Google/wallet stay; home first paint intact)');

// Resend + provider-hint + OTP hardening (2026 auth UX): structure present in source, bundle, and served page.
async function assertLoginUx(html, label) {
  const body = visible(html);
  assert.match(body, /data-email-resend/, `${label} resend button`);
  assert.match(body, /data-provider-hint/, `${label} provider hint slot`);
  assert.match(body, /pattern="\[0-9\]\*"/, `${label} OTP numeric pattern`);
  assert.match(body, /aria-describedby="dasha-email-status"/, `${label} OTP status link`);
  // JS-only strings (visible() strips <script>).
  assert.match(html, /Resend in 0:/, `${label} resend cooldown copy`);
  assert.match(html, /dasha_last_provider/, `${label} device-local provider memory`);
  assert.match(html, /dasha-x-linked/, `${label} x link listener`);
  assert.match(html, /dasha-google-linked/, `${label} google link listener`);
  assert.match(html, /That code expired\. Get a new one\./, `${label} expiry copy`);
}

assertLoginUx(loginSrc, 'login source');
assertLoginUx(LOGIN_PAGE_HTML, 'LOGIN_PAGE_HTML');
{
  const login = await edgeWorker.fetch(new Request('https://www.getdasha.com/login'), {});
  assertLoginUx(await login.text(), 'served /login');
}
console.log('dasha-login-ux: PASS (resend cooldown, provider hint, OTP hardening, expiry copy)');
