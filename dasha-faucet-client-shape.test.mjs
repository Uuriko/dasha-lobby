#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { FAUCET_CLIENT_JS, FAUCET_CLIENT_SRI, FAUCET_PAGE_HTML, X_CONNECT_SRI } from './dasha-lobby-static-gen.mjs';

const TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const file = readFileSync(new URL('./dasha-faucet-client.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('./dasha-lobby-worker.mjs', import.meta.url), 'utf8');
const page = readFileSync(new URL('./dasha-faucet-page.html', import.meta.url), 'utf8');

assert.equal(FAUCET_CLIENT_JS, file);
const sri = 'sha384-' + createHash('sha384').update(FAUCET_CLIENT_JS).digest('base64');
assert.equal(FAUCET_CLIENT_SRI, sri);
assert.match(FAUCET_PAGE_HTML, new RegExp(sri.replace(/[+/]/g, '\\$&')));
assert.match(page, new RegExp(sri.replace(/[+/]/g, '\\$&')));
assert.match(worker, /FAUCET_CLIENT_SRI/);
assert.match(worker, /function pinFaucetScript/);
assert.doesNotMatch(worker, /KThkiViv/);

assert.ok(X_CONNECT_SRI.startsWith('sha384-'), 'x-connect sri present');
const xSriRe = new RegExp(X_CONNECT_SRI.replace(/[+/]/g, '\\$&'));
assert.match(page, xSriRe, 'disk /faucet pins live x-connect sri');
assert.match(FAUCET_PAGE_HTML, xSriRe, 'bundled /faucet pins live x-connect sri');
assert.doesNotMatch(page, /sha384-TfilU2\+Ahqd0cJ9tlKgZ5XzZfD5E830sS1TVyvNdZNsxFq0OjopktBKS8rH40Nze/, 'disk /faucet drops stale x-connect sri');
assert.doesNotMatch(FAUCET_PAGE_HTML, /sha384-TfilU2\+Ahqd0cJ9tlKgZ5XzZfD5E830sS1TVyvNdZNsxFq0OjopktBKS8rH40Nze/, 'bundled /faucet drops stale x-connect sri');

assert.doesNotMatch(FAUCET_CLIENT_JS, /Paste address/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /typo check/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /cannot spend/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /Donate fills/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /Link X, then/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /Jar needs a drop/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /not an airdrop/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /plugin\.jup\.ag/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /\/faucet\/withdraw/);
assert.match(FAUCET_CLIENT_JS, /Once a day\./);
assert.match(FAUCET_CLIENT_JS, /Fill the jar/);
assert.match(FAUCET_CLIENT_JS, /Prove wallet\./);
assert.match(FAUCET_CLIENT_JS, /Link X\./);
assert.match(FAUCET_CLIENT_JS, /primary\('Link X\.'/);
assert.match(FAUCET_CLIENT_JS, /primary\('Prove wallet\.'/);
assert.match(FAUCET_CLIENT_JS, /faucet-q','tip me\.'/);
assert.match(FAUCET_CLIENT_JS, /x_too_new:'X too new'/);
assert.match(FAUCET_CLIENT_JS, /need Phantom/);
assert.match(FAUCET_CLIENT_JS, /Open in Phantom\./);
assert.match(FAUCET_CLIENT_JS, /phantom\.app\/ul\/browse\//);
assert.match(FAUCET_CLIENT_JS, /location/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /if\(!xPopup\)\{showDestError\('link X first'\)/);
assert.match(FAUCET_CLIENT_JS, /faucet-quiet/);
assert.match(FAUCET_CLIENT_JS, /placeholder:'sig'/);
assert.match(FAUCET_CLIENT_JS, /rgba\(244,237,219,\.76\)/);
assert.match(FAUCET_CLIENT_JS, /copyTreasury\(btn, function/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /\.faucet-back,\.faucet-quiet\{[^}]*rgba\(244,237,219,\.56\)/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /n\+' of '\+total/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /paper\('Fill the jar'/);
assert.match(FAUCET_CLIENT_JS, /\/faucet\/dest-check/);
assert.match(FAUCET_CLIENT_JS, /kind==='IS_WALLET'/);
assert.match(FAUCET_CLIENT_JS, /function copyTreasury/);
assert.match(FAUCET_CLIENT_JS, /function hero\(/);
assert.match(FAUCET_CLIENT_JS, /faucet-hero/);
assert.match(FAUCET_CLIENT_JS, /faucet-card faucet-door/);
assert.match(FAUCET_CLIENT_JS, /faucet-card\.faucet-door\{animation:none\}/);
assert.match(FAUCET_CLIENT_JS, /\},12000\)/);
assert.match(FAUCET_CLIENT_JS, /confirmStuck/);
assert.match(FAUCET_CLIENT_JS, /faucet-note','try again'/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /state\.me&&state\.me\.nextAt/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /box\.appendChild\(el\('p','faucet-q',kind\)\)/);
assert.doesNotMatch(page, /dasha-faucet-static/);
assert.doesNotMatch(page, /simp\/photo\/faucet\.png/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /dasha-faucet-static/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /simp\/photo\/faucet\.png/);
assert.doesNotMatch(worker, /dasha-faucet-static/);
assert.doesNotMatch(worker, /simp\/photo\/faucet\.png/);

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
    this.width = 0;
    this.height = 0;
    this.src = '';
    this.alt = '';
    this.fetchPriority = '';
    this.crossOrigin = '';
    this.value = '';
    this.id = '';
    this.placeholder = '';
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v == null ? '' : v); }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === 'id') this.id = String(v);
  }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; if (k === 'id') this.id = ''; }
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
function texts(root) {
  return walk(root).map((n) => n._text).filter(Boolean);
}
function buttons(root) {
  return walk(root).filter((n) => n.tagName === 'BUTTON');
}
function boot(fetchImpl, clock, options = {}) {
  const leftover = new FakeEl('figure');
  leftover.id = 'dasha-faucet-static';
  leftover.setAttribute('id', 'dasha-faucet-static');
  const root = new FakeEl('main');
  root.id = 'dasha-faucet';
  root.setAttribute('id', 'dasha-faucet');
  root.setAttribute('data-faucet-api', 'https://lobby.getdasha.com');
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
  const assigned = [];
  const popup = Object.prototype.hasOwnProperty.call(options, 'popup') ? options.popup : { closed: false };
  const ctx = {
    window: {
      addEventListener() {}, removeEventListener() {},
      open() { return popup; },
      location: { assign(href) { assigned.push(String(href)); }, href: '' },
    },
    document: doc,
    navigator: { userAgent: options.userAgent || 'Mozilla/5.0', clipboard: { writeText() { return Promise.resolve(); } } },
    fetch: fetchImpl || (() => Promise.reject(new Error('offline'))),
    setTimeout: clock && clock.setTimeout || setTimeout,
    clearTimeout: clock && clock.clearTimeout || clearTimeout,
    setInterval: clock && clock.setInterval || setInterval,
    clearInterval: clock && clock.clearInterval || clearInterval,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Promise,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    JSON,
    Date,
    Math,
    console,
  };
  ctx.globalThis = ctx;
  ctx.window = Object.assign(ctx.window, { document: doc, navigator: ctx.navigator, fetch: ctx.fetch });
  vm.runInNewContext(FAUCET_CLIENT_JS, ctx);
  return { ctx, root, leftover, assigned };
}
function click(root, label) {
  const btn = buttons(root).find((n) => n._text === label);
  assert.ok(btn, 'missing ' + label);
  btn.listeners.click[0]({ preventDefault() {}, stopPropagation() {} });
  return btn;
}
function statusFetch({ funded = true, sol = 1, paused = false, autoPaused = false, me = { linked: false, claimed: false } } = {}) {
  return (url) => {
    const path = String(url);
    if (path.endsWith('/faucet/status')) {
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          configured: true, funded, balanceUi: 69000, solLamports: sol, treasury: TREASURY, amountUi: 100,
          paused, autoPaused, error: paused ? 'faucet_paused' : null,
        })),
      });
    }
    if (path.endsWith('/faucet/me')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify(me)) });
    }
    return Promise.reject(new Error(path));
  };
}

assert.doesNotMatch(FAUCET_CLIENT_JS, /jarEmpty\(\)\|\|needSol/);
assert.match(FAUCET_CLIENT_JS, /if\(jarEmpty\(\)\)box\.appendChild\(el\('p','faucet-note','jar empty'\)\)/);
assert.match(FAUCET_CLIENT_JS, /function jarEmpty\(\)\{var s=state\.status;if\(!s\)return false;if\(s\.funded===true\)return false;var n=jarUi\(s\);if\(n!=null&&n>0\)return false;return s\.funded===false;\}/);

{
  const { root, leftover } = boot();
  assert.ok(texts(root).includes('Once a day.'));
  const gos = buttons(root).filter((b) => String(b.className).includes('faucet-go'));
  assert.equal(gos.length, 1, 'door has one primary');
  assert.match(gos[0]._text, /^Get /);
  assert.equal(gos[0].disabled, false, 'first paint does not disable Get');
  assert.ok(String(gos[0].className).includes('faucet-send'));
  assert.ok(walk(root).some((n) => String(n.className).includes('faucet-door')), 'door card skips fade');
  const heroes = walk(root).filter((n) => n.tagName === 'IMG' && String(n.className).includes('faucet-hero'));
  assert.equal(heroes.length, 1, 'JS paints one framed hero');
  assert.equal(leftover.hidden, true, 'static leftover hidden if present');
  assert.ok(!texts(root).includes('jar empty'), 'first paint is not jar empty');
  const fill = buttons(root).find((b) => b._text === 'Fill the jar');
  assert.ok(fill, 'Fill the jar is the quiet side door');
  assert.ok(!String(fill.className).includes('faucet-go'), 'Fill is not a .faucet-go');
  assert.ok(String(fill.className).includes('faucet-quiet'));
  assert.ok(!texts(root).some((t) => /Paste address|typo check|cannot spend/.test(t)));
}

{
  const { root } = boot();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(!texts(root).includes('jar empty'), 'failed/missing funded is not empty');
  const get = buttons(root).find((b) => String(b._text).startsWith('Get '));
  assert.equal(get.disabled, false, 'Get stays enabled while funded is missing');
}

{
  const fetchImpl = (url) => {
    const path = String(url);
    if (path.endsWith('/faucet/status')) {
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          configured: true, funded: false, balanceUi: 0, solLamports: 0, treasury: TREASURY, amountUi: 100,
        })),
      });
    }
    if (path.endsWith('/faucet/me')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ linked: false, claimed: false })) });
    }
    return Promise.reject(new Error(path));
  };
  const { root } = boot(fetchImpl);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(texts(root).includes('jar empty'), 'funded===false and no tokens is empty');
  const get = buttons(root).find((b) => String(b._text).startsWith('Get '));
  assert.ok(get.disabled);
}

{
  const { root } = boot(statusFetch({ funded: false, sol: 0 }));
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(!texts(root).includes('jar empty'), 'tokens exist is not empty even if funded false');
}

{
  const { root } = boot(statusFetch({ funded: true, sol: 0 }));
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(texts(root).includes('Once a day.'));
  assert.ok(!texts(root).includes('jar empty'), 'funded + 0 SOL is not jar empty');
  const get = buttons(root).find((b) => String(b._text).startsWith('Get '));
  assert.equal(get.disabled, false, 'Get stays enabled when funded');
  const fill = buttons(root).find((b) => b._text === 'Fill the jar');
  assert.ok(fill);
  assert.ok(!String(fill.className).includes('faucet-go'));
}

{
  const { root } = boot(statusFetch({ funded: true, sol: 1 }));
  await new Promise((r) => setTimeout(r, 20));
  const get = buttons(root).find((b) => String(b._text).startsWith('Get '));
  assert.equal(get._text, 'Get 100');
  assert.equal(get.disabled, false);
  click(root, 'Get 100');
  assert.ok(texts(root).includes('Link X.'));
  assert.ok(buttons(root).some((b) => b._text === 'Link X.'));
  assert.equal(buttons(root).filter((b) => String(b.className).includes('faucet-go')).length, 1);
  assert.ok(!texts(root).some((t) => / of /.test(t)), 'no 1 of 3 step chrome');
  assert.ok(!walk(root).some((n) => n.id === 'dasha-faucet-dest'), 'no paste field on claim');
}

{
  const { root, assigned } = boot(statusFetch({ me: { linked: true, claimed: false } }));
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  assert.ok(texts(root).includes('Prove wallet.'));
  assert.ok(buttons(root).some((b) => b._text === 'Prove wallet.'));
  assert.ok(!texts(root).includes('Link X.'));
  click(root, 'Prove wallet.');
  assert.ok(texts(root).includes('Prove wallet.'), 'need Phantom stays on this card');
  assert.ok(buttons(root).some((b) => b._text === 'Open in Phantom.'), 'missing provider gets Phantom primary');
  click(root, 'Open in Phantom.');
  assert.deepEqual(assigned, ['https://phantom.app/ul/browse/' + encodeURIComponent('https://www.getdasha.com/faucet')]);
}


{
  const { root, assigned } = boot(statusFetch(), null, { popup: null });
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  click(root, 'Link X.');
  assert.deepEqual(assigned, ['https://lobby.getdasha.com/oauth/x/start?return=/faucet']);
  assert.ok(!texts(root).includes('link X'), 'blocked popup navigates; no false error');
}

{
  const { root, assigned } = boot(statusFetch(), null, { userAgent: 'Mozilla/5.0 Phantom/25.1 Mobile', popup: { closed: false } });
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  click(root, 'Link X.');
  assert.deepEqual(assigned, ['https://lobby.getdasha.com/oauth/x/start?return=/faucet']);
}

{
  const dest = TREASURY.slice(0, 40) + 'abcd';
  const { root } = boot(statusFetch({ me: { linked: true, claimed: true, dest, nextAt: Date.UTC(2026, 8, 25), signature: 'sig' } }));
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(texts(root).includes('Once a day.'), 'first paint stays the door');
  assert.ok(!texts(root).includes('already claimed'));
  click(root, 'Get 100');
  assert.ok(!texts(root).includes('already claimed'), 'done card is not a label dump');
  assert.ok(!texts(root).includes('2026-09-25'));
  assert.ok(texts(root).includes(dest.slice(-4)));
  assert.ok(walk(root).some((n) => String(n.className).includes('faucet-hole')));
  assert.ok(walk(root).some((n) => n._text === 'Solscan'), 'same sparse card as tipped');
}

{
  const { root } = boot(statusFetch({ paused: true, funded: false }));
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(texts(root).includes('jar empty') || texts(root).includes('paused'));
  const get = buttons(root).find((b) => String(b._text).startsWith('Get '));
  assert.ok(get.disabled);
}

{
  const { root } = boot(statusFetch({ autoPaused: true, sol: 1, funded: true }));
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(texts(root).includes('paused'));
  const get = buttons(root).find((b) => String(b._text).startsWith('Get '));
  assert.ok(get.disabled);
}

{
  const dest = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
  const { root } = boot(statusFetch({ me: { linked: true, claimed: false, dest, kind: 'IS_WALLET' } }));
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  assert.ok(texts(root).includes('tip me.'));
  assert.ok(texts(root).includes(dest.slice(-4)));
  assert.ok(buttons(root).some((b) => b._text === 'tip me'));
  assert.ok(!texts(root).some((t) => / of /.test(t)));
}

{
  const { root } = boot(statusFetch({ me: { linked: true, claimed: false, error: 'x_too_new' } }));
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  assert.ok(texts(root).includes('Link X.'));
  assert.ok(texts(root).includes('X too new'));
  assert.ok(!texts(root).includes('Prove wallet.'));
}

{
  const { root } = boot(statusFetch({ me: { linked: true, claimed: false, error: 'x_reauth' } }));
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  assert.ok(texts(root).includes('Link X.'));
  assert.ok(texts(root).includes('X too new'));
}

{
  const { ctx } = boot();
  const api = ctx.DashaFaucet || ctx.window.DashaFaucet;
  assert.equal(api.humanError('x_too_new'), 'X too new');
  assert.equal(api.humanError('x_reauth'), 'X too new');
  assert.equal(api.humanError('need Phantom'), 'need Phantom');
  assert.equal(api.humanError('dest_not_wallet'), 'not a wallet');
}

{
  const { root } = boot();
  click(root, 'Fill the jar');
  assert.ok(texts(root).includes('Copy.'));
  assert.equal(walk(root).find((n) => n.id === 'dasha-faucet-jar')._text, TREASURY);
  assert.ok(!walk(root).some((n) => n.id === 'dasha-faucet-sig'));
  const copyBtn = click(root, 'Copy address');
  assert.ok(!texts(root).includes('Sig.'), 'Copied shows before Sig');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(copyBtn._text, 'Copied');
  assert.ok(texts(root).includes('Copy.'));
  await new Promise((r) => setTimeout(r, 1100));
  assert.ok(texts(root).includes('Sig.'));
  const sig = walk(root).find((n) => n.id === 'dasha-faucet-sig');
  assert.ok(sig);
  assert.equal(sig.getAttribute('placeholder'), 'sig');
  assert.equal(sig.getAttribute('aria-label'), 'Sig');
  assert.ok(buttons(root).some((b) => b._text === 'Send'));
}


function makeClock() {
  let now = 0;
  let nid = 1;
  const timeouts = new Map();
  const intervals = new Map();
  return {
    setTimeout(fn, ms) {
      const id = nid++;
      timeouts.set(id, { fn, at: now + Number(ms || 0) });
      return id;
    },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn, ms) {
      const id = nid++;
      intervals.set(id, { fn, ms: Number(ms || 0), next: now + Number(ms || 0) });
      return id;
    },
    clearInterval(id) { intervals.delete(id); },
    elapse(ms) {
      const end = now + Number(ms || 0);
      while (true) {
        let nextAt = Infinity;
        for (const t of timeouts.values()) nextAt = Math.min(nextAt, t.at);
        for (const t of intervals.values()) nextAt = Math.min(nextAt, t.next);
        if (!Number.isFinite(nextAt) || nextAt > end) { now = end; return; }
        now = nextAt;
        const dueT = [...timeouts.entries()].filter(([, t]) => t.at <= now);
        const dueI = [...intervals.entries()].filter(([, t]) => t.next <= now);
        for (const [id, t] of dueT) { timeouts.delete(id); t.fn(); }
        for (const [id, t] of dueI) {
          if (!intervals.has(id)) continue;
          t.fn();
          if (intervals.has(id)) t.next += t.ms;
        }
      }
    },
  };
}

function hungClaimFetch(me) {
  const pending = [];
  const fetchImpl = (url) => {
    const path = String(url);
    if (path.endsWith('/faucet/status')) {
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          configured: true, funded: true, balanceUi: 69000, solLamports: 1, treasury: TREASURY, amountUi: 100,
        })),
      });
    }
    if (path.endsWith('/faucet/me')) {
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify(me)) });
    }
    if (path.endsWith('/faucet/claim')) {
      return new Promise((resolve) => pending.push(resolve));
    }
    return Promise.reject(new Error(path));
  };
  return { fetchImpl, pending };
}


{
  const dest = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
  const clock = makeClock();
  const { fetchImpl, pending } = hungClaimFetch({ linked: true, claimed: false, dest, kind: 'IS_WALLET' });
  const { root } = boot(fetchImpl, clock);
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  assert.ok(texts(root).includes('tip me.'));
  click(root, 'tip me');
  assert.ok(texts(root).includes('confirming'));
  assert.ok(!texts(root).includes('try again'), 'no retry before 12s');
  assert.equal(pending.length, 1, 'tip me sends once');
  clock.elapse(11999);
  assert.ok(texts(root).includes('confirming'));
  assert.ok(!texts(root).includes('try again'), 'still confirming at 11.999s');
  clock.elapse(1);
  assert.ok(texts(root).includes('confirming'));
  assert.ok(texts(root).includes('try again'));
  const retry = buttons(root).find((b) => b._text === 'Try again');
  assert.ok(retry, 'acid Try again after hang');
  assert.ok(String(retry.className).includes('faucet-go'));
  const sent = pending.length;
  click(root, 'Try again');
  assert.ok(texts(root).includes('tip me.'));
  assert.ok(!texts(root).includes('confirming'));
  assert.equal(pending.length, sent, 'Try again does not invent a second send');
}

{
  const dest = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
  const clock = makeClock();
  const { fetchImpl, pending } = hungClaimFetch({ linked: true, claimed: false, dest, kind: 'IS_WALLET' });
  const { root } = boot(fetchImpl, clock);
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  click(root, 'tip me');
  clock.elapse(12000);
  assert.ok(texts(root).includes('try again'));
  pending[0]({
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ ok: true, signature: 'landedSig', dest, solscan: 'https://solscan.io/tx/landedSig' })),
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(texts(root).includes(dest.slice(-4)), 'late land still tipped');
  assert.ok(walk(root).some((n) => n._text === 'Solscan'), 'tipped shows Solscan');
  assert.ok(!texts(root).includes('confirming'));
}


{
  const { root } = boot(statusFetch({ funded: true, sol: 1 }));
  const first = buttons(root).find((b) => String(b._text).startsWith('Get '));
  assert.ok(first, 'door Get 100');
  assert.ok(first.listeners.click && first.listeners.click.length, 'Get 100 has a click handler');
  await new Promise((r) => setTimeout(r, 20));
  const after = buttons(root).find((b) => String(b._text).startsWith('Get '));
  assert.equal(after, first, 'status refresh must not remount the door Get 100 node');
  assert.ok(first.listeners.click && first.listeners.click.length, 'first Get 100 stays attached');
  click(root, 'Get 100');
  assert.ok(texts(root).includes('Link X.'), 'first click after status still opens Link X');
}

console.log('dasha-faucet-client-shape: PASS');
