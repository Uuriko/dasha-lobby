#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  FAUCET_MINT,
  FAUCET_TREASURY_DEFAULT,
  FAUCET_WITHDRAW_DEST,
  buildStatus,
  donateAmountUi,
  humanError,
  jarBalanceUi,
  jarCopyAddress,
  jarHeadline,
  jarSolNote,
} from './dasha-faucet.mjs';
import { FAUCET_CLIENT_JS, FAUCET_CLIENT_SRI, FAUCET_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const POTTER = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
const root = new URL('./', import.meta.url);
const worker = readFileSync(new URL('./dasha-lobby-worker.mjs', root), 'utf8');
const page = readFileSync(new URL('./dasha-faucet-page.html', root), 'utf8');

const cfg = {
  configured: true,
  paused: false,
  hasSigner: true,
  amountRaw: 100_000_000n,
  amountUi: 100,
  decimals: 6,
  cooldownDays: 1,
  mint: FAUCET_MINT,
  treasury: TREASURY,
};

const live = buildStatus(cfg, { balanceRaw: 69_000_000_000n, rpcOk: true, solLamports: 0n });
assert.equal(live.funded, true);
assert.equal(live.balanceUi, 69000);
assert.equal(live.solLamports, 0);
assert.equal(live.treasury, TREASURY);
assert.equal(jarBalanceUi(live), 69000);
assert.equal(jarHeadline(live), '69000 $dasha in the jar.');
assert.equal(jarSolNote(live), 'Jar needs a drop of SOL.');
assert.equal(jarCopyAddress(live), TREASURY);
assert.equal(jarCopyAddress({ treasury: 'nope' }), TREASURY);
assert.equal(donateAmountUi(69_000_000_000n), 69000);

const solOk = buildStatus(cfg, { balanceRaw: 69_000_000_000n, rpcOk: true, solLamports: 1_000_000n });
assert.equal(jarSolNote(solOk), '');
assert.equal(solOk.solLamports, 1_000_000);

const down = buildStatus(cfg, {});
assert.equal(down.treasury, TREASURY);
assert.equal(down.solLamports, null);
assert.equal(jarHeadline(down), '0 $dasha in the jar.');
assert.equal(jarSolNote(down), '');

const paused = buildStatus({ ...cfg, paused: true }, { balanceRaw: 69_000_000_000n, rpcOk: true, solLamports: 0n });
assert.equal(paused.funded, false);
assert.equal(paused.balanceUi, 69000);
assert.equal(jarSolNote(paused), 'Jar needs a drop of SOL.');

assert.equal(humanError('link X first'), 'link X first');
assert.equal(humanError('treasury_empty'), 'treasury_empty');
assert.ok(humanError('claim 401').length < 24);
assert.ok(!/please|sorry|unfortunately/i.test(humanError('rpc_unavailable')));

assert.equal(FAUCET_TREASURY_DEFAULT, TREASURY);
assert.equal(FAUCET_WITHDRAW_DEST, POTTER);

const sri = 'sha384-' + createHash('sha384').update(FAUCET_CLIENT_JS).digest('base64');
assert.equal(FAUCET_CLIENT_SRI, sri);
assert.match(FAUCET_PAGE_HTML, new RegExp(sri.replace(/[+/]/g, '\\$&')));
assert.match(page, new RegExp(sri.replace(/[+/]/g, '\\$&')));
assert.match(worker, /FAUCET_CLIENT_SRI/);
assert.match(worker, /function pinFaucetScript/);
assert.doesNotMatch(worker, /KThkiViv/);
assert.match(worker, /solLamports/);
assert.match(worker, /getBalance/);
assert.match(worker, /path === '\/faucet\/withdraw'/);
assert.match(worker, /FAUCET_WITHDRAW_DEST/);
assert.doesNotMatch(worker, /plugin\.jup\.ag/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /plugin\.jup\.ag/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /\/faucet\/withdraw/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /\/faucet\/withdraw/);
assert.match(FAUCET_CLIENT_JS, /function copyTreasury/);
assert.match(FAUCET_CLIENT_JS, /function refreshStatus/);
assert.match(FAUCET_CLIENT_JS, /Once a day\./);
assert.doesNotMatch(page, /dasha-faucet-static/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /dasha-faucet-static/);
assert.match(FAUCET_CLIENT_JS, /function hero\(/);
assert.match(FAUCET_CLIENT_JS, /\},12000\)/);
assert.match(FAUCET_CLIENT_JS, /Fill the jar/);
assert.match(FAUCET_CLIENT_JS, /jar empty/);
assert.match(FAUCET_CLIENT_JS, /var treas=TREASURY/);
assert.match(FAUCET_CLIENT_JS, /writeText\(text\)/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /function boot\(\)\{hideLeftover\(\);/);
assert.match(FAUCET_CLIENT_JS, /DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN/);

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

function installDom({ hasRoot = true, apiAttr = 'https://lobby.getdasha.com', fetchImpl } = {}) {
  const leftover = new FakeEl('figure');
  leftover.id = 'dasha-faucet-static';
  leftover.setAttribute('id', 'dasha-faucet-static');
  const root = hasRoot ? new FakeEl('main') : null;
  if (root) {
    root.id = 'dasha-faucet';
    root.setAttribute('id', 'dasha-faucet');
    if (apiAttr != null) root.setAttribute('data-faucet-api', apiAttr);
  }
  const body = new FakeEl('body');
  const copied = { text: '' };
  const doc = {
    readyState: 'complete',
    activeElement: null,
    body,
    documentElement: body,
    getElementById(id) {
      if (id === 'dasha-faucet') return root;
      if (id === 'dasha-faucet-static') return leftover;
      return walk(root || leftover).find((n) => n.id === id || n.attrs.id === id) || null;
    },
    createElement(tag) { return new FakeEl(tag); },
    addEventListener() {},
    removeEventListener() {},
  };
  const ctx = {
    window: {
      addEventListener() {},
      removeEventListener() {},
      open() { return null; },
    },
    document: doc,
    navigator: {
      clipboard: {
        writeText(t) { copied.text = String(t); return Promise.resolve(); },
        readText() { return Promise.resolve(copied.text); },
      },
    },
    fetch: fetchImpl || (() => Promise.reject(new Error('offline'))),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
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
    BigInt,
    isFinite,
    isNaN,
    parseInt,
    console,
  };
  ctx.globalThis = ctx;
  ctx.window = Object.assign(ctx.window, { document: doc, navigator: ctx.navigator, fetch: ctx.fetch });
  vm.runInNewContext(FAUCET_CLIENT_JS, ctx);
  return { ctx, root, leftover, copied, doc };
}

{
  const { leftover, ctx } = installDom({ hasRoot: false });
  assert.equal(leftover.hidden, false, 'missing #dasha-faucet must not hide leftover / empty the page');
  const api = ctx.DashaFaucet || ctx.window.DashaFaucet;
  assert.ok(api);
  assert.equal(api.TREASURY, TREASURY);
  assert.equal(api.apiBase(null), 'https://lobby.getdasha.com');
  assert.equal(api.apiBase({ getAttribute: () => null }), 'https://lobby.getdasha.com');
  assert.equal(api.humanError('treasury_empty'), 'jar empty');
  assert.ok(api.humanError('claim 401').length < 24);
}

{
  const { root, leftover, copied, ctx } = installDom({ apiAttr: null });
  assert.equal(leftover.hidden, true);
  assert.ok(root.getAttribute('data-faucet-mounted'));
  assert.ok(root.children.length > 0, 'missing data-faucet-api still mounts');
  const donate = walk(root).find((n) => n.tagName === 'BUTTON' && n._text === 'Fill the jar');
  assert.ok(donate, 'fill lives even when status fails');
  assert.ok(!String(donate.className).includes('faucet-go'), 'Fill is quiet, not a .faucet-go');
  donate.listeners.click[0]({ preventDefault() {}, stopPropagation() {} });
  const jar = walk(root).find((n) => n.id === 'dasha-faucet-jar');
  assert.ok(jar, 'fill card shows treasury when status fails');
  assert.equal(jar._text, TREASURY);
  const copy = walk(root).find((n) => n.tagName === 'BUTTON' && n._text === 'Copy address');
  assert.ok(copy);
  copy.listeners.click[0]();
  assert.equal(copied.text, TREASURY);
  assert.ok(!walk(root).some((n) => n.id === 'dasha-faucet-sig'), 'sig waits for Copied');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(copy._text, 'Copied');
  await new Promise((r) => setTimeout(r, 1100));
  assert.ok(walk(root).some((n) => n.id === 'dasha-faucet-sig'), 'sig step after copy');
  const api = ctx.DashaFaucet || ctx.window.DashaFaucet;
  assert.equal(api.needSol({ solLamports: 0 }), true);
  assert.equal(api.needSol({ solLamports: 1 }), false);
  assert.equal(api.jarUi({ balanceUi: 69000 }), 69000);
}

{
  let donateHits = 0;
  let statusHits = 0;
  const fetchImpl = (url, init) => {
    const path = String(url);
    if (path.endsWith('/faucet/status') || path.endsWith('/faucet/me')) {
      if (path.endsWith('/faucet/status')) statusHits += 1;
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify(
          path.endsWith('/faucet/status')
            ? { configured: true, funded: true, balanceUi: statusHits > 1 ? 70000 : 69000, solLamports: 0, treasury: TREASURY, amountUi: 100 }
            : { linked: false, claimed: false },
        )),
      });
    }
    if (path.endsWith('/faucet/donate')) {
      donateHits += 1;
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ ok: true, landed: true, amountUi: 1000, signature: 'sig' })),
      });
    }
    return Promise.reject(new Error(path));
  };
  const { root } = installDom({ fetchImpl });
  await new Promise((r) => setTimeout(r, 20));
  const q = walk(root).find((n) => n.className.includes('faucet-q') && n._text === 'Once a day.');
  assert.ok(q, 'door question Once a day');
  assert.ok(!walk(root).some((n) => n._text === 'jar empty'), 'funded + 0 SOL is not jar empty');
  const get = walk(root).find((n) => n.tagName === 'BUTTON' && String(n._text).startsWith('Get '));
  assert.ok(get && !get.disabled, 'Get stays enabled when funded');
  const donate = walk(root).find((n) => n.tagName === 'BUTTON' && n._text === 'Fill the jar');
  donate.listeners.click[0]({ preventDefault() {}, stopPropagation() {} });
  const copy = walk(root).find((n) => n.tagName === 'BUTTON' && n._text === 'Copy address');
  copy.listeners.click[0]({ preventDefault() {}, stopPropagation() {} });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(copy._text, 'Copied');
  await new Promise((r) => setTimeout(r, 1100));
  const check = walk(root).find((n) => n.tagName === 'BUTTON' && n._text === 'Send');
  const sig = walk(root).find((n) => n.id === 'dasha-faucet-sig');
  sig.value = '1111111111111111111111111111111111111111111111111111111111111111';
  check.listeners.click[0]();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(donateHits, 1);
  assert.ok(statusHits >= 2, 'good sig hits donate then status');
}

console.log('dasha-faucet-jar: PASS (status jar, funded+0 SOL no empty lie, donate survives status miss, copy full treasury, no public withdraw)');
