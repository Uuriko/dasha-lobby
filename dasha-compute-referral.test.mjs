#!/usr/bin/env node
/** Referral (tasks 16-17): code endpoint, attribution rules, M1/M2/buyer grants, caps. */
import assert from 'node:assert/strict';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';
import { refMonthKey, REF_VELOCITY_PER_DAY } from './dasha-compute-referral.mjs';

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-referral-secret',
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
const referrerSession = await createSessionToken(env, { xId: '88', handle: 'ref_referrer' });
const refereeSession = await createSessionToken(env, { xId: '99', handle: 'ref_referee' });
const refH = { Cookie: `${COOKIE}=${referrerSession}`, Origin: origin };
const feeH = { Cookie: `${COOKIE}=${refereeSession}`, Origin: origin };
const bal = async (who) => Math.max(0, Math.floor(Number(rows.get(`compute:credit-balance:${who}`)?.cents) || 0));
const getJson = async (res) => ({ status: res.status, body: await res.json() });

// --- endpoint: 401 unauth, 200 authed, deterministic code ---
const unauth = await getJson(await network.fetch(new Request('https://lobby.getdasha.com/compute/api/referral/code'), origin));
assert.equal(unauth.status, 401);

const first = await getJson(await network.fetch(new Request('https://lobby.getdasha.com/compute/api/referral/code', { headers: refH }), origin));
assert.equal(first.status, 200);
assert.equal(first.body.schema, 'compute.referral.v0');
assert.match(first.body.code, /^dash-[a-z2-9]{8}$/);
assert.equal(first.body.url, `https://www.getdasha.com/compute?ref=${first.body.code}`);
assert.equal(first.body.referees, 0);
assert.equal(first.body.month_cap_cents, 5000);
const second = await getJson(await network.fetch(new Request('https://lobby.getdasha.com/compute/api/referral/code', { headers: refH }), origin));
assert.equal(second.body.code, first.body.code, 'code is deterministic');
const code = first.body.code;
const code2 = (await getJson(await network.fetch(new Request('https://lobby.getdasha.com/compute/api/referral/code', { headers: feeH }), origin))).body.code;
assert.notEqual(code2, code);

// --- attribution rules (direct method for the rule matrix) ---
assert.equal((await network.referralAttribute('x:88', code)).error, 'unknown or self', 'self-referral blocked');
assert.equal((await network.referralAttribute('x:99', 'dash-zzzzzzzz')).error, 'unknown or self', 'unknown code blocked');
assert.equal((await network.referralAttribute('x:99', 'not-a-code')).error, 'bad code');
const attrib = await network.referralAttribute('x:99', code);
assert.equal(attrib.ok, true);
assert.equal(attrib.referrer, 'x:88');
assert.equal((await network.referralAttribute('x:99', code2)).error, 'already attributed', 'one referral per account');
assert.equal((rows.get('compute:referral-count:x:88') || 0), 1);

// velocity cap: fill the day, next attribution skipped
const vKey = `compute:refvel:${code2}:${new Date().toISOString().slice(0, 10)}`;
rows.set(vKey, REF_VELOCITY_PER_DAY);
assert.equal((await network.referralAttribute('x:100', code2)).error, 'velocity review');

// --- M1: referee provider comes online -> referrer +$2, once ---
const reg = await getJson(await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: { ...feeH, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Ref Mac', models: ['qwen3-8b'] }),
}), origin));
assert.equal(reg.status, 201);
assert.equal(reg.body.referral, undefined, 'already attributed directly above -> no re-attribution on register');
const poll = async () => network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: { Authorization: `Bearer ${reg.body.provider_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider_id: reg.body.provider_id, models: ['qwen3-8b'] }),
}), origin);
assert.ok([200, 204].includes((await poll()).status), "poll ok");
assert.equal(await bal('x:88'), 200, 'M1: referrer +200c on first online');
assert.equal(await bal('x:99'), 0, 'M1 pays referrer only');
assert.ok([200, 204].includes((await poll()).status), "poll ok");
assert.equal(await bal('x:88'), 200, 'M1 idempotent across polls');

// ledger row recorded
const ledgerRows = [...rows.keys()].filter(k => k.startsWith('compute:credit-ledger:x:88:') && rows.get(k).reason === 'referral:m1');
assert.equal(ledgerRows.length, 1);
assert.equal(rows.get(ledgerRows[0]).cents, 200);

// --- M2: 50 served jobs across referee's providers -> referrer +$5, referee +$2 ---
rows.set(`compute:provider-earn:${reg.body.provider_id}`, { usdc_cents: 0, jobs: 49, completion_tokens: 0, updatedAt: Date.now() });
await network.referralCheckM2('x:99');
assert.equal(await bal('x:88'), 200, 'M2 not yet at 49 jobs');
rows.set(`compute:provider-earn:${reg.body.provider_id}`, { usdc_cents: 0, jobs: 50, completion_tokens: 0, updatedAt: Date.now() });
await network.referralCheckM2('x:99');
assert.equal(await bal('x:88'), 700, 'M2: referrer +500c');
assert.equal(await bal('x:99'), 200, 'M2: referee +200c');
await network.referralCheckM2('x:99');
assert.equal(await bal('x:88'), 700, 'M2 idempotent');

// --- buyer: first top-up >= $5 -> both +$5 ---
await network.referralCheckBuyer('x:99', 400);
assert.equal(await bal('x:88'), 700, 'buyer grant needs >= $5');
await network.referralCheckBuyer('x:99', 500);
assert.equal(await bal('x:88'), 1200, 'buyer: referrer +500c');
assert.equal(await bal('x:99'), 700, 'buyer: referee +500c');
await network.referralCheckBuyer('x:99', 1000);
assert.equal(await bal('x:88'), 1200, 'buyer milestone once');

// --- month cap: near-cap recipient skips ---
rows.set(`compute:refgrant:x:88:${refMonthKey()}`, { cents: 4900, updatedAt: Date.now() });
const capped = await network.referralGrant('x:88', 200, 'm1');
assert.equal(capped.ok, false);
assert.equal(capped.error, 'month cap');
assert.equal(await bal('x:88'), 1200, 'cap blocks credit');

// --- wallet uniqueness: same payout wallet as other party -> skip ---
rows.set('compute:provider-payout-pref:x:200', { wallet: '0xabc' });
rows.set('compute:provider-payout-pref:x:201', { wallet: '0xabc' });
const dup = await network.referralGrant('x:200', 200, 'm1', Date.now(), { otherParty: 'x:201' });
assert.equal(dup.ok, false);
assert.equal(dup.error, 'same payout wallet');

console.log('dasha-compute-referral.test.mjs: OK');
