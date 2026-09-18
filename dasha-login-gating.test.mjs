#!/usr/bin/env node
/**
 * Config-gated login method buttons (portfolio task #1).
 * /login must never render a dead button for an unconfigured provider:
 * each method's button is hidden unless its config is present.
 * Disk only. No wrangler. No network.
 */
import assert from 'node:assert/strict';
import edgeWorker from './dasha-lobby-worker.mjs';
import {
  grokConfigured,
  emailConfigured,
  walletConfigured,
  loginMethodAvailability,
  renderLoginPage,
} from './dasha-login-gating.mjs';
import { xConfigured } from './dasha-lobby-x.mjs';
import { googleConfigured } from './dasha-lobby-google.mjs';

const FULL_ENV = {
  LOBBY_SESSION_SECRET: 'test-session-secret',
  X_CLIENT_ID: 'test-x-client-id',
  X_CLIENT_SECRET: 'test-x-client-secret',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  RESEND_API_KEY: 'test-resend-key',
};

// --- availability mirrors the backend gates ---
assert.deepEqual(
  loginMethodAvailability({}),
  { grok: false, x: false, google: false, email: false, wallet: true },
  'empty env: wallet only',
);
assert.deepEqual(
  loginMethodAvailability(FULL_ENV),
  { grok: true, x: true, google: true, email: true, wallet: true },
  'full env: all five',
);
assert.equal(loginMethodAvailability({ GOOGLE_CLIENT_ID: 'g' }).google, false, 'google needs the secret too');
assert.equal(loginMethodAvailability({ X_CLIENT_ID: 'x', X_CLIENT_SECRET: 'xs' }).x, false, 'x needs the session secret too');
assert.equal(xConfigured({ X_CLIENT_ID: 'x', X_CLIENT_SECRET: 'xs' }), false, 'xConfigured needs the session secret');
assert.equal(googleConfigured({ GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 'gs' }), false, 'googleConfigured needs the session secret');
assert.equal(grokConfigured({}), false, 'grok needs LOBBY_SESSION_SECRET');
assert.equal(grokConfigured({ LOBBY_SESSION_SECRET: 's' }), true);
assert.equal(emailConfigured({}), false);
assert.equal(emailConfigured({ RESEND_API_KEY: '  ' }), false, 'blank key is unconfigured');
assert.equal(emailConfigured({ RESEND_API_KEY: 'r' }), true);
assert.equal(walletConfigured(), true, 'wallet is client-side only');

// --- render: buttons, not disabled states ---
function buttons(html) {
  return {
    grok: html.includes('Sign in with Grok Bot</a>'),
    x: html.includes('>Continue with X</a>'),
    google: html.includes('>Continue with Google</a>'),
    wallet: html.includes('>Connect wallet</button>'),
    email: html.includes('class="email-form"'),
  };
}

const fullHtml = renderLoginPage(FULL_ENV);
assert.deepEqual(
  buttons(fullHtml),
  { grok: true, x: true, google: true, wallet: true, email: true },
  'all configured: all five render',
);
assert.match(fullHtml, /<p>Sign in with your email\.<\/p>/, 'full-env lede is email-first');
assert.match(fullHtml, /<meta name="description" content="Sign in with your email\. Grok Bot, X, Google, and wallet sign-in appear next\.">/, 'full-env meta is email-first');
assert.match(
  fullHtml,
  /data-login-methods='\{"grok":true,"x":true,"google":true,"email":true,"wallet":true\}'/,
  'availability blob rendered',
);
assert.match(fullHtml, /Email sign-in is not available yet\. Use Grok Bot, X, Google, or a wallet\./, 'full fallback copy unchanged');

const emptyHtml = renderLoginPage({});
assert.deepEqual(
  buttons(emptyHtml),
  { grok: false, x: false, google: false, wallet: true, email: false },
  'nothing configured: wallet only, no dead buttons',
);
assert.doesNotMatch(emptyHtml, /oauth\/x\/start/, 'no dead X href');
assert.doesNotMatch(emptyHtml, /oauth\/google\/start/, 'no dead Google href');
assert.doesNotMatch(emptyHtml, /\/login#grok/, 'no dead Grok Bot href');
assert.match(emptyHtml, /<p>Sign in with a wallet\.<\/p>/, 'lede names only live methods');
assert.match(emptyHtml, /<meta name="description" content="Sign in with a wallet\.">/, 'meta names only live methods');
assert.match(
  emptyHtml,
  /data-login-methods='\{"grok":false,"x":false,"google":false,"email":false,"wallet":true\}'/,
);
assert.doesNotMatch(emptyHtml, /login-method:/, 'no gating scaffolding in served HTML');

// The exact bug John hit: Google unconfigured, everything else live.
const noGoogle = renderLoginPage({ ...FULL_ENV, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
assert.deepEqual(
  buttons(noGoogle),
  { grok: true, x: true, google: false, wallet: true, email: true },
  'google unconfigured: Google button hidden, rest live',
);
assert.match(noGoogle, /<p>Sign in with your email\.<\/p>/, 'email-first lede even when Google is gated off');
assert.match(noGoogle, /Email sign-in is not available yet\. Use Grok Bot, X, or a wallet\./, 'fallback copy drops Google');
assert.doesNotMatch(noGoogle, /oauth\/google\/start/, 'no dead Google href');

// Email-only config: fallback copy degrades honestly when no alternative exists.
const emailOnly = renderLoginPage({ RESEND_API_KEY: 'r' });
assert.deepEqual(
  buttons(emailOnly),
  { grok: false, x: false, google: false, wallet: true, email: true },
);
assert.match(emailOnly, /<p>Sign in with your email\.<\/p>/, 'email-first lede when email is live');

// --- served /login on both hosts ---
{
  const res = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/login'), FULL_ENV);
  assert.equal(res.status, 200, 'lobby /login 200');
  assert.equal(res.headers.get('x-dasha-edge'), 'login', 'lobby /login edge header');
  const html = await res.text();
  assert.deepEqual(
    buttons(html),
    { grok: true, x: true, google: true, wallet: true, email: true },
    'served full-env renders all five',
  );
  assert.doesNotMatch(html, /login-method:/, 'served HTML carries no scaffolding');
}
{
  const res = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/login'), {});
  assert.equal(res.status, 200, 'lobby /login 200 (empty env)');
  const html = await res.text();
  assert.deepEqual(
    buttons(html),
    { grok: false, x: false, google: false, wallet: true, email: false },
    'served empty-env: no dead buttons',
  );
  assert.match(html, /<p>Sign in with a wallet\.<\/p>/);
}
{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/login'), FULL_ENV);
  assert.equal(res.status, 200, 'www /login 200');
  const html = await res.text();
  assert.match(html, /<p>Sign in with your email\.<\/p>/, 'www served full-env lede is email-first');
}
{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/login'), { method: 'HEAD' }, {});
  assert.equal(res.status, 200, 'www /login HEAD 200');
}

console.log('dasha-login-gating: ok');
