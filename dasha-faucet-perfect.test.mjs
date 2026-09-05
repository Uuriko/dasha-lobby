#!/usr/bin/env node
/**
 * Dry proof that every faucet function matches SOURCE.
 * No live donate, no claim spend, no --broadcast withdraw, no keypair prints.
 */
import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as ed from '@noble/ed25519';
import {
  FAUCET_MINT,
  FAUCET_TREASURY_DEFAULT,
  FAUCET_WITHDRAW_DEST,
  FAUCET_AMOUNT_UI,
  FAUCET_COOLDOWN_MS,
  FAUCET_COOLDOWN_DAYS_DEFAULT,
  FAUCET_DAILY_CAP_DEFAULT,
  FAUCET_HOURLY_CAP_DEFAULT,
  FAUCET_MIN_X_AGE_DAYS_DEFAULT,
  FAUCET_PAUSE_MIN_MS,
  FAUCET_PAUSE_MAX_MS,
  attachJarFields,
  buildStatus,
  burstPauseChance,
  burstPressure,
  claimAllowed,
  checkRateLimits,
  checkXEligibility,
  destShapeError,
  donateAmountUi,
  donateFailClosed,
  donateSigError,
  faucetAdminOk,
  faucetConfig,
  faucetSignerSecret,
  humanError,
  inspectDonateTx,
  jarCopyAddress,
  jarHeadline,
  jarSolNote,
  noteSuccessfulClaim,
  planTreasuryWithdraw,
  recordClaim,
  utcDayKey,
  utcHourKey,
} from './dasha-faucet.mjs';
import {
  buildSignedWithdrawTx,
  buildWithdrawInstructions,
  publicKeyFromSecret,
  sendTreasuryWithdraw,
} from './dasha-faucet-solana.mjs';
import { DashaFaucet } from './dasha-lobby-worker.mjs';
import { FAUCET_CLIENT_JS, FAUCET_CLIENT_SRI, FAUCET_PAGE_HTML } from './dasha-lobby-static-gen.mjs';
import {
  COOKIE,
  createSessionToken,
  fetchXUser,
  sessionFromRequest,
} from './dasha-lobby-x.mjs';

const TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const POTTER = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const JAR_RAW = 69_000_000_000n;
const GOOD_SIG = '1'.repeat(64);
const root = new URL('./', import.meta.url);
const workerSrc = readFileSync(new URL('./dasha-lobby-worker.mjs', root), 'utf8');
const pageSrc = readFileSync(new URL('./dasha-faucet-page.html', root), 'utf8');
const cliSrc = readFileSync(new URL('../bin/dasha-faucet-withdraw', root), 'utf8');
const faucetSrc = readFileSync(new URL('./dasha-faucet.mjs', root), 'utf8');
const solanaSrc = readFileSync(new URL('./dasha-faucet-solana.mjs', root), 'utf8');

const cfg = {
  configured: true,
  paused: false,
  hasSigner: true,
  amountRaw: 100_000_000n,
  amountUi: 100,
  decimals: 6,
  cooldownDays: 1,
  mint: MINT,
  treasury: TREASURY,
};

let testSecret = '';
let testPayer = '';
const realFetch = globalThis.fetch;
let rpcCalls = [];

function jsonRpc(result) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installRpc({ sol = 0, tokenRaw = JAR_RAW, destAtaExists = true, tx = null } = {}) {
  rpcCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    let body = {};
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body); } catch { body = {}; }
    }
    rpcCalls.push({ url: String(url), method: body.method || init.method || 'GET', params: body.params });
    if (body.method === 'sendTransaction') {
      throw new Error('sendTransaction must not run in faucet-perfect tests');
    }
    if (body.method === 'getBalance') return jsonRpc({ value: Number(sol) });
    if (body.method === 'getTokenAccountBalance') {
      return jsonRpc({ value: { amount: String(tokenRaw), decimals: 6 } });
    }
    if (body.method === 'getTokenAccountsByOwner') {
      return jsonRpc({
        value: BigInt(tokenRaw) > 0n
          ? [{ account: { data: { parsed: { info: { mint: MINT, tokenAmount: { amount: String(tokenRaw) } } } } } }]
          : [],
      });
    }
    if (body.method === 'getAccountInfo') return jsonRpc({ value: destAtaExists ? { lamports: 1, data: ['', 'base64'] } : null });
    if (body.method === 'getLatestBlockhash') {
      return jsonRpc({ value: { blockhash: '11111111111111111111111111111111' } });
    }
    if (body.method === 'getTransaction') return jsonRpc(tx);
    return jsonRpc(null);
  };
}

function sentOnChain() {
  return rpcCalls.some((c) => c.method === 'sendTransaction');
}

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

function makeFaucet(extra = {}) {
  const env = {
    LOBBY_SESSION_SECRET: 'lobby-session-secret-for-tests',
    FAUCET_TREASURY: TREASURY,
    MINT,
    FAUCET_ADMIN: 'admin-secret-for-tests',
    ALLOW_ANY_ORIGIN: '1',
    ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
    ...extra,
  };
  return { faucet: new DashaFaucet(mockState(), env), env };
}

async function callFaucet(faucet, path, { method = 'GET', body, headers = {} } = {}) {
  const init = {
    method,
    headers: { Origin: 'https://www.getdasha.com', ...headers },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await faucet.fetch(new Request(`https://lobby.getdasha.com${path}`, init));
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, text };
}

function donateTx({
  treasury = TREASURY,
  mint = MINT,
  payer = 'So11111111111111111111111111111111111111112',
  pre = '0',
  post = '1000000000',
  blockTime = Math.floor(Date.now() / 1000) - 30,
  err = null,
} = {}) {
  return {
    blockTime,
    meta: {
      err,
      preTokenBalances: [{ owner: treasury, mint, uiTokenAmount: { amount: pre } }],
      postTokenBalances: [{ owner: treasury, mint, uiTokenAmount: { amount: post } }],
    },
    transaction: { message: { accountKeys: [payer] }, signatures: [GOOD_SIG] },
  };
}

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

function bootClient({ fetchImpl } = {}) {
  const leftover = new FakeEl('figure');
  leftover.id = 'dasha-faucet-static';
  leftover.setAttribute('id', 'dasha-faucet-static');
  const rootEl = new FakeEl('main');
  rootEl.id = 'dasha-faucet';
  rootEl.setAttribute('id', 'dasha-faucet');
  rootEl.setAttribute('data-faucet-api', 'https://lobby.getdasha.com');
  const copied = { text: '' };
  const doc = {
    readyState: 'complete',
    activeElement: null,
    body: new FakeEl('body'),
    getElementById(id) {
      if (id === 'dasha-faucet') return rootEl;
      if (id === 'dasha-faucet-static') return leftover;
      return walk(rootEl).find((n) => n.id === id || n.attrs.id === id) || null;
    },
    createElement(tag) { return new FakeEl(tag); },
    addEventListener() {},
    removeEventListener() {},
  };
  const ctx = {
    window: { addEventListener() {}, removeEventListener() {}, open() { return null; } },
    document: doc,
    navigator: { clipboard: { writeText(t) { copied.text = String(t); return Promise.resolve(); } } },
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
    console,
  };
  ctx.globalThis = ctx;
  ctx.window = Object.assign(ctx.window, { document: doc, navigator: ctx.navigator, fetch: ctx.fetch });
  vm.runInNewContext(FAUCET_CLIENT_JS, ctx);
  return { ctx, root: rootEl, leftover, copied };
}

before(async () => {
  const seed = new Uint8Array(32);
  seed[0] = 7;
  seed[1] = 11;
  seed[31] = 3;
  const pub = await ed.getPublicKeyAsync(seed);
  testSecret = JSON.stringify([...seed, ...pub]);
  testPayer = await publicKeyFromSecret(testSecret);
});

beforeEach(() => {
  rpcCalls = [];
  globalThis.fetch = realFetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  rpcCalls = [];
});

describe('source constants', () => {
  it('locks mint, treasury, Potter dest, tip size, cooldown, caps', () => {
    assert.equal(FAUCET_MINT, MINT);
    assert.equal(FAUCET_TREASURY_DEFAULT, TREASURY);
    assert.equal(FAUCET_WITHDRAW_DEST, POTTER);
    assert.equal(FAUCET_AMOUNT_UI, 100);
    assert.equal(FAUCET_COOLDOWN_DAYS_DEFAULT, 1);
    assert.equal(FAUCET_COOLDOWN_MS, 24 * 60 * 60 * 1000);
    assert.equal(FAUCET_DAILY_CAP_DEFAULT, 48);
    assert.equal(FAUCET_HOURLY_CAP_DEFAULT, 12);
    assert.equal(FAUCET_MIN_X_AGE_DAYS_DEFAULT, 7);
    assert.equal(TREASURY.length, 44);
    assert.equal(POTTER.length, 44);
    assert.notEqual(TREASURY, POTTER);
  });
});

describe('status shape', () => {
  it('public status has treasury, balanceUi, solLamports, amountUi and never dest', () => {
    const status = buildStatus(cfg, { balanceRaw: JAR_RAW, rpcOk: true, solLamports: 0n });
    assert.equal(status.treasury, TREASURY);
    assert.equal(status.balanceUi, 69000);
    assert.equal(status.solLamports, 0);
    assert.equal(status.amountUi, 100);
    assert.equal(status.funded, true);
    assert.equal(status.dest, undefined);
    const dump = JSON.stringify(status);
    assert.ok(!dump.includes(POTTER), 'withdraw dest must not appear on public status');
    assert.doesNotMatch(dump, /FAUCET_KEYPAIR|secret64|"seed"/);
  });

  it('route status exposes signer as boolean only and omits dest', async () => {
    installRpc({ sol: 0, tokenRaw: JAR_RAW });
    const { faucet } = makeFaucet({ FAUCET_KEYPAIR: testSecret });
    const out = await callFaucet(faucet, '/faucet/status');
    assert.equal(out.status, 200);
    assert.equal(typeof out.data.signer, 'boolean');
    assert.equal(out.data.signer, true);
    assert.equal(out.data.amountUi, 100);
    assert.equal(out.data.balanceUi, 69000);
    assert.equal(out.data.solLamports, 0);
    assert.equal(out.data.dest, undefined);
    assert.ok(!out.text.includes(POTTER));
    assert.ok(!out.text.includes(testSecret));
    assert.ok(!sentOnChain());
  });

  it('route status without signer still names the jar and leaks no dest', async () => {
    const { faucet } = makeFaucet();
    const out = await callFaucet(faucet, '/faucet/status');
    assert.equal(out.status, 200);
    assert.equal(out.data.treasury, TREASURY);
    assert.equal(out.data.amountUi, 100);
    assert.equal(out.data.signer, false);
    assert.equal(out.data.dest, undefined);
    assert.ok(!out.text.includes(POTTER));
  });
});

describe('donate / fill', () => {
  it('junk sig is sig miss and does not RPC', async () => {
    installRpc();
    assert.equal(donateSigError(''), 'sig miss');
    assert.equal(donateSigError('nope'), 'sig miss');
    assert.equal(donateSigError('!!!'), 'sig miss');
    assert.deepEqual(donateFailClosed({ signature: 'junk' }), { error: 'sig miss' });
    const { faucet } = makeFaucet();
    const out = await callFaucet(faucet, '/faucet/donate', { method: 'POST', body: { signature: 'junk' } });
    assert.equal(out.status, 200);
    assert.deepEqual(out.data, { error: 'sig miss' });
    assert.ok(!rpcCalls.some((c) => c.method === 'getTransaction'));
    assert.ok(!sentOnChain());
  });

  it('good-shape parser accepts a synthetic donate without chain spend', () => {
    assert.equal(donateSigError(GOOD_SIG), '');
    const miss = inspectDonateTx(null);
    assert.equal(miss.error, 'sig miss');
    const bad = inspectDonateTx({ meta: { err: 'x' } });
    assert.equal(bad.error, 'sig miss');
    const ok = inspectDonateTx(donateTx(), { treasury: TREASURY, mint: MINT, minRaw: 1n });
    assert.equal(ok.ok, true);
    assert.equal(ok.amountRaw, 1_000_000_000n);
    assert.equal(ok.payer, 'So11111111111111111111111111111111111111112');
  });

  it('good-shape donate route lands from mocked tx and never sends', async () => {
    installRpc({ tx: donateTx() });
    const { faucet } = makeFaucet();
    const out = await callFaucet(faucet, '/faucet/donate', { method: 'POST', body: { signature: GOOD_SIG } });
    assert.equal(out.status, 200);
    assert.equal(out.data.ok, true);
    assert.equal(out.data.landed, true);
    assert.equal(out.data.awarded, false);
    assert.equal(out.data.treasury, TREASURY);
    assert.ok(!sentOnChain());
  });

  it('verified donate appears on tape; empty / dup / junk stay honest', async () => {
    installRpc({ tx: donateTx() });
    const { faucet } = makeFaucet();
    const empty = await callFaucet(faucet, '/faucet/tape');
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.data, { ok: true, fills: [] });

    installRpc({ tx: donateTx() });
    const landed = await callFaucet(faucet, '/faucet/donate', { method: 'POST', body: { signature: GOOD_SIG } });
    assert.equal(landed.data.ok, true);
    assert.equal(landed.data.landed, true);
    assert.ok(!sentOnChain());

    const one = await callFaucet(faucet, '/faucet/tape');
    assert.equal(one.status, 200);
    assert.equal(one.data.fills.length, 1);
    assert.equal(one.data.fills[0].sig, GOOD_SIG);
    assert.equal(one.data.fills[0].from, 'So11…1112');

    const dup = await callFaucet(faucet, '/faucet/donate', { method: 'POST', body: { signature: GOOD_SIG } });
    assert.equal(dup.data.ok, true);
    const still = await callFaucet(faucet, '/faucet/tape');
    assert.equal(still.data.fills.length, 1);

    const junk = await callFaucet(faucet, '/faucet/donate', { method: 'POST', body: { signature: 'junk' } });
    assert.deepEqual(junk.data, { error: 'sig miss' });
    const afterJunk = await callFaucet(faucet, '/faucet/tape');
    assert.equal(afterJunk.data.fills.length, 1);
  });

  it('donate has no SIWS gate in source', () => {
    const donateFn = workerSrc.slice(workerSrc.indexOf("path === '/faucet/donate'"), workerSrc.indexOf("path === '/faucet/withdraw'"));
    assert.ok(donateFn.includes('donateSigError'));
    assert.ok(donateFn.includes('inspectDonateTx'));
    assert.ok(!donateFn.includes('siws'));
    assert.ok(!donateFn.includes('faucet_siws'));
    assert.ok(!donateFn.includes('prove wallet'));
  });
});

describe('claim X gate', () => {
  it('no X is a short error and claimAllowed refuses before send', () => {
    const gate = checkXEligibility({});
    assert.equal(gate.ok, false);
    assert.equal(gate.error, 'link X first');
    const allowed = claimAllowed({ byX: {}, byWallet: {} }, { xId: '', wallet: POTTER, proven: true });
    assert.equal(allowed.ok, false);
    assert.equal(allowed.error, 'link X first');
    assert.ok(humanError('link X first').length < 24);
  });

  it('claim route without X returns short error and does not send', async () => {
    installRpc({ sol: 2_000_000_000, tokenRaw: JAR_RAW });
    const { faucet } = makeFaucet({ FAUCET_KEYPAIR: testSecret });
    const out = await callFaucet(faucet, '/faucet/claim', { method: 'POST', body: { dest: POTTER } });
    assert.equal(out.status, 401);
    assert.equal(out.data.error, 'link X first');
    assert.ok(String(out.data.error).length < 24);
    assert.ok(!sentOnChain());
    assert.ok(!rpcCalls.some((c) => c.method === 'sendTransaction' || c.method === 'getLatestBlockhash'));
  });

  it('X age gate fail-closes missing createdAt, blocks new accounts, allows aged', () => {
    const now = Date.parse('2026-08-24T12:00:00Z');
    assert.equal(checkXEligibility({ xId: '1' }, { now }).error, 'x_reauth');
    assert.equal(checkXEligibility({ xId: '1', xCreatedAt: now - 2 * 86400000 }, { minXAgeDays: 7, now }).error, 'x_too_new');
    assert.equal(checkXEligibility({ xId: '1', xCreatedAt: now - 8 * 86400000 }, { minXAgeDays: 7, now }).ok, true);
  });

  it('linked session with xCreatedAt passes the age gate; missing still x_reauth; too new still x_too_new', async () => {
    const createdIso = '2018-01-01T00:00:00.000Z';
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      assert.match(String(url), /created_at/);
      return new Response(JSON.stringify({
        data: { id: '42', username: 'potter', name: 'Potter', created_at: createdIso },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const user = await fetchXUser('test-token');
    globalThis.fetch = prevFetch;
    assert.equal(user.xId, '42');
    assert.equal(user.xCreatedAt, Date.parse(createdIso));

    const { faucet, env } = makeFaucet();
    faucet.faucetBinds['42'] = { dest: POTTER, at: Date.now(), kind: 'PASTED' };
    const now = Date.now();
    const agedAt = now - 8 * 86400000;
    const agedToken = await createSessionToken(env, { xId: '42', handle: 'potter', xCreatedAt: agedAt });
    const agedSession = await sessionFromRequest(env, new Request('https://lobby.getdasha.com/faucet/claim', {
      headers: { Cookie: `${COOKIE}=${agedToken}` },
    }));
    assert.equal(agedSession.xId, '42');
    assert.equal(agedSession.xCreatedAt, agedAt);
    assert.equal(checkXEligibility(agedSession, { minXAgeDays: 7, now }).ok, true);

    installRpc({ sol: 0, tokenRaw: JAR_RAW });
    const aged = await callFaucet(faucet, '/faucet/claim', {
      method: 'POST',
      body: { dest: POTTER },
      headers: { Cookie: `${COOKIE}=${agedToken}` },
    });
    assert.notEqual(aged.data.error, 'x_reauth');
    assert.notEqual(aged.data.error, 'x_too_new');
    assert.ok(['treasury_empty', 'prove wallet', 'not_configured'].includes(aged.data.error));
    assert.ok(!sentOnChain());

    const missingToken = await createSessionToken(env, { xId: '42', handle: 'potter' });
    const missingSession = await sessionFromRequest(env, new Request('https://lobby.getdasha.com/faucet/claim', {
      headers: { Cookie: `${COOKIE}=${missingToken}` },
    }));
    assert.equal(missingSession.xCreatedAt, undefined);
    const missing = await callFaucet(faucet, '/faucet/claim', {
      method: 'POST',
      body: { dest: POTTER },
      headers: { Cookie: `${COOKIE}=${missingToken}` },
    });
    assert.equal(missing.status, 403);
    assert.equal(missing.data.error, 'x_reauth');
    assert.ok(!sentOnChain());

    const tooNewToken = await createSessionToken(env, { xId: '42', handle: 'potter', xCreatedAt: now - 2 * 86400000 });
    const tooNew = await callFaucet(faucet, '/faucet/claim', {
      method: 'POST',
      body: { dest: POTTER },
      headers: { Cookie: `${COOKIE}=${tooNewToken}` },
    });
    assert.equal(tooNew.status, 403);
    assert.equal(tooNew.data.error, 'x_too_new');
    assert.ok(!sentOnChain());
    assert.ok(!rpcCalls.some((c) => c.method === 'sendTransaction'));
  });
});

describe('cooldown and caps', () => {
  it('same-day second claim is already claimed; 24h later is allowed, even on a new dest', () => {
    const now = Date.parse('2026-08-24T12:00:00Z');
    const other = 'So11111111111111111111111111111111111111112';
    const store = recordClaim({ byX: {}, byWallet: {} }, {
      xId: '9',
      wallet: POTTER,
      signature: GOOD_SIG,
      at: now - 1000,
      proven: true,
    });
    const sameDay = claimAllowed(store, { xId: '9', wallet: POTTER, proven: true, now, cooldownMs: FAUCET_COOLDOWN_MS });
    assert.equal(sameDay.ok, false);
    assert.equal(sameDay.error, 'already claimed');
    const sameDayOtherDest = claimAllowed(store, { xId: '9', wallet: other, proven: true, now, cooldownMs: FAUCET_COOLDOWN_MS });
    assert.equal(sameDayOtherDest.ok, false);
    assert.equal(sameDayOtherDest.error, 'already claimed');
    const later = claimAllowed(store, {
      xId: '9',
      wallet: other,
      proven: true,
      now: now + FAUCET_COOLDOWN_MS + 1,
      cooldownMs: FAUCET_COOLDOWN_MS,
    });
    assert.equal(later.ok, true);
  });

  it('daily hard cap still trips; default cooldown is 1 day', () => {
    const now = Date.parse('2026-08-24T12:00:00Z');
    const limitsCfg = faucetConfig({
      LOBBY_SESSION_SECRET: 'x',
      FAUCET_TREASURY: TREASURY,
      MINT,
    });
    assert.equal(limitsCfg.dailyCap, 48);
    assert.equal(limitsCfg.hourlyCap, 12);
    assert.equal(limitsCfg.cooldownDays, 1);
    const dayHit = checkRateLimits({ dayKey: utcDayKey(now), dayCount: 48 }, limitsCfg, { now, rng: () => 0 });
    assert.equal(dayHit.ok, false);
    assert.equal(dayHit.error, 'daily_cap');
  });

  it('burst pressure with stubbed rng trips a short pause; quiet pressure does not', () => {
    const now = Date.parse('2026-08-24T12:00:00Z');
    const limitsCfg = faucetConfig({
      LOBBY_SESSION_SECRET: 'x',
      FAUCET_TREASURY: TREASURY,
      MINT,
    });
    const quiet = burstPressure({ dayKey: utcDayKey(now), dayCount: 1, lastClaimAt: now - 3 * 3600_000, recentAts: [now - 3 * 3600_000] }, limitsCfg, { now });
    assert.ok(quiet.pressure < 0.15, `quiet pressure ${quiet.pressure}`);
    assert.equal(burstPauseChance(quiet.pressure), 0);
    const quietNoted = noteSuccessfulClaim({
      dayKey: utcDayKey(now),
      dayCount: 0,
      lastClaimAt: now - 3 * 3600_000,
      recentAts: [now - 3 * 3600_000],
    }, limitsCfg, { now, rng: () => 0 });
    assert.ok(!quietNoted.autoPausedUntil || quietNoted.autoPausedUntil <= now);

    const recentAts = Array.from({ length: 10 }, (_, i) => now - (9 - i) * 45_000);
    const hot = burstPressure({
      dayKey: utcDayKey(now),
      dayCount: 22,
      lastClaimAt: now - 20_000,
      recentAts,
    }, limitsCfg, { now });
    assert.ok(hot.pressure >= 0.15, `hot pressure ${hot.pressure}`);
    assert.ok(burstPauseChance(hot.pressure) > 0);
    const burstNoted = noteSuccessfulClaim({
      dayKey: utcDayKey(now),
      dayCount: 21,
      lastClaimAt: now - 20_000,
      recentAts,
    }, limitsCfg, { now, rng: () => 0 });
    assert.ok(burstNoted.autoPausedUntil > now);
    assert.ok(burstNoted.autoPausedUntil <= now + FAUCET_PAUSE_MAX_MS);
    assert.ok(burstNoted.autoPausedUntil >= now + FAUCET_PAUSE_MIN_MS);

    const burstCheck = checkRateLimits({
      dayKey: utcDayKey(now),
      dayCount: 22,
      lastClaimAt: now - 20_000,
      recentAts,
    }, limitsCfg, { now, rng: () => 0 });
    assert.equal(burstCheck.ok, false);
    assert.equal(burstCheck.error, 'hourly_cap');
    assert.ok(burstCheck.autoPausedUntil > now);

    const quietCheck = checkRateLimits({
      dayKey: utcDayKey(now),
      dayCount: 1,
      lastClaimAt: now - 3 * 3600_000,
      recentAts: [now - 3 * 3600_000],
    }, limitsCfg, { now, rng: () => 0 });
    assert.equal(quietCheck.ok, true);
  });
});

describe('withdraw admin gate and dest lock', () => {
  it('unauth withdraw is 401 and dest is not in the body', async () => {
    const { faucet } = makeFaucet({ FAUCET_KEYPAIR: testSecret });
    const out = await callFaucet(faucet, '/faucet/withdraw', {
      method: 'POST',
      body: { broadcast: true, dest: TREASURY },
    });
    assert.equal(out.status, 401);
    assert.equal(out.data.error, 'not_configured');
    assert.equal(out.data.dest, undefined);
    assert.ok(!out.text.includes(POTTER));
    assert.ok(!out.text.includes(TREASURY) || out.text === '{"error":"not_configured"}');
    assert.ok(!sentOnChain());
  });

  it('wrong admin secret is still 401 without dest', async () => {
    const { faucet } = makeFaucet({ FAUCET_KEYPAIR: testSecret });
    const out = await callFaucet(faucet, '/faucet/withdraw', {
      method: 'POST',
      headers: { 'x-dasha-admin': 'nope' },
      body: { broadcast: true },
    });
    assert.equal(out.status, 401);
    assert.equal(out.data.dest, undefined);
    assert.ok(!out.text.includes(POTTER));
  });

  it('dry withdraw body is Potter only and does not send', async () => {
    installRpc({ sol: 0, tokenRaw: JAR_RAW });
    const { faucet } = makeFaucet({ FAUCET_KEYPAIR: testSecret });
    const out = await callFaucet(faucet, '/faucet/withdraw', {
      method: 'POST',
      headers: { 'x-dasha-admin': 'admin-secret-for-tests' },
      body: { dest: TREASURY, broadcast: false },
    });
    assert.equal(out.status, 200);
    assert.equal(out.data.dryRun, true);
    assert.equal(out.data.broadcast, false);
    assert.equal(out.data.dest, POTTER);
    assert.notEqual(out.data.dest, TREASURY);
    assert.equal(out.data.error, 'treasury_rent');
    assert.equal(out.data.canSend, false);
    assert.equal(out.data.tokenUi, 69000);
    assert.ok(!sentOnChain());
  });

  it('GET withdraw is dry even with admin', async () => {
    installRpc({ sol: 0, tokenRaw: JAR_RAW });
    const { faucet } = makeFaucet({ FAUCET_KEYPAIR: testSecret });
    const out = await callFaucet(faucet, '/faucet/withdraw', {
      method: 'GET',
      headers: { 'x-dasha-admin': 'admin-secret-for-tests' },
    });
    assert.equal(out.data.dryRun, true);
    assert.equal(out.data.broadcast, false);
    assert.equal(out.data.dest, POTTER);
    assert.ok(!sentOnChain());
  });

  it('dest is hardcoded Potter and any other dest is refused', async () => {
    const wrong = planTreasuryWithdraw({
      solLamports: 2_000_000_000n,
      tokenRaw: JAR_RAW,
      dest: TREASURY,
    });
    assert.equal(wrong.ok, false);
    assert.equal(wrong.error, 'dest_not_potter');
    assert.equal(wrong.dest, POTTER);
    assert.equal(wrong.canSend, false);
    const stolen = await buildWithdrawInstructions({
      payer: TREASURY,
      dest: TREASURY,
      mint: MINT,
      tokenRaw: 1n,
    });
    assert.equal(stolen.ok, false);
    assert.equal(stolen.error, 'dest_not_potter');
    const signed = await buildSignedWithdrawTx({ FAUCET_KEYPAIR: testSecret }, {
      dest: TREASURY,
      skipBalanceChecks: true,
      tokenRaw: JAR_RAW,
      solLamports: 2_000_000_000n,
    });
    assert.equal(signed.ok, false);
    assert.equal(signed.error, 'dest_not_potter');
    assert.equal(signed.dest, POTTER);
    installRpc({ sol: 2_000_000_000, tokenRaw: JAR_RAW });
    const sent = await sendTreasuryWithdraw({ FAUCET_KEYPAIR: testSecret, MINT, FAUCET_TREASURY: TREASURY }, {
      dest: TREASURY,
      broadcast: true,
      dryRun: false,
    });
    assert.equal(sent.ok, false);
    assert.equal(sent.error, 'dest_not_potter');
    assert.ok(!sentOnChain());
  });

  it('0 SOL with $dasha in the jar refuses broadcast as treasury_rent', async () => {
    const plan = planTreasuryWithdraw({ solLamports: 0n, tokenRaw: JAR_RAW, dest: POTTER });
    assert.equal(plan.ok, false);
    assert.equal(plan.error, 'treasury_rent');
    assert.equal(plan.canSend, false);
    assert.equal(plan.tokenUi, 69000);
    installRpc({ sol: 0, tokenRaw: JAR_RAW });
    const sent = await sendTreasuryWithdraw({ FAUCET_KEYPAIR: testSecret, MINT, FAUCET_TREASURY: TREASURY }, {
      dest: POTTER,
      broadcast: true,
      dryRun: false,
    });
    assert.equal(sent.ok, false);
    assert.equal(sent.error, 'treasury_rent');
    assert.ok(!sentOnChain());
    const { faucet } = makeFaucet({ FAUCET_KEYPAIR: testSecret });
    const out = await callFaucet(faucet, '/faucet/withdraw', {
      method: 'POST',
      headers: { 'x-dasha-admin': 'admin-secret-for-tests' },
      body: { broadcast: true },
    });
    assert.equal(out.data.ok, false);
    assert.equal(out.data.error, 'treasury_rent');
    assert.equal(out.data.dest, POTTER);
    assert.ok(!sentOnChain());
  });

  it('admin helper is constant-time-ish and prefers FAUCET_ADMIN', () => {
    assert.equal(faucetAdminOk({}, 'x'), false);
    assert.equal(faucetAdminOk({ FAUCET_ADMIN: 'one', LOBBY_SESSION_SECRET: 'two' }, 'one'), true);
    assert.equal(faucetAdminOk({ FAUCET_ADMIN: 'one', LOBBY_SESSION_SECRET: 'two' }, 'two'), false);
  });

  it('worker and CLI hardcode Potter dest and keep withdraw off the public client', () => {
    assert.match(workerSrc, /dest: FAUCET_WITHDRAW_DEST/);
    assert.match(workerSrc, /if \(!faucetAdminOk\(this\.env, admin\)\)/);
    assert.match(cliSrc, /const DEST = FAUCET_WITHDRAW_DEST/);
    assert.match(cliSrc, /if \(!broadcast\)/);
    assert.doesNotMatch(cliSrc, /process\.argv.*dest|--dest/);
    assert.doesNotMatch(FAUCET_CLIENT_JS, /\/faucet\/withdraw/);
    assert.doesNotMatch(FAUCET_PAGE_HTML, /\/faucet\/withdraw/);
  });
});

describe('signer', () => {
  it('signer secret reads FAUCET_KEYPAIR first and is never a status field', () => {
    assert.equal(faucetSignerSecret({}), '');
    assert.equal(faucetSignerSecret({ FAUCET_KEYPAIR: 'a', FAUCET_TREASURY_SECRET: 'b' }), 'a');
    const status = buildStatus(cfg, { balanceRaw: JAR_RAW, rpcOk: true, solLamports: 0n });
    assert.equal(status.signer, undefined);
    assert.equal(status.FAUCET_KEYPAIR, undefined);
  });
});

describe('copy / treasury UX', () => {
  it('copy always uses the full treasury address', () => {
    assert.equal(jarCopyAddress({}), TREASURY);
    assert.equal(jarCopyAddress({ treasury: 'nope' }), TREASURY);
    assert.equal(jarCopyAddress({ treasury: POTTER }), TREASURY);
    const live = attachJarFields(buildStatus(cfg, { balanceRaw: JAR_RAW, rpcOk: true, solLamports: 0n }), {
      balanceRaw: JAR_RAW,
      solLamports: 0n,
    });
    assert.equal(jarHeadline(live), '69000 $dasha in the jar.');
    assert.equal(jarSolNote(live), 'Jar needs a drop of SOL.');
    assert.equal(donateAmountUi(JAR_RAW), 69000);
    assert.match(FAUCET_CLIENT_JS, /function copyTreasury/);
    assert.match(FAUCET_CLIENT_JS, /var text=TREASURY/);
    assert.match(FAUCET_CLIENT_JS, new RegExp(TREASURY));
    assert.doesNotMatch(FAUCET_CLIENT_JS, new RegExp(POTTER));
    assert.ok(!FAUCET_CLIENT_JS.includes('TREASURY.slice'));
    assert.ok(!FAUCET_CLIENT_JS.includes('treasury.slice'));
  });

  it('Donate card copies the full treasury even when status is down', () => {
    const { root: mounted, copied, leftover, ctx } = bootClient();
    assert.equal(leftover.hidden, true);
    const api = ctx.DashaFaucet || ctx.window.DashaFaucet;
    assert.equal(api.TREASURY, TREASURY);
    const gos = walk(mounted).filter((n) => n.tagName === 'BUTTON' && String(n.className).includes('faucet-go'));
    assert.equal(gos.length, 1, 'door has one primary');
    assert.match(gos[0]._text, /^Get /);
    const donate = walk(mounted).find((n) => n.tagName === 'BUTTON' && n._text === 'Fill the jar');
    assert.ok(donate);
    assert.ok(!String(donate.className).includes('faucet-go'), 'Fill is quiet, not a .faucet-go');
    donate.listeners.click[0]({ preventDefault() {}, stopPropagation() {} });
    const jar = walk(mounted).find((n) => n.id === 'dasha-faucet-jar');
    assert.equal(jar._text, TREASURY);
    assert.equal(jar._text.length, 44);
    const copy = walk(mounted).find((n) => n.tagName === 'BUTTON' && n._text === 'Copy address');
    copy.listeners.click[0]();
    assert.equal(copied.text, TREASURY);
    assert.equal(copied.text, 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb');
  });
});

describe('no plugin.jup.ag', () => {
  it('worker, client, page, and helpers never mention plugin.jup.ag', () => {
    assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
    assert.doesNotMatch(FAUCET_CLIENT_JS, /plugin\.jup\.ag/);
    assert.doesNotMatch(FAUCET_PAGE_HTML, /plugin\.jup\.ag/);
    assert.doesNotMatch(pageSrc, /plugin\.jup\.ag/);
    assert.doesNotMatch(faucetSrc, /plugin\.jup\.ag/);
    assert.doesNotMatch(solanaSrc, /plugin\.jup\.ag/);
    assert.doesNotMatch(cliSrc, /plugin\.jup\.ag/);
  });

  it('page SRI still matches the shipped client', () => {
    const sri = 'sha384-' + createHash('sha384').update(FAUCET_CLIENT_JS).digest('base64');
    assert.equal(FAUCET_CLIENT_SRI, sri);
    assert.match(pageSrc, new RegExp(sri.replace(/[+/]/g, '\\$&')));
    assert.match(FAUCET_PAGE_HTML, new RegExp(sri.replace(/[+/]/g, '\\$&')));
  });

  it('faucet HTML has no static leftover hero; client owns one framed hero', () => {
    assert.doesNotMatch(pageSrc, /dasha-faucet-static/);
    assert.doesNotMatch(pageSrc, /simp\/photo\/faucet\.png/);
    assert.doesNotMatch(FAUCET_PAGE_HTML, /dasha-faucet-static/);
    assert.match(FAUCET_CLIENT_JS, /function hero\(/);
    assert.match(FAUCET_CLIENT_JS, /faucet-hero/);
    assert.match(FAUCET_CLIENT_JS, /faucet-card faucet-door/);
    assert.match(FAUCET_CLIENT_JS, /\},12000\)/);
    assert.match(FAUCET_CLIENT_JS, /faucet-note','try again'/);
  });
});

describe('dest shape for claim dest (not withdraw dest)', () => {
  it('refuses mint, treasury, telegram, and last-4 miss', () => {
    assert.equal(destShapeError(MINT), 'dest_mint');
    assert.equal(destShapeError(TREASURY), 'dest_treasury');
    assert.equal(destShapeError('https://t.me/x'), 'dest_not_wallet');
    assert.equal(destShapeError(POTTER, 'xxxx'), 'last-4 does not match');
    assert.equal(destShapeError(POTTER, POTTER.slice(-4)), '');
  });
});
