#!/usr/bin/env node
/**
 * Email-first progressive disclosure (dasha-lobby task #2).
 * /login leads with one email field + Continue; the other four methods
 * (Grok Bot, X, Google, wallet) disclose after Continue. Builds on the
 * task-#1 config gating: only configured methods disclose, and when email
 * itself is unconfigured the page degrades to the legacy all-methods wall.
 * Disk only. No wrangler. No network.
 */
import assert from 'node:assert/strict';
import edgeWorker from './dasha-lobby-worker.mjs';
import { LOGIN_PAGE_HTML } from './dasha-lobby-static-gen.mjs';
import { renderLoginPage } from './dasha-login-gating.mjs';

const FULL_ENV = {
  LOBBY_SESSION_SECRET: 'test-session-secret',
  X_CLIENT_ID: 'test-x-client-id',
  X_CLIENT_SECRET: 'test-x-client-secret',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  RESEND_API_KEY: 'test-resend-key',
};

function visible(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

const full = renderLoginPage(FULL_ENV);
const body = visible(full);

// --- stage 1: email first, everything else disclosed ---
assert.ok(body.indexOf('data-email-form') < body.indexOf('data-more-methods'), 'email form precedes the disclosed methods');
assert.match(body, /<div class="more-methods" data-more-methods hidden>/, 'other methods start hidden');
assert.match(body, /<button class="button primary" type="button" data-email-continue>Continue<\/button>/, 'Continue is the primary stage-1 CTA');
assert.match(body, /<p class="methods-or">or continue with<\/p>/, 'disclosure divider');
assert.match(body, /<button class="button" type="button" data-email-send hidden>Email me a sign-in code<\/button>/, 'legacy send button kept hidden (requestCode still drives it)');

// --- all four disclosed methods keep their hooks, copy, and order ---
const methods = body.split('data-more-methods')[1] || '';
for (const hook of ['data-grok-login', 'data-x-login', 'data-google-login', 'data-wallet-login']) {
  assert.match(methods, new RegExp(hook), `${hook} discloses in the wrapper`);
}
assert.ok(methods.indexOf('data-grok-login') < methods.indexOf('data-x-login'), 'grok before x');
assert.ok(methods.indexOf('data-x-login') < methods.indexOf('data-google-login'), 'x before google');
assert.ok(methods.indexOf('data-google-login') < methods.indexOf('data-wallet-login'), 'google before wallet');
assert.match(methods, /Sign in with Grok Bot<\/a>/, 'grok copy intact');
assert.match(methods, />Continue with X<\/a>/, 'x copy intact');
assert.match(methods, />Continue with Google<\/a>/, 'google copy intact');
assert.match(methods, />Connect wallet<\/button>/, 'wallet copy intact');

// --- email-first lede + meta ---
assert.match(full, /<p>Sign in with your email\.<\/p>/, 'email-first lede');
assert.match(full, /<meta name="description" content="Sign in with your email\. Grok Bot, X, Google, and wallet sign-in appear next\.">/, 'email-first meta');

// --- disclosure wiring in the client script ---
assert.match(full, /dasha_login_revealed/, 'reveal persisted device-locally');
assert.match(full, /function revealMethods\(\)/, 'reveal function');
assert.match(full, /continueBtn\.addEventListener\('click'/, 'Continue click handler');
assert.match(full, /ev\.key === 'Enter'/, 'Enter key submits the email');
assert.match(full, /revealMethods\(\);\n\s*requestCode\(false\)/, 'Continue reveals AND starts the code send');
assert.match(full, /localStorage\.getItem\('dasha_login_revealed'\) === '1'/, 'returning devices skip the collapsed stage');
// Failure paths keep a visible retry: the send button is hidden in the new flow,
// so 503/429/generic/network failures must surface the resend button.
for (const status of ['503', '429']) {
  const re = new RegExp(`r\\.status === ${status}[\\s\\S]{0,300}?resendBtn\\.hidden = false`);
  assert.match(full, re, `${status} failure surfaces the resend button`);
}
assert.match(full, /sendBtn\.hidden = true; resendBtn\.hidden = false; resetResendBtn\(\); fail\('Network error/, 'network failure surfaces the resend button');
// No-JS fallback: methods must still be reachable.
assert.match(full, /<noscript><style>\[data-more-methods\]{display:grid!important}<\/style><\/noscript>/, 'no-JS unhides the disclosed methods');
// No gating scaffolding leaks into served HTML.
assert.doesNotMatch(full, /login-method:/, 'no gating scaffolding');
// Performance budget (task #43): login stays far under 40KB.
assert.ok(full.length < 40 * 1024, `login page ${full.length} bytes < 40KB`);

// --- gating interplay: email unconfigured -> legacy all-methods wall ---
const noEmail = renderLoginPage({ ...FULL_ENV, RESEND_API_KEY: '' });
const noEmailBody = visible(noEmail);
assert.doesNotMatch(noEmailBody, /data-email-form/, 'no email form when unconfigured');
assert.doesNotMatch(noEmailBody, /<p class="methods-or">/, 'no divider without the email stage');
assert.doesNotMatch(noEmailBody, /data-email-continue/, 'no Continue without the email stage');
assert.match(noEmailBody, /data-more-methods/, 'wrapper still renders (client JS reveals it)');
assert.match(noEmailBody, /data-wallet-login/, 'wallet still renders');
assert.match(noEmail, /<p>Sign in with Grok Bot, X, Google, or a wallet\.<\/p>/, 'lede names live methods when email is down');
assert.match(noEmail, /if \(!form\) \{/, 'client falls back to the all-methods wall without email');

// --- gating interplay: one method gated off -> disclosure drops it, rest intact ---
const noGoogle = renderLoginPage({ ...FULL_ENV, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
const noGoogleBody = visible(noGoogle);
assert.doesNotMatch(noGoogleBody, /data-google-login/, 'gated-off Google does not disclose');
assert.match(noGoogleBody, /data-x-login/, 'x still discloses');
assert.match(noGoogleBody, /data-grok-login/, 'grok still discloses');
assert.match(noGoogleBody, /data-wallet-login/, 'wallet still discloses');
assert.match(noGoogleBody, /data-email-continue/, 'email stage intact when another method is gated');

// --- served /login on both hosts ---
for (const host of ['https://lobby.getdasha.com', 'https://www.getdasha.com']) {
  const res = await edgeWorker.fetch(new Request(`${host}/login`), FULL_ENV);
  assert.equal(res.status, 200, `${host} /login 200`);
  const html = await res.text();
  assert.match(html, /<div class="more-methods" data-more-methods hidden>/, `${host} served page starts disclosed-hidden`);
  assert.match(html, /data-email-continue/, `${host} served page has Continue`);
  assert.match(html, /<p>Sign in with your email\.<\/p>/, `${host} served lede is email-first`);
  assert.doesNotMatch(html, /login-method:/, `${host} no gating scaffolding served`);
}
{
  // Unconfigured env on the wire: wallet-only wall, no dead doors, no divider.
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/login'), {});
  const html = await res.text();
  const b = visible(html);
  assert.match(b, /data-wallet-login/, 'served unconfigured: wallet renders');
  assert.doesNotMatch(b, /<p class="methods-or">/, 'served unconfigured: no divider');
  assert.doesNotMatch(b, /data-email-continue/, 'served unconfigured: no Continue');
}

console.log('dasha-login-progressive-disclosure: PASS (email-first stage, 4-method disclosure, gating interplay, served on both hosts)');
