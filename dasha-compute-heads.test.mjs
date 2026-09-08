#!/usr/bin/env node
/** Heads ladder (992/993): crypto roundtrip, chain/log verify, verdict ladder, DO routes. */
import assert from 'node:assert/strict';
import * as ed from '@noble/ed25519';
import {
  HEAD_MAX_AGE_MS,
  anchoredVerdict,
  appendChainedReceipt,
  appendHead,
  canonicalReceiptBody,
  chainTip,
  hashReceiptBody,
  headsSigningKey,
  listChain,
  listHeads,
  listHeadsForDay,
  makeHead,
  signReceipt,
  verifyChain,
  verifyHeadsLog,
} from './dasha-compute-heads.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const seed = ed.utils.randomPrivateKey();
const seedB64 = Buffer.from(seed).toString('base64');
const env = { DASHA_HEADS_ED25519_SK: seedB64, ALLOWED_ORIGINS: 'https://www.getdasha.com' };

const key = await headsSigningKey(env);
assert.equal(key.signer.length, 16);
assert.ok(key.pubPem.startsWith('-----BEGIN PUBLIC KEY-----'));
assert.equal(key.pubRawB64.length, 44);
// cached
assert.equal(await headsSigningKey(env), key);
// no key configured -> null
assert.equal(await headsSigningKey({}), null);

// canonical body: key order + coercions
const body = canonicalReceiptBody({ job_id: 'j1', engine: 'hosted', tokens: '100', cents: 5.7, at: 1757, prev_hash: 'GENESIS' });
assert.deepEqual(Object.keys(body), ['job_id', 'engine', 'tokens', 'cents', 'at', 'prev_hash']);
assert.deepEqual(body, { job_id: 'j1', engine: 'hosted', tokens: 100, cents: 5, at: 1757, prev_hash: 'GENESIS' });

// sign + chain of two
const r1 = await signReceipt(key, { job_id: 'j1', engine: 'hosted', tokens: 100, cents: 5, at: 1757 });
assert.equal(r1.prev_hash, 'GENESIS');
const r2 = await signReceipt(key, { job_id: 'j2', engine: 'community', tokens: 200, cents: 10, at: 1758 }, r1.hash);
const pemById = { [key.signer]: key.pubPem };

const good = await verifyChain([r1, r2], pemById);
assert.equal(good.ok, true);
assert.equal(good.tip, r2.hash);
// tamper
const tampered = { ...r2, cents: 999 };
assert.equal((await verifyChain([r1, tampered], pemById)).ok, false);
// break
assert.equal((await verifyChain([r2], pemById)).ok, false);
// unknown signer
assert.equal((await verifyChain([r1], {})).ok, false);

// heads log
const h1 = await makeHead(key, r2.hash, 'GENESIS', 1000);
const h2 = await makeHead(key, r2.hash, h1.hash, 2000);
assert.equal((await verifyHeadsLog([h1, h2], pemById)).ok, true);
assert.equal((await verifyHeadsLog([h2], pemById)).ok, false); // broken prev link
const badHead = { ...h1, tip: 'zzz' };
assert.equal((await verifyHeadsLog([badHead], pemById)).ok, false);

// verdict ladder
const now = Date.now();
const freshHead = await makeHead(key, r2.hash, 'GENESIS', now - 5000);
assert.equal((await anchoredVerdict([r1, r2], [freshHead], pemById)).tier, 'ANCHORED');
const staleHead = await makeHead(key, r2.hash, 'GENESIS', now - HEAD_MAX_AGE_MS - 60000);
const stale = await anchoredVerdict([r1, r2], [staleHead], pemById);
assert.equal(stale.tier, 'SELF-CONSISTENT');
assert.match(stale.why, /stale/);
const noCover = await anchoredVerdict([r1, r2], [await makeHead(key, 'other-tip')], pemById);
assert.equal(noCover.tier, 'SELF-CONSISTENT');
assert.match(noCover.why, /not covered/);
assert.equal((await anchoredVerdict([r1, tampered], [freshHead], pemById)).tier, 'INVALID');

// ---- DO storage + routes ----
const rows = new Map();
const storage = {
  async get(k) { return rows.get(k); },
  async put(k, v) {
    if (typeof k === 'object') for (const [n, i] of Object.entries(k)) rows.set(n, i);
    else rows.set(k, v);
  },
  async delete(k) { rows.delete(k); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);

// settle joins the chain + earns a head
const settle = await network.recordPaidInferenceSettle({ owner: 'w1', engine: 'hosted', tokens: 10, cents: 1, jobId: 'job-1', replayKey: 'job:1' });
assert.equal(settle.ok, true);
assert.notEqual(await chainTip(storage), 'GENESIS');
const chain = await listChain(storage);
assert.equal(chain.length, 1);
assert.equal(chain[0].job_id, 'job-1');
assert.equal(chain[0].kind, 'paid-inference');
assert.ok(chain[0].sig && chain[0].hash && chain[0].signer === key.signer);
const headsNow = await listHeads(storage, {});
assert.equal(headsNow.length, 1);
assert.equal(headsNow[0].tip, chain[0].hash);
// replay does not double-chain
const replay = await network.recordPaidInferenceSettle({ owner: 'w1', engine: 'hosted', tokens: 10, cents: 1, jobId: 'job-1', replayKey: 'job:1' });
assert.equal(replay.replay, true);
assert.equal((await listChain(storage)).length, 1);

// whole stored chain + log verifies
assert.equal((await verifyChain(chain, pemById)).ok, true);
assert.equal((await verifyHeadsLog(headsNow, pemById)).ok, true);
assert.equal((await anchoredVerdict(chain, headsNow, pemById)).tier, 'ANCHORED');

// public chain endpoint: no auth
const chainRes = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/chain'), null);
assert.equal(chainRes.status, 200);
assert.equal(chainRes.headers.get('Access-Control-Allow-Origin'), '*');
const chainBody = await chainRes.json();
assert.equal(chainBody.schema, 'settled.chain.v0');
assert.equal(chainBody.receipts.length, 1);

// /heads endpoint
const headsRes = await network.fetch(new Request('https://lobby.getdasha.com/heads'), null);
assert.equal(headsRes.status, 200);
assert.equal(headsRes.headers.get('Cache-Control'), 'no-cache');
assert.equal(headsRes.headers.get('Access-Control-Allow-Origin'), '*');
const headsBody = await headsRes.json();
assert.ok(Array.isArray(headsBody));
assert.equal(headsBody.length, 1);

// archive
const day = new Date().toISOString().slice(0, 10);
const archRes = await network.fetch(new Request(`https://lobby.getdasha.com/heads/archive/${day}.json`), null);
assert.equal(archRes.status, 200);
assert.equal((await archRes.json()).length, 1);
assert.deepEqual(await listHeadsForDay(storage, day), headsNow);
assert.equal(await listHeadsForDay(storage, 'nope'), null);

// unsigned env: 503s honestly
const networkNoKey = new ComputeNetwork({ storage: { ...storage, rows: undefined, async get(){return undefined}, async put(){}, async delete(){}, async list(){return new Map()} } }, { ALLOWED_ORIGINS: 'https://www.getdasha.com' });
const noKeyRes = await networkNoKey.fetch(new Request('https://lobby.getdasha.com/heads'), null);
assert.equal(noKeyRes.status, 503);

console.log('dasha-compute-heads: all assertions passed');
