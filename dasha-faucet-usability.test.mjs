#!/usr/bin/env node
/**
 * Usability pass on top of the same claim flow (folded into the same ship as the
 * perfect+prove audit): step indicator, cooldown countdown, tip receipt, and
 * Solflare-aware Prove-wallet copy. Same claim card order, still no paste on the
 * claim path, no disclaimers. No live claim spend.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { FAUCET_CLIENT_JS } from './dasha-lobby-static-gen.mjs';

const TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const POTTER = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
const client = readFileSync(new URL('./dasha-faucet-client.js', import.meta.url), 'utf8');
assert.equal(FAUCET_CLIENT_JS, client, 'generated FAUCET_CLIENT_JS must stay byte-identical to the source file');

class FakeEl {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.attrs = {};
    this.className = '';
    this.classList = { add: (c) => { this.className = (this.className + ' ' + c).trim(); } };
    this._text = '';
    this.hidden = false;
    this.style = { cssText: '' };
    this.listeners = {};
    this.parentNode = null;
    this.disabled = false;
    this.type = '';
    this.href = '';
    this.id = '';
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v == null ? '' : v); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  contains() { return false; }
  querySelector() { return null; }
  focus() {}
  set innerHTML(v) { if (v === '') this.children = []; }
  get innerHTML() { return ''; }
}
function walk(el, acc = []) {
  acc.push(el);
  for (const c of el.children || []) walk(c, acc);
  return acc;
}
function texts(root) { return walk(root).map((n) => n._text).filter(Boolean); }
function buttons(root) { return walk(root).filter((n) => n.tagName === 'BUTTON'); }
function links(root) { return walk(root).filter((n) => n.tagName === 'A'); }
function click(root, label) {
  const btn = buttons(root).find((n) => n._text === label);
  assert.ok(btn, 'missing button ' + label);
  btn.listeners.click[0]({ preventDefault() {}, stopPropagation() {} });
  return btn;
}
/** Same harness as dasha-faucet-audit-intended.test.mjs, extended with an optional
 *  claimResponse so the receipt card (a real 'tip me' send) can be exercised, and an
 *  opens counter for provider-detection assertions. All timers unref'd by the client
 *  itself now, so this harness needs no extra cleanup to avoid hanging the runner. */
function boot(me, extra = {}) {
  const leftover = new FakeEl('figure');
  leftover.id = 'dasha-faucet-static';
  leftover.setAttribute('id', 'dasha-faucet-static');
  const root = new FakeEl('main');
  root.id = 'dasha-faucet';
  root.setAttribute('id', 'dasha-faucet');
  root.setAttribute('data-faucet-api', 'https://lobby.getdasha.com');
  const assigned = [];
  const opens = { count: 0 };
  const claimCalls = [];
  const doc = {
    readyState: 'complete',
    activeElement: null,
    body: new FakeEl('body'),
    getElementById(id) {
      if (id === 'dasha-faucet') return root;
      if (id === 'dasha-faucet-static') return leftover;
      return walk(root).find((n) => n.id === id || n.attrs.id === id) || null;
    },
    createElement(tag) { return new FakeEl(tag); },
    addEventListener() {},
    removeEventListener() {},
  };
  const fetchImpl = (url, init) => {
    const path = String(url);
    if (path.endsWith('/faucet/status')) {
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          configured: true, funded: true, balanceUi: 168800, solLamports: 1, treasury: TREASURY, amountUi: 100, mint: MINT,
        })),
      });
    }
    if (path.endsWith('/faucet/me')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify(me)) });
    }
    if (path.endsWith('/faucet/claim')) {
      claimCalls.push(init && init.body);
      const res = extra.claimResponse || { error: 'link X first' };
      return Promise.resolve({
        status: res.__status || (res.ok ? 200 : 400),
        text: () => Promise.resolve(JSON.stringify(res)),
      });
    }
    return Promise.reject(new Error(path));
  };
  const popup = Object.prototype.hasOwnProperty.call(extra, 'popup') ? extra.popup : { closed: false };
  const ctx = {
    window: {
      addEventListener() {},
      removeEventListener() {},
      open() { opens.count += 1; return popup; },
      location: { assign(href) { assigned.push(String(href)); }, href: '' },
    },
    document: doc,
    navigator: {
      userAgent: extra.userAgent || 'Mozilla/5.0',
      clipboard: { writeText() { return Promise.resolve(); } },
      ...(extra.wallet !== undefined ? {} : {}),
    },
    fetch: fetchImpl,
    setTimeout, clearTimeout, setInterval, clearInterval,
    TextEncoder, TextDecoder, Uint8Array, Promise, Object, Array, String, Number, Boolean, Error, JSON, Date, Math, console,
  };
  if (extra.wallet !== undefined) ctx.phantom = extra.wallet === 'phantom' ? { solana: { connect: () => Promise.resolve({}), signMessage: () => Promise.resolve({ signature: new Uint8Array(64) }) } } : undefined;
  ctx.globalThis = ctx;
  ctx.window = Object.assign(ctx.window, { document: doc, navigator: ctx.navigator, fetch: ctx.fetch });
  vm.runInNewContext(FAUCET_CLIENT_JS, ctx);
  return { root, assigned, opens, claimCalls };
}
const tick = () => new Promise((r) => setTimeout(r, 20));

// ---------------------------------------------------------------------------
// 1. Step indicator: tiny 'n/4' on Link X / Prove wallet / tip me / confirming /
//    done — never on the door or the fail card (kept minimal, not wizard chrome).
// ---------------------------------------------------------------------------
{
  const { root } = boot({ linked: false, claimed: false });
  await tick();
  assert.ok(!texts(root).some((t) => /^\d\/4$/.test(t)), 'door card must not show a step badge');
  click(root, 'Get 100');
  assert.ok(texts(root).includes('1/4'), 'Link X. must show step 1/4');
}
{
  const { root } = boot({ linked: true, claimed: false });
  await tick();
  click(root, 'Get 100');
  assert.ok(texts(root).includes('2/4'), 'Prove wallet. must show step 2/4');
}
{
  const { root } = boot({ linked: true, claimed: false, dest: POTTER, kind: 'IS_WALLET' });
  await tick();
  click(root, 'Get 100');
  assert.ok(texts(root).includes('3/4'), 'tip me. must show step 3/4');
}

// ---------------------------------------------------------------------------
// 2. Countdown after 'already claimed': exact minute math, client-side only
//    (no extra network calls beyond the initial status+me boot fetch).
// ---------------------------------------------------------------------------
{
  const nextAt = Date.now() + 6 * 3600000 + 12 * 60000; // 6h 12m
  const { root } = boot({ linked: true, claimed: true, dest: POTTER, kind: 'IS_WALLET', nextAt, signature: 'a'.repeat(64) });
  await tick();
  click(root, 'Get 100');
  assert.ok(texts(root).includes('4/4'), 'done state shows step 4/4');
  assert.ok(texts(root).some((t) => t === 'next tip in 6h 12m'), `expected exact countdown, got: ${JSON.stringify(texts(root))}`);
}
{
  const nextAt = Date.now() + 42 * 60000; // under an hour: no hour part
  const { root } = boot({ linked: true, claimed: true, dest: POTTER, kind: 'IS_WALLET', nextAt, signature: 'a'.repeat(64) });
  await tick();
  click(root, 'Get 100');
  assert.ok(texts(root).some((t) => t === 'next tip in 42m'));
}
{
  const nextAt = Date.now() - 5000; // already past due -> reads "any moment", never negative
  const { root } = boot({ linked: true, claimed: true, dest: POTTER, kind: 'IS_WALLET', nextAt, signature: 'a'.repeat(64) });
  await tick();
  click(root, 'Get 100');
  assert.ok(texts(root).some((t) => t === 'next tip in any moment'));
  assert.ok(!texts(root).some((t) => /^next tip in -/.test(t)), 'must never show a negative countdown');
}
{
  // no nextAt from the server at all -> degrade gracefully, no crash, no bogus countdown
  const { root } = boot({ linked: true, claimed: true, dest: POTTER, kind: 'IS_WALLET', signature: 'a'.repeat(64) });
  await tick();
  click(root, 'Get 100');
  assert.ok(!texts(root).some((t) => /^next tip in/.test(t)));
}

// ---------------------------------------------------------------------------
// 3. Receipt after a fresh successful tip: amount, dest last-4, solscan link.
//    Terse — no extra chrome beyond those three facts.
// ---------------------------------------------------------------------------
{
  const sig = 'reCe1pt' + 'x'.repeat(50);
  const claimResponse = { ok: true, signature: sig, dest: POTTER, solscan: 'https://solscan.io/tx/' + sig, __status: 200 };
  const { root, claimCalls } = boot(
    { linked: true, claimed: false, dest: POTTER, kind: 'IS_WALLET' },
    { claimResponse },
  );
  await tick();
  click(root, 'Get 100');
  assert.ok(texts(root).includes('tip me.'));
  click(root, 'tip me');
  await tick();
  await tick();
  assert.equal(claimCalls.length, 1, 'exactly one claim POST, no double-send');
  assert.ok(texts(root).includes('100 $dasha'), `expected amount receipt line, got: ${JSON.stringify(texts(root))}`);
  assert.ok(texts(root).includes(POTTER.slice(-4)), 'expected dest last-4 on the receipt');
  const solscan = links(root).find((a) => a._text === 'Solscan');
  assert.ok(solscan, 'expected a Solscan link on the receipt');
  assert.equal(solscan.href, 'https://solscan.io/tx/' + sig);
  assert.ok(texts(root).includes('4/4'), 'receipt is step 4/4');
  // terse: must not also show the cooldown countdown on a fresh receipt
  assert.ok(!texts(root).some((t) => /^next tip in/.test(t)));
}

// ---------------------------------------------------------------------------
// 4. Prove-wallet 'need Phantom' path: Solflare in-app UA also skips the doomed
//    popup attempt (same mechanism as Phantom), and the Open-in-X screen mentions
//    Solflare in one honest sentence — no multi-wallet picker.
// ---------------------------------------------------------------------------
{
  // no injected wallet at all -> need Phantom screen
  const { root } = boot({ linked: true, claimed: false });
  await tick();
  click(root, 'Get 100');
  click(root, 'Prove wallet.');
  assert.ok(buttons(root).some((b) => b._text === 'Open in Phantom.'));
  assert.ok(texts(root).some((t) => /Solflare/i.test(t)), 'must mention Solflare works too');
  assert.ok(!texts(root).some((t) => /Solflare/i.test(t) && /Phantom/i.test(t)), 'one honest sentence, not a merged multi-wallet blurb');
}
{
  // Solflare in-app UA: window.open must be skipped for X-linking too, same as Phantom
  const solflareUa = 'Mozilla/5.0 (Linux; Android 13) Solflare/2.3.1 Chrome/122.0.0.0 Mobile Safari/537.36';
  const { root, assigned, opens } = boot({ linked: false, claimed: false }, { userAgent: solflareUa, popup: { closed: false } });
  await tick();
  click(root, 'Get 100');
  click(root, 'Link X.');
  assert.equal(opens.count, 0, 'Solflare in-app UA should skip window.open, same as Phantom');
  assert.deepEqual(assigned, ['https://lobby.getdasha.com/oauth/x/start?return=/faucet']);
}
assert.match(client, /function solflareInApp\(\)/);
assert.match(client, /if\(!phantomInApp\(\)&&!solflareInApp\(\)\)/);
// wallet-object detection was already broad before this pass — confirm it stayed that way
assert.match(client, /global\.phantom&&global\.phantom\.solana\)\|\|global\.solflare\|\|global\.solana/);

// ---------------------------------------------------------------------------
// 5. Confirm (no code change expected): a dest already proven in a prior session
//    (server-side /faucet/me returns dest + kind:'IS_WALLET') skips straight to
//    card 3 ('tip me.') on a return visit — Link X and Prove wallet never render.
// ---------------------------------------------------------------------------
{
  const { root } = boot({ linked: true, claimed: false, dest: POTTER, kind: 'IS_WALLET' });
  await tick();
  click(root, 'Get 100');
  assert.ok(texts(root).includes('tip me.'), 'already-proven dest must skip straight to tip me');
  assert.ok(!texts(root).includes('Link X.'));
  assert.ok(!texts(root).includes('Prove wallet.'));
}

console.log('dasha-faucet-usability: PASS (step badge, countdown math, tip receipt, Solflare detection + copy, already-proven skip confirmed)');
