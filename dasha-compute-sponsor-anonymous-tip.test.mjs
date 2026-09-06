#!/usr/bin/env node
/**
 * Live Worker 0a6f497f: anonymous wallet-only sponsor tip.
 * Guest POST /compute/api/sponsors/orders → anonymous:true, name:null.
 * GET/confirm by order id without cookie.
 * UI always shows USDC/$dasha; optional Sign in for name.
 * Name-a-Mac POST /compute/api/sponsors still 401.
 * No treasury auto-send.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ComputeNetwork, COMPUTE_SPONSOR_TREASURY, COMPUTE_SPONSOR_MACHINES } from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { USE_SKILL_MD } from './dasha-compute-skills.mjs';
import { USDC_MINT, verifyCreditTx } from './dasha-compute-credits.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /const anonymous = !actor/);
assert.match(src, /anon:\$\{randomUrlToken\(12\)\}/);
assert.match(src, /anonymous: !!order\.anonymous/);
assert.match(src, /else if \(pledge\.name\)/);
assert.match(src, /error: 'login required'/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);

const html = readFileSync(new URL('./dasha-compute.html', import.meta.url), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs');
assert.match(html, /wallet OK without login/);
assert.match(html, /Sign in for name/);
assert.match(html, /if\(usdc\)usdc\.hidden=false/);
assert.match(html, /if\(dasha\)dasha\.hidden=false/);
assert.match(html, /id=["']sponsor-usdc["']/);
assert.match(html, /id=["']sponsor-dasha["']/);
assert.match(html, /if\(step==='sponsor-send'\)\{\s*paintSponsorSend\(\);/);
assert.doesNotMatch(html, /if\(step==='sponsor-send'\)[\s\S]{0,80}!loggedIn/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);

const useDisk = readFileSync(new URL('./dasha-compute-skills/USE.md', import.meta.url), 'utf8');
assert.equal(USE_SKILL_MD, useDisk);
assert.match(USE_SKILL_MD, /Sponsor \(tip USDC \/ \$dasha; wallet OK without login\)/);
{
  const m = html.match(/const USE_SKILL="((?:\\.|[^"\\])*)"/);
  assert.ok(m, 'USE_SKILL string present');
  const embed = JSON.parse('"' + m[1] + '"');
  assert.equal(embed, useDisk, 'Copy AI skill body matches USE.md');
}

const payments = readFileSync(new URL('./COMPUTE-PAYMENTS-LAYERS-2026-09-04.md', import.meta.url), 'utf8');
assert.match(payments, /anonymous:true/);
assert.match(payments, /name:null/);
assert.match(payments, /Name-a-Mac still needs login/);
assert.match(payments, /Never invent auto treasury send/);
assert.doesNotMatch(payments, /plugin\.jup\.ag/);

assert.ok(COMPUTE_SPONSOR_MACHINES.some((m) => m.id === 'mini-m4'));

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'sponsor-anon-tip-secret',
  DASHA_PRICE_USD: '0.0001',
  SOLANA_RPC_URL: 'https://rpc.test.local',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};

const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const guestHeaders = { Origin: origin, 'Content-Type': 'application/json' };

const guestPost = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders', {
  method: 'POST', headers: guestHeaders, body: JSON.stringify({ pack: '5', method: 'usdc' }),
}), origin);
assert.equal(guestPost.status, 201, await guestPost.clone().text());
const guest = await guestPost.json();
assert.equal(guest.anonymous, true);
assert.equal(guest.name, null);
assert.equal(guest.status, 'pending');
assert.equal(guest.kind, 'sponsor');
assert.equal(guest.face_cents, 500);
assert.equal(guest.charge_cents, 500);
assert.equal(guest.dest, COMPUTE_SPONSOR_TREASURY);
assert.equal(guest.mint, USDC_MINT);
assert.match(guest.pay_url, new RegExp(`^solana:${COMPUTE_SPONSOR_TREASURY}`));

const guestGet = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/sponsors/orders/${guest.id}`, {
  headers: { Origin: origin },
}), origin);
assert.equal(guestGet.status, 200);
const guestGot = await guestGet.json();
assert.equal(guestGot.anonymous, true);
assert.equal(guestGot.name, null);
assert.equal(guestGot.status, 'pending');
assert.equal(guestGot.id, guest.id);

const nameMac = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors', {
  method: 'POST', headers: guestHeaders, body: JSON.stringify({ machine: 'mbp-16', name: 'guest' }),
}), origin);
assert.equal(nameMac.status, 401);
assert.deepEqual(await nameMac.json(), { error: 'login required' });

const session = await createSessionToken(env, { xId: 'sponsor-anon', handle: 'named_tipper' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
const namedPost = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders', {
  method: 'POST', headers: cookie, body: JSON.stringify({ pack: '5', method: 'usdc', machine: 'network' }),
}), origin);
assert.equal(namedPost.status, 201);
const named = await namedPost.json();
assert.equal(named.anonymous, false);
assert.equal(named.name, 'named_tipper');

const namedGetNoCookie = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/sponsors/orders/${named.id}`, {
  headers: { Origin: origin },
}), origin);
assert.equal(namedGetNoCookie.status, 200);
const namedGot = await namedGetNoCookie.json();
assert.equal(namedGot.anonymous, false);
assert.equal(namedGot.name, 'named_tipper');

const guestMacPost = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders', {
  method: 'POST', headers: guestHeaders, body: JSON.stringify({ pack: '5', method: 'usdc', machine: 'mini-m4' }),
}), origin);
assert.equal(guestMacPost.status, 201);
const guestMac = await guestMacPost.json();
assert.equal(guestMac.anonymous, true);
assert.equal(guestMac.name, null);
assert.equal(guestMac.machine, 'mini-m4');

const pendingConfirm = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/sponsors/orders/${guestMac.id}/confirm`, {
  method: 'POST', headers: guestHeaders, body: '{}',
}), origin);
assert.equal(pendingConfirm.status, 200);
assert.equal((await pendingConfirm.json()).status, 'pending');

const sig = '7'.repeat(64);
const fakeTx = {
  meta: {
    err: null,
    preTokenBalances: [],
    postTokenBalances: [{ owner: COMPUTE_SPONSOR_TREASURY, mint: USDC_MINT, uiTokenAmount: { amount: String(guestMac.amountRaw) } }],
  },
  transaction: { message: { accountKeys: ['payer111111111111111111111111111111111111111', COMPUTE_SPONSOR_TREASURY, guestMac.reference] }, signatures: [sig] },
};
assert.equal(verifyCreditTx(fakeTx, { dest: COMPUTE_SPONSOR_TREASURY, mint: USDC_MINT, amountRaw: guestMac.amountRaw, reference: guestMac.reference }).ok, true);

const origFetch = globalThis.fetch;
const txBySig = new Map([[sig, fakeTx]]);
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('rpc.test.local') || (init?.body && /getTransaction|getSignaturesForAddress/.test(String(init.body)))) {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (body.method === 'getTransaction') {
      const hit = txBySig.get(body.params?.[0]) || null;
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: hit }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (body.method === 'getSignaturesForAddress') {
      const ref = body.params?.[0];
      const hits = [...txBySig.entries()].filter(([, tx]) => (tx?.transaction?.message?.accountKeys || []).includes(ref));
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: hits.map(([signature]) => ({ signature, err: null })) }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return origFetch(url, init);
};

try {
  const funded = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/sponsors/orders/${guestMac.id}/confirm`, {
    method: 'POST', headers: guestHeaders, body: JSON.stringify({ signature: sig }),
  }), origin);
  assert.equal(funded.status, 200, await funded.clone().text());
  const fundedBody = await funded.json();
  assert.equal(fundedBody.status, 'funded');
  assert.equal(fundedBody.name, null);
  assert.equal(fundedBody.face_cents, 500);
  assert.ok(fundedBody.board);
  assert.equal(fundedBody.board.raised_cents, 500);
  const mac = fundedBody.board.machines.find((m) => m.id === 'mini-m4');
  assert.ok(mac);
  assert.equal(mac.sponsor, null, 'anonymous tip must not name a Mac');
  assert.equal(await storage.get('compute:sponsor:mini-m4'), undefined, 'anonymous tip must not create a named Mac row');
  assert.ok(!fundedBody.board.credit.some((c) => c.machine === 'Mac mini M4' && c.name));
} finally {
  globalThis.fetch = origFetch;
}

console.log('dasha-compute-sponsor-anonymous-tip: PASS');
