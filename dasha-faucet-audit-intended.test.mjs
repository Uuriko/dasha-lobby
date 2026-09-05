#!/usr/bin/env node
/**
 * Intended faucet product. No live claim spend. No donate/withdraw broadcast. No keypairs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  FAUCET_MINT,
  FAUCET_TREASURY_DEFAULT,
  FAUCET_AMOUNT_UI,
  FAUCET_COOLDOWN_MS,
  FAUCET_DAILY_CAP_DEFAULT,
  FAUCET_HOURLY_CAP_DEFAULT,
  FAUCET_MIN_X_AGE_DAYS_DEFAULT,
  FAUCET_SIWS_DOMAIN,
  destShapeError,
  claimAllowed,
  checkRateLimits,
  checkXEligibility,
  siwsMessageError,
  faucetSiwsInput,
  isFaucetPublicReadPath,
  utcDayKey,
} from './dasha-faucet.mjs';
import { SOLANA_PUBLIC_RPCS, solanaRpcList } from './dasha-faucet-solana.mjs';
import edgeWorker, { DashaFaucet } from './dasha-lobby-worker.mjs';
import { FAUCET_CLIENT_JS, FAUCET_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const POTTER = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
const TG = 'https://t.me/+xB7S8mIQaKFiZjRh';
const client = readFileSync(new URL('./dasha-faucet-client.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('./dasha-lobby-worker.mjs', import.meta.url), 'utf8');
const page = readFileSync(new URL('./dasha-faucet-page.html', import.meta.url), 'utf8');

assert.equal(FAUCET_MINT, MINT);
assert.equal(FAUCET_TREASURY_DEFAULT, TREASURY);
assert.equal(FAUCET_AMOUNT_UI, 100);
assert.equal(FAUCET_COOLDOWN_MS, 86400000);
assert.equal(FAUCET_DAILY_CAP_DEFAULT, 48);
assert.equal(FAUCET_HOURLY_CAP_DEFAULT, 12);
assert.equal(FAUCET_MIN_X_AGE_DAYS_DEFAULT, 7);
assert.equal(FAUCET_SIWS_DOMAIN, 'lobby.getdasha.com');
assert.equal(SOLANA_PUBLIC_RPCS[0], 'https://public.rpc.solanavibestation.com');
assert.equal(solanaRpcList({})[0], 'https://public.rpc.solanavibestation.com');
assert.equal(FAUCET_CLIENT_JS, client);

assert.doesNotMatch(client, /plugin\.jup\.ag/);
assert.doesNotMatch(page, /plugin\.jup\.ag/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /plugin\.jup\.ag/);
assert.doesNotMatch(worker, /plugin\.jup\.ag/);
assert.doesNotMatch(client + page + FAUCET_PAGE_HTML, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);
assert.doesNotMatch(client + page + FAUCET_PAGE_HTML, /not an airdrop|This is not a transaction|cannot spend|disclaimer/i);
assert.match(worker, /t\.me\/\+xB7S8mIQaKFiZjRh/);
assert.match(client, /Once a day\./);
assert.match(client, /Link X\./);
assert.match(client, /Prove wallet\./);
assert.match(client, /tip me/);
assert.match(client, /Fill the jar/);
assert.match(client, /phantom\.app\/ul\/browse\//);
assert.match(client, /oauth\/x\/start\?return=\/faucet/);
assert.doesNotMatch(client, /Paste address/);
assert.doesNotMatch(client, /if\(!xPopup\)\{showDestError\('link X first'\)/);

assert.equal(destShapeError(MINT), 'dest_mint');
assert.equal(destShapeError(TREASURY), 'dest_treasury');
assert.equal(destShapeError(TG), 'dest_not_wallet');
assert.equal(destShapeError('https://t.me/+xB7S8mIQaKFiZjRh'), 'dest_not_wallet');
assert.equal(destShapeError(POTTER), '');

assert.equal(claimAllowed({ byX: {}, byWallet: {} }, { xId: '', wallet: POTTER, proven: true }).error, 'link X first');
assert.equal(checkXEligibility({}).error, 'link X first');
const now = Date.parse('2026-09-03T12:00:00Z');
assert.equal(checkXEligibility({ xId: '1', xCreatedAt: now - 2 * 86400000 }, { minXAgeDays: 7, now }).error, 'x_too_new');
assert.equal(checkXEligibility({ xId: '1', xCreatedAt: now - 8 * 86400000 }, { minXAgeDays: 7, now }).ok, true);

const day = utcDayKey(now);
const caps = { paused: false, dailyCap: 48, hourlyCap: 12 };
assert.equal(checkRateLimits({ dayKey: day, dayCount: 48 }, caps, { now, rng: () => 1 }).error, 'daily_cap');
assert.equal(checkRateLimits({ autoPausedUntil: now + 1000 }, caps, { now, rng: () => 1 }).error, 'hourly_cap');
assert.equal(checkRateLimits({ dayKey: day, dayCount: 1, hourKey: 'x', hourCount: 0 }, caps, { now, rng: () => 1 }).ok, true);

const claimedAt = now - 1000;
assert.equal(claimAllowed({
  byX: { '1': { at: claimedAt, signature: 'sig' } },
  byWallet: {},
}, { xId: '1', wallet: POTTER, proven: true, now, cooldownMs: FAUCET_COOLDOWN_MS }).error, 'already claimed');

const siws = faucetSiwsInput({
  domain: FAUCET_SIWS_DOMAIN,
  publicKey: POTTER,
  nonce: 'n1',
  issuedAt: now,
  expirationTime: now + 60000,
});
assert.equal(siws.domain, 'lobby.getdasha.com');
assert.equal(siws.uri, 'https://lobby.getdasha.com/');
const msg = `${siws.domain} wants you to sign in with your Solana account:\n${siws.address}\n\n${siws.statement}\n\nURI: ${siws.uri}\nNonce: ${siws.nonce}`;
assert.equal(siwsMessageError(msg, { publicKey: POTTER, domain: FAUCET_SIWS_DOMAIN, nonce: 'n1' }), '');
assert.equal(siwsMessageError(msg.replaceAll(FAUCET_SIWS_DOMAIN, 'evil.example'), { publicKey: POTTER, domain: FAUCET_SIWS_DOMAIN, nonce: 'n1' }), 'siws_domain');

assert.equal(isFaucetPublicReadPath('/faucet/status'), true);
assert.equal(isFaucetPublicReadPath('/faucet/me'), true);
assert.equal(isFaucetPublicReadPath('/faucet/claim'), false);
assert.equal(isFaucetPublicReadPath('/faucet/wallet/challenge'), false);

function mockState() {
  const store = new Map();
  return {
    blockConcurrencyWhile: async (fn) => fn(),
    storage: {
      get: async (key) => store.get(key),
      put: async (key, value) => {
        if (key && typeof key === 'object' && !Array.isArray(key)) {
          for (const [k, v] of Object.entries(key)) store.set(k, v);
          return;
        }
        store.set(key, value);
      },
    },
  };
}

const STATUS = {
  configured: true,
  funded: true,
  amountUi: 100,
  balanceUi: 168800,
  dailyCap: 48,
  dailyRemaining: 47,
  hourlyCap: 12,
  minXAgeDays: 7,
  mint: MINT,
  treasury: TREASURY,
};
const faucetStub = {
  idFromName() { return 'main'; },
  get() {
    return {
      fetch() {
        return Promise.resolve(new Response(JSON.stringify(STATUS), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        }));
      },
    };
  },
};
const edgeEnv = { FAUCET: faucetStub, ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com' };
const wwwStatus = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/status'), edgeEnv);
const lobbyStatus = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/faucet/status'), edgeEnv);
assert.equal(wwwStatus.status, 200);
assert.equal(lobbyStatus.status, 200);
assert.deepEqual(await wwwStatus.json(), await lobbyStatus.json());

const faucet = new DashaFaucet(mockState(), {
  LOBBY_SESSION_SECRET: 'lobby-session-secret-for-tests',
  FAUCET_TREASURY: TREASURY,
  MINT,
  ALLOW_ANY_ORIGIN: '1',
  ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
});
const claimRes = await faucet.fetch(new Request('https://lobby.getdasha.com/faucet/claim', {
  method: 'POST',
  headers: { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' },
  body: JSON.stringify({ dest: POTTER }),
}));
const claimBody = await claimRes.json();
assert.equal(claimRes.status, 401);
assert.equal(claimBody.error, 'link X first');

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
function click(root, label) {
  const btn = buttons(root).find((n) => n._text === label);
  assert.ok(btn, 'missing ' + label);
  btn.listeners.click[0]({ preventDefault() {}, stopPropagation() {} });
  return btn;
}
function boot(me, extra = {}) {
  const leftover = new FakeEl('figure');
  leftover.id = 'dasha-faucet-static';
  leftover.setAttribute('id', 'dasha-faucet-static');
  const root = new FakeEl('main');
  root.id = 'dasha-faucet';
  root.setAttribute('id', 'dasha-faucet');
  root.setAttribute('data-faucet-api', 'https://lobby.getdasha.com');
  const assigned = [];
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
  const fetchImpl = (url) => {
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
    return Promise.reject(new Error(path));
  };
  const popup = Object.prototype.hasOwnProperty.call(extra, 'popup') ? extra.popup : { closed: false };
  const ctx = {
    window: {
      addEventListener() {},
      removeEventListener() {},
      open() { return popup; },
      location: { assign(href) { assigned.push(String(href)); }, href: '' },
    },
    document: doc,
    navigator: { userAgent: extra.userAgent || 'Mozilla/5.0', clipboard: { writeText() { return Promise.resolve(); } } },
    fetch: fetchImpl,
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
    console,
  };
  ctx.globalThis = ctx;
  ctx.window = Object.assign(ctx.window, { document: doc, navigator: ctx.navigator, fetch: ctx.fetch });
  vm.runInNewContext(FAUCET_CLIENT_JS, ctx);
  return { root, assigned };
}

{
  const { root } = boot({ linked: false, claimed: false });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(texts(root).includes('Once a day.'));
  assert.ok(buttons(root).some((b) => b._text === 'Get 100'));
  assert.ok(buttons(root).some((b) => b._text === 'Fill the jar'));
  assert.ok(!String(buttons(root).find((b) => b._text === 'Fill the jar').className).includes('faucet-go'));
  click(root, 'Get 100');
  assert.ok(texts(root).includes('Link X.'));
  assert.ok(!walk(root).some((n) => n.id === 'dasha-faucet-dest'), 'paste stays off claim');
  assert.ok(!texts(root).includes('Paste address'));
}

{
  const { root } = boot({ linked: true, claimed: false });
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  assert.ok(texts(root).includes('Prove wallet.'));
  click(root, 'Prove wallet.');
  assert.ok(buttons(root).some((b) => b._text === 'Open in Phantom.'));
}

{
  const { root } = boot({ linked: true, claimed: false, dest: POTTER, kind: 'IS_WALLET' });
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  assert.ok(texts(root).includes('tip me.'));
}

{
  const { root, assigned } = boot({ linked: false, claimed: false }, { popup: null });
  await new Promise((r) => setTimeout(r, 20));
  click(root, 'Get 100');
  click(root, 'Link X.');
  assert.deepEqual(assigned, ['https://lobby.getdasha.com/oauth/x/start?return=/faucet']);
}

{
  const { root } = boot({ linked: false, claimed: false });
  click(root, 'Fill the jar');
  assert.ok(texts(root).includes('Copy.'));
  assert.ok(!texts(root).includes('Get 100'));
}

assert.match(worker, /id=["']dasha-home-faucet["']|HOME_FAUCET_MOUNT/);
assert.match(worker, /chatBit\}\$\{simpBit\}\$\{faucetBit/);

console.log('dasha-faucet-audit-intended: PASS');
