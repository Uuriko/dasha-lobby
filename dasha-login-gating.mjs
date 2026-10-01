/**
 * Config-gated login method buttons (portfolio task #1).
 *
 * /login must never render a dead button for an unconfigured provider.
 * Each method's markup is wrapped in <!--login-method:name--> sentinels in
 * dasha-login-page.html; renderLoginPage() strips the blocks whose config is
 * absent and rewrites the lede + fallback copy to name only live methods.
 * Sleek by design: unconfigured methods are hidden, not disabled — no noise,
 * no extra text.
 *
 * Availability mirrors the backend gates:
 *  - grok:   LOBBY_SESSION_SECRET (mirrors /auth/grok/start's 503 gate)
 *  - x:      xConfigured() from dasha-lobby-x.mjs
 *  - google: googleConfigured() from dasha-lobby-google.mjs
 *  - email:  RESEND_API_KEY (mirrors dasha-mail-resend's resendConfigured)
 *  - wallet: client-side only — always available
 *
 * Disk-testable: no wrangler, no network.
 */
import { LOGIN_PAGE_HTML } from './dasha-lobby-static-gen.mjs';
import { xConfigured } from './dasha-lobby-x.mjs';
import { googleConfigured } from './dasha-lobby-google.mjs';

export const LOGIN_METHODS = ['grok', 'x', 'google', 'email', 'wallet'];

const DISPLAY = { grok: 'Grok Bot', x: 'X', google: 'Google', email: 'email', wallet: 'a wallet' };

const FULL_LEDE = 'Sign in. Grok Bot, X, Google, email, or a wallet.';
const FULL_FALLBACK = 'Email sign-in is not available yet. Use Grok Bot, X, Google, or a wallet.';

function hasSecret(v) {
  return String(v ?? '').trim().length > 0;
}

/** Grok Bot pairing needs the session HMAC secret (mirrors /auth/grok/start's 503 gate). */
export function grokConfigured(env) {
  return hasSecret(env?.LOBBY_SESSION_SECRET);
}

/** Email OTP needs the Resend key (mirrors dasha-mail-resend's resendConfigured). */
export function emailConfigured(env) {
  return hasSecret(env?.RESEND_API_KEY);
}

/** Wallet connect is client-side only — there is no server config to gate on. */
export function walletConfigured() {
  return true;
}

export function loginMethodAvailability(env) {
  return {
    grok: grokConfigured(env),
    x: xConfigured(env),
    google: googleConfigured(env),
    email: emailConfigured(env),
    wallet: walletConfigured(),
  };
}

function stripMethod(html, method) {
  const re = new RegExp(
    `[ \\t]*<!--[ \\t]*login-method:${method}[ \\t]*-->[\\s\\S]*?<!--[ \\t]*/login-method:${method}[ \\t]*-->[ \\t]*\\r?\\n?`,
    'g',
  );
  return html.replace(re, '');
}

function joinNames(names) {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

/**
 * Server-render /login for this env's config. All five methods keep working
 * exactly as before when configured; unconfigured methods render nothing.
 */
export function renderLoginPage(env) {
  const avail = loginMethodAvailability(env);
  let html = LOGIN_PAGE_HTML;
  for (const m of LOGIN_METHODS) {
    if (!avail[m]) html = stripMethod(html, m);
  }
  // Sentinels for methods that stay are scaffolding, not content — drop them
  // so view-source carries no gating machinery.
  html = html.replace(/[ \t]*<!--[ \t]*\/?login-method:[a-z]+[ \t]*-->[ \t]*\r?\n?/g, '');
  // Lede names only the live methods. Fully configured it is byte-identical
  // to the long-standing quiet copy.
  const names = LOGIN_METHODS.filter((m) => avail[m]).map((m) => DISPLAY[m]);
  const lede = names.length === LOGIN_METHODS.length ? FULL_LEDE : `Sign in with ${joinNames(names)}.`;
  html = html.replace(`<p>${FULL_LEDE}</p>`, `<p>${lede}</p>`);
  html = html.replace(
    `<meta name="description" content="${FULL_LEDE}">`,
    `<meta name="description" content="${lede}">`,
  );
  // Availability blob consumed by the "last time you signed in with …" hint,
  // so it never advertises a method that is not rendered.
  html = html.replace('data-login-methods>', `data-login-methods='${JSON.stringify(avail)}'>`);
  // Honest fallback copy when the Resend rail is configured but the provider
  // call fails: name only the methods that are actually rendered.
  const alt = LOGIN_METHODS.filter((m) => m !== 'email' && avail[m]).map((m) => DISPLAY[m]);
  const fallback = alt.length
    ? `Email sign-in is not available yet. Use ${joinNames(alt)}.`
    : 'Email sign-in is not available yet. Try again later.';
  html = html.replace(FULL_FALLBACK, fallback);
  return html;
}
