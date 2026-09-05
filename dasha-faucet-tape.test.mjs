#!/usr/bin/env node
/** Verified-fill tape. Mocked donate txs only. Empty tape is honest. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DashaFaucet } from './dasha-lobby-worker.mjs';
import edgeWorker from './dasha-lobby-worker.mjs';
import {
  FAUCET_TAPE_CAP,
  FAUCET_TAPE_SCAN_CAP,
  appendFill,
  collectInboundFills,
  createTape,
  fillAmount,
  fillLine,
  fillRow,
  fillWhen,
  isFaucetTapePath,
  listFills,
  shouldScanTape,
  tapeApi,
  truncateFrom,
} from './dasha-faucet-tape.mjs';
import { FAUCET_CLIENT_JS, FAUCET_PAGE_HTML } from './dasha-lobby-static-gen.mjs';
import { inspectDonateTx, donateAmountUi, donateSigError } from './dasha-faucet.mjs';
import { rpc, solanaRpcList, SOLANA_PUBLIC_RPCS } from './dasha-faucet-solana.mjs';

const TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAYER = 'So11111111111111111111111111111111111111112';
const GOOD_SIG = '1'.repeat(64);
const GOOD_SIG2 = '2'.repeat(64);
const page = readFileSync(new URL('./dasha-faucet-page.html', import.meta.url), 'utf8');
const workerSrc = readFileSync(new URL('./dasha-lobby-worker.mjs', import.meta.url), 'utf8');

assert.equal(isFaucetTapePath('/faucet/tape'), true);
assert.equal(isFaucetTapePath('/faucet/fills'), true);
assert.equal(isFaucetTapePath('/faucet/donate'), false);
assert.equal(isFaucetTapePath('/faucet'), false);
assert.equal(FAUCET_TAPE_CAP, 50);
assert.equal(truncateFrom(PAYER), 'So11…1112');
assert.equal(truncateFrom('AbcdWxyz'), 'AbcdWxyz');
assert.equal(truncateFrom(''), '');
assert.equal(fillAmount(100000), '100000');
assert.equal(fillAmount('100000'), '100000');
assert.equal(fillAmount(0), '');
assert.equal(fillWhen(Date.UTC(2026, 7, 25, 23, 25)), '25 Aug');
assert.equal(fillWhen('nope'), '');
assert.equal(fillLine({
  amountUi: 100000,
  at: Date.UTC(2026, 7, 25, 23, 25),
  from: '35axezZEL1pNvmKxt46TU8oaxH8czAvaBQKgquqS8gQX',
}), '100000 25 Aug from 35ax…8gQX');
assert.equal(fillLine({ amountUi: 100000, at: Date.UTC(2026, 7, 25, 23, 25) }), '100000 25 Aug');
assert.doesNotMatch(fillLine({ amountUi: 100000, at: Date.UTC(2026, 7, 25, 23, 25), from: PAYER }), /So11111111111111111111111111111111111111112/);
assert.equal(donateSigError(GOOD_SIG), '');
assert.equal(fillRow({ sig: 'junk', amountUi: 1000, at: Date.now(), from: PAYER }), null);

const injected = createTape();
assert.deepEqual(injected.list(), []);
const now = Date.now();
const first = injected.append({ sig: GOOD_SIG, amountUi: 1000, at: now - 1000, from: PAYER });
assert.equal(first.ok, true);
assert.equal(first.replay, false);
assert.equal(injected.list().length, 1);
assert.equal(injected.list()[0].from, 'So11…1112');
assert.equal(injected.append({ sig: GOOD_SIG, amountUi: 1000, at: now, from: PAYER }).replay, true);
assert.equal(injected.list().length, 1);
assert.equal(injected.append({ sig: 'junk', amountUi: 1000, at: now, from: PAYER }).ok, false);
assert.equal(injected.list().length, 1);
injected.append({ sig: GOOD_SIG2, amountUi: 50, at: now, from: PAYER });
assert.equal(injected.list()[0].sig, GOOD_SIG2);
assert.equal(injected.list()[1].sig, GOOD_SIG);
assert.equal(listFills(injected.raw, { cap: 1 }).length, 1);

assert.match(page, /\/faucet\/tape/);
assert.match(page, /dasha-jar-tape/);
assert.match(page, /Fills\./);
assert.match(page, /\/faucet\/fill\/'\+row\.sig/);
assert.match(FAUCET_PAGE_HTML, /\/faucet\/fill\/'\+row\.sig/);
assert.doesNotMatch(page, /dasha-home-faucet/, 'disk /faucet drops leftover home-faucet id');
assert.doesNotMatch(FAUCET_PAGE_HTML, /dasha-home-faucet/, 'bundled /faucet drops leftover home-faucet id');
assert.match(page, /location\.pathname/, 'pathname faucet guard stays');
assert.match(page, /function lineText/);
assert.match(page, /from '\+from/);
assert.match(page, /Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'/);
assert.match(page, /rgba\(244,237,219,\.76\)/);
assert.doesNotMatch(page, /slice\(0,4\)/);
assert.doesNotMatch(page, /toISOString\(\)\.slice\(0,16\)/);
assert.doesNotMatch(page, /69000/);
assert.doesNotMatch(page, /3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN/);
assert.doesNotMatch(page, /not an airdrop/);
assert.doesNotMatch(page, /plugin\.jup\.ag/);
assert.match(FAUCET_PAGE_HTML, /\/faucet\/tape/);
assert.match(FAUCET_PAGE_HTML, /dasha-jar-tape/);
assert.match(FAUCET_PAGE_HTML, /function lineText/);
assert.match(FAUCET_PAGE_HTML, /rgba\(244,237,219,\.76\)/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /slice\(0,4\)/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /toISOString\(\)\.slice\(0,16\)/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /not an airdrop/);
assert.doesNotMatch(FAUCET_PAGE_HTML, /69000/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /\/faucet\/tape/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /dasha-jar-tape/);
assert.doesNotMatch(FAUCET_CLIENT_JS, /not an airdrop/);
assert.match(workerSrc, /HOME_FAUCET_MOUNT/);
assert.doesNotMatch(workerSrc.match(/const HOME_FAUCET_MOUNT = `[^`]+`/)[0], /dasha-jar-tape/);
assert.match(workerSrc, /appendFill/);
assert.match(workerSrc, /inspectDonateTx/);

function donateTx({
  treasury = TREASURY,
  mint = MINT,
  payer = PAYER,
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

const realFetch = globalThis.fetch;
function jsonRpc(result) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
function installRpc(tx) {
  globalThis.fetch = async (_url, init = {}) => {
    let body = {};
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body); } catch { body = {}; }
    }
    if (body.method === 'sendTransaction') throw new Error('sendTransaction must not run');
    if (body.method === 'getTransaction') return jsonRpc(tx);
    return jsonRpc(null);
  };
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

function makeFaucet() {
  return new DashaFaucet(mockState(), {
    LOBBY_SESSION_SECRET: 'lobby-session-secret-for-tests',
    FAUCET_TREASURY: TREASURY,
    MINT,
    ALLOW_ANY_ORIGIN: '1',
    ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
  });
}

async function call(faucet, path, { method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { Origin: 'https://www.getdasha.com', ...headers } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await faucet.fetch(new Request(`https://lobby.getdasha.com${path}`, init));
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, text, headers: res.headers };
}

{
  const parsed = inspectDonateTx(donateTx(), { treasury: TREASURY, mint: MINT, minRaw: 1n });
  assert.equal(parsed.ok, true);
  assert.equal(donateAmountUi(parsed.amountRaw), 1000);
  const row = fillRow({
    sig: GOOD_SIG,
    amountUi: donateAmountUi(parsed.amountRaw),
    at: parsed.at,
    from: parsed.payer,
  });
  assert.equal(row.from, 'So11…1112');
  assert.ok(!String(row.from).includes(PAYER));
}

{
  installRpc(null);
  const faucet = makeFaucet();
  const empty = await call(faucet, '/faucet/tape');
  assert.equal(empty.status, 200);
  assert.equal(empty.data.ok, true);
  assert.deepEqual(empty.data.fills, []);
  assert.equal(empty.headers.get('access-control-allow-origin'), '*');
  assert.equal(empty.headers.get('x-dasha-edge'), 'faucet-tape');

  const alias = await call(faucet, '/faucet/fills');
  assert.equal(alias.status, 200);
  assert.deepEqual(alias.data.fills, []);

  const opt = await tapeApi(new Request('https://lobby.getdasha.com/faucet/tape', { method: 'OPTIONS' }), []);
  assert.equal(opt.status, 204);
  assert.equal(opt.headers.get('access-control-allow-origin'), '*');
}

{
  installRpc(donateTx());
  const faucet = makeFaucet();
  const empty = await call(faucet, '/faucet/tape');
  assert.deepEqual(empty.data.fills, []);

  const landed = await call(faucet, '/faucet/donate', { method: 'POST', body: { signature: GOOD_SIG } });
  assert.equal(landed.status, 200);
  assert.equal(landed.data.ok, true);
  assert.equal(landed.data.landed, true);
  assert.equal(landed.data.share, `https://www.getdasha.com/faucet/fill/${GOOD_SIG}`);

  const one = await call(faucet, '/faucet/tape');
  assert.equal(one.status, 200);
  assert.equal(one.data.fills.length, 1);
  assert.equal(one.data.fills[0].sig, GOOD_SIG);
  assert.equal(one.data.fills[0].amountUi, 1000);
  assert.equal(one.data.fills[0].from, 'So11…1112');
  assert.ok(!JSON.stringify(one.data).includes(PAYER));
  assert.equal(one.headers.get('access-control-allow-origin'), '*');

  const dup = await call(faucet, '/faucet/donate', { method: 'POST', body: { signature: GOOD_SIG } });
  assert.equal(dup.data.ok, true);
  const still = await call(faucet, '/faucet/tape');
  assert.equal(still.data.fills.length, 1);

  const junk = await call(faucet, '/faucet/donate', { method: 'POST', body: { signature: 'junk' } });
  assert.deepEqual(junk.data, { error: 'sig miss' });
  const afterJunk = await call(faucet, '/faucet/tape');
  assert.equal(afterJunk.data.fills.length, 1);
}

{
  const faucet = makeFaucet();
  installRpc(donateTx({ blockTime: Math.floor(Date.now() / 1000) - 90 }));
  await call(faucet, '/faucet/donate', { method: 'POST', body: { signature: GOOD_SIG } });
  installRpc(donateTx({ blockTime: Math.floor(Date.now() / 1000) - 20, post: '2500000000' }));
  await call(faucet, '/faucet/donate', { method: 'POST', body: { signature: GOOD_SIG2 } });
  const tape = await call(faucet, '/faucet/tape');
  assert.equal(tape.data.fills.length, 2);
  assert.equal(tape.data.fills[0].sig, GOOD_SIG2);
  assert.equal(tape.data.fills[1].sig, GOOD_SIG);
}

{
  installRpc(null);
  const faucet = makeFaucet();
  const miss = await call(faucet, '/faucet/donate', { method: 'POST', body: { signature: GOOD_SIG } });
  assert.equal(miss.data.error, 'sig miss');
  const tape = await call(faucet, '/faucet/tape');
  assert.deepEqual(tape.data.fills, []);
}

{
  const empty = appendFill([], { sig: GOOD_SIG, amountUi: 1, at: Date.now(), from: PAYER });
  const many = [];
  let list = empty.list;
  for (let i = 0; i < 60; i++) {
    const sig = `${'3'.repeat(63)}${'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxy'[i % 50]}`;
    const out = appendFill(list, { sig, amountUi: i + 1, at: Date.now() + i, from: PAYER });
    if (out.ok) list = out.list;
  }
  assert.ok(listFills(list).length <= 50);
}

assert.equal(FAUCET_TAPE_SCAN_CAP, 12);
assert.equal(shouldScanTape(0, 1000), true);
assert.equal(shouldScanTape(1000, 1000 + 59_000), false);
assert.equal(shouldScanTape(1000, 1000 + 60_000), true);
assert.ok(solanaRpcList({ SOLANA_RPC_URL: 'https://dedicated.example/rpc' })[0] === 'https://dedicated.example/rpc');
assert.ok(solanaRpcList({ SOLANA_RPC_URL: 'https://dedicated.example/rpc' }).some((u) => SOLANA_PUBLIC_RPCS.includes(u)));

{
  const tx = donateTx();
  const found = collectInboundFills([{ sig: GOOD_SIG, tx }], { treasury: TREASURY, mint: MINT, now: Date.now() });
  assert.equal(found.length, 1);
  assert.equal(found[0].sig, GOOD_SIG);
  assert.equal(found[0].amountUi, 1000);
  assert.equal(found[0].from, 'So11…1112');
  const replay = collectInboundFills([{ sig: GOOD_SIG, tx }], { treasury: TREASURY, mint: MINT, existing: found, now: Date.now() });
  assert.deepEqual(replay, []);
  const old = collectInboundFills([{
    sig: GOOD_SIG2,
    tx: donateTx({ blockTime: Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60 }),
  }], { treasury: TREASURY, mint: MINT, now: Date.now() });
  assert.deepEqual(old, []);
  const junk = collectInboundFills([{ sig: 'junk', tx }], { treasury: TREASURY, mint: MINT });
  assert.deepEqual(junk, []);
}

{
  const tx = donateTx();
  const hits = [];
  globalThis.fetch = async (url, init = {}) => {
    hits.push(String(url));
    let body = {};
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body); } catch { body = {}; }
    }
    if (String(url).includes('dedicated.example') && body.method === 'getTransaction') return jsonRpc(null);
    if (body.method === 'getTransaction') return jsonRpc(tx);
    return jsonRpc(null);
  };
  const got = await rpc({ SOLANA_RPC_URL: 'https://dedicated.example/rpc' }, 'getTransaction', [GOOD_SIG, { encoding: 'json' }]);
  assert.ok(got);
  assert.equal(got.blockTime, tx.blockTime);
  assert.ok(hits.some((u) => u.includes('dedicated.example')));
  // Dedicated tx-miss must fall through to the shared public pool — whichever entry is
  // pinned first there today (was leorpc/mainnet, now Solana Vibe Station); assert pool
  // membership, not a hardcoded host, so a future re-pin doesn't stale this out again.
  assert.ok(hits.some((u) => SOLANA_PUBLIC_RPCS.includes(u)), 'must fall through to the shared public pool after a dedicated miss');
}

{
  const tx = donateTx();
  globalThis.fetch = async (_url, init = {}) => {
    let body = {};
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body); } catch { body = {}; }
    }
    if (body.method === 'getSignaturesForAddress') return jsonRpc([{ signature: GOOD_SIG }]);
    if (body.method === 'getTransaction') return jsonRpc(tx);
    return jsonRpc(null);
  };
  const faucet = makeFaucet();
  const scanned = await call(faucet, '/faucet/tape');
  assert.equal(scanned.status, 200);
  assert.equal(scanned.data.fills.length, 1);
  assert.equal(scanned.data.fills[0].sig, GOOD_SIG);
  assert.equal(scanned.data.fills[0].amountUi, 1000);
  const again = await call(faucet, '/faucet/tape');
  assert.equal(again.data.fills.length, 1);
}

const edgeEnv = {};
for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const res = await edgeWorker.fetch(new Request(`${origin}/faucet/tape`), edgeEnv);
  assert.equal(res.status, 200, `${origin}/faucet/tape`);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('x-dasha-edge'), 'faucet-tape');
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.fills, []);

  const opt = await edgeWorker.fetch(new Request(`${origin}/faucet/tape`, { method: 'OPTIONS' }), edgeEnv);
  assert.equal(opt.status, 204, `${origin} OPTIONS`);
  assert.equal(opt.headers.get('access-control-allow-origin'), '*');

  const pageRes = await edgeWorker.fetch(new Request(`${origin}/faucet`), edgeEnv);
  assert.equal(pageRes.status, 200);
  const html = await pageRes.text();
  assert.match(html, /Once a day|dasha-faucet/);
  assert.match(html, /\/faucet\/tape/);
  assert.doesNotMatch(html, /not an airdrop/);
}

globalThis.fetch = realFetch;
console.log('dasha-faucet-tape: PASS (empty / one fill / dup / junk / newest first / CORS *)');
