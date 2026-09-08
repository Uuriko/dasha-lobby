/**
 * Compute heads ladder (992/993): signed chained receipts + append-only signed
 * heads log + ANCHORED verdict. Field names follow the DEPLOYED settled module
 * (engine / at / job_id), not the mirror-appendix prototype (model / ts).
 * Canonical signed body: {job_id, engine, tokens, cents, at, prev_hash} in that
 * key order, hashed as sha256(JSON.stringify(body)); sig = ed25519 over the
 * UTF-8 bytes of the hex hash (same semantics as appendix heads.mjs v0.1).
 * Key: env.DASHA_HEADS_ED25519_SK = base64 32-byte ed25519 seed. Without it the
 * ladder degrades honestly: receipts stay unsigned, /heads + /keys.json 503.
 */
import * as ed from '@noble/ed25519';

export const HEADS_SCHEMA = 'dasha.heads.v0';
export const KEYS_SCHEMA = 'dasha.keys.v0';
export const HEAD_MAX_AGE_MS = 3600000;
const HEAD_DAY_LIMIT = 500;
const CHAIN_LIST_LIMIT = 500;

const te = new TextEncoder();

export async function sha256Hex(text) {
  const dig = await crypto.subtle.digest('SHA-256', te.encode(String(text)));
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64encode(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64decode(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(String(b64), 'base64'));
  const s = atob(String(b64));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function spkiPemFromRaw(rawPub) {
  // ed25519 SPKI DER prefix (12 bytes) + 32-byte raw key.
  const prefix = new Uint8Array([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
  const der = new Uint8Array(prefix.length + rawPub.length);
  der.set(prefix, 0);
  der.set(rawPub, prefix.length);
  const b64 = b64encode(der);
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----\n`;
}
function rawFromSpkiPem(pem) {
  const b64 = String(pem || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = b64decode(b64);
  return der.slice(der.length - 32);
}

const keyCache = new Map();
/** null when unconfigured. {seed, pubRaw, pubPem, signer} */
export async function headsSigningKey(env) {
  const sk = String(env?.DASHA_HEADS_ED25519_SK || '').trim();
  if (!sk) return null;
  if (keyCache.has(sk)) return keyCache.get(sk);
  const seed = b64decode(sk);
  if (seed.length !== 32) throw new Error('DASHA_HEADS_ED25519_SK must be a base64 32-byte seed');
  const pubRaw = new Uint8Array(await ed.getPublicKeyAsync(seed));
  const pubPem = spkiPemFromRaw(pubRaw);
  const signer = (await sha256Hex(pubPem)).slice(0, 16);
  const key = { seed, pubRaw, pubRawB64: b64encode(pubRaw), pubPem, signer };
  keyCache.set(sk, key);
  return key;
}

/** Canonical signed receipt body, key order load-bearing. */
export function canonicalReceiptBody({ job_id, engine, tokens, cents, at, prev_hash }) {
  return {
    job_id: job_id == null ? null : String(job_id),
    engine: String(engine || ''),
    tokens: Math.max(0, Math.floor(Number(tokens) || 0)),
    cents: Math.max(0, Math.floor(Number(cents) || 0)),
    at: Math.max(0, Math.floor(Number(at) || 0)) || null,
    prev_hash: String(prev_hash || 'GENESIS'),
  };
}

export async function hashReceiptBody(body) {
  return sha256Hex(JSON.stringify(body));
}

export async function signReceipt(key, fields, prevHash = 'GENESIS') {
  const body = canonicalReceiptBody({ ...fields, prev_hash: prevHash });
  const hash = await hashReceiptBody(body);
  const sig = b64encode(new Uint8Array(await ed.signAsync(te.encode(hash), key.seed)));
  return { ...body, hash, sig, signer: key.signer };
}

export async function makeHead(key, tip, prevHeadHash = 'GENESIS', ts = Date.now()) {
  const body = { ts: Math.floor(Number(ts)), tip: String(tip), prev_head_hash: String(prevHeadHash || 'GENESIS') };
  const hash = await sha256Hex(JSON.stringify(body));
  const sig = b64encode(new Uint8Array(await ed.signAsync(te.encode(hash), key.seed)));
  return { ...body, hash, sig, signer: key.signer };
}

async function verifySig(hexHash, sigB64, pem) {
  try {
    return await ed.verifyAsync(b64decode(sigB64), te.encode(hexHash), rawFromSpkiPem(pem));
  } catch {
    return false;
  }
}

export async function verifyReceipt(receipt, pemById) {
  const pem = pemById[receipt?.signer];
  if (!pem) return { ok: false, why: `unknown signer ${receipt?.signer || 'none'}` };
  const body = canonicalReceiptBody(receipt);
  const hash = await hashReceiptBody(body);
  if (hash !== receipt.hash) return { ok: false, why: `hash mismatch at ${receipt.job_id}` };
  if (!(await verifySig(receipt.hash, receipt.sig, pem))) return { ok: false, why: `bad sig at ${receipt.job_id}` };
  return { ok: true, hash };
}

export async function verifyChain(receipts, pemById) {
  let prev = 'GENESIS';
  for (const r of receipts) {
    if (String(r?.prev_hash || '') !== prev) return { ok: false, why: `chain break at ${r?.job_id}` };
    const v = await verifyReceipt(r, pemById);
    if (!v.ok) return v;
    prev = r.hash;
  }
  return { ok: true, tip: prev };
}

export async function verifyHeadsLog(heads, pemById) {
  let prev = 'GENESIS';
  for (const h of heads) {
    if (String(h?.prev_head_hash || '') !== prev) return { ok: false, why: `heads chain break at ts ${h?.ts}` };
    const body = { ts: Math.floor(Number(h?.ts)), tip: String(h?.tip), prev_head_hash: String(h?.prev_head_hash || 'GENESIS') };
    const hash = await sha256Hex(JSON.stringify(body));
    if (hash !== h.hash) return { ok: false, why: `head hash mismatch at ts ${h.ts}` };
    const pem = pemById[h.signer];
    if (!pem) return { ok: false, why: `unknown head signer ${h.signer || 'none'}` };
    if (!(await verifySig(h.hash, h.sig, pem))) return { ok: false, why: `head bad sig at ts ${h.ts}` };
    prev = h.hash;
  }
  return { ok: true, headsTip: prev };
}

export async function anchoredVerdict(receipts, heads, pemById, maxAgeMs = HEAD_MAX_AGE_MS, now = Date.now()) {
  const chain = await verifyChain(receipts, pemById);
  if (!chain.ok) return { tier: 'INVALID', why: chain.why };
  const log = await verifyHeadsLog(heads, pemById);
  if (!log.ok) return { tier: 'SELF-CONSISTENT', why: `heads log broken: ${log.why}` };
  const covering = heads.filter((h) => h.tip === chain.tip);
  if (!covering.length) return { tier: 'SELF-CONSISTENT', why: 'tip not covered by any head' };
  const freshest = Math.max(...covering.map((h) => Number(h.ts) || 0));
  const age = now - freshest;
  if (age > maxAgeMs) return { tier: 'SELF-CONSISTENT', why: `coverage stale: freshest covering head is ${Math.round(age / 60000)}min old` };
  return { tier: 'ANCHORED', why: `chain verifies; tip covered by head ${Math.round(age / 1000)}s old; heads log verifies` };
}

/* ---- DO storage layout ----
 * compute:chain:tip            -> last chained receipt hash ('GENESIS' when empty)
 * compute:chain:seq:<NNNNNN>   -> chained receipt row (publicReceipt shape + chain fields)
 * compute:chain:latest-seq     -> integer counter
 * compute:heads:day:<YYYY-MM-DD> -> array of head records (oldest first, capped)
 */
export async function chainTip(storage) {
  return String((await storage.get('compute:chain:tip')) || 'GENESIS');
}

export async function appendChainedReceipt(storage, key, fields, now = Date.now()) {
  const prevHash = await chainTip(storage);
  const signed = await signReceipt(key, { ...fields, at: fields.at ?? now }, prevHash);
  const seq = Number((await storage.get('compute:chain:latest-seq')) || 0) + 1;
  const row = {
    id: String(fields.id || ''),
    engine: signed.engine,
    tokens: signed.tokens,
    cents: signed.cents,
    at: signed.at,
    job_id: signed.job_id,
    request_id: fields.request_id || null,
    kind: 'paid-inference',
    prev_hash: signed.prev_hash,
    hash: signed.hash,
    sig: signed.sig,
    signer: signed.signer,
  };
  await storage.put(`compute:chain:seq:${String(seq).padStart(6, '0')}`, row);
  await storage.put('compute:chain:latest-seq', seq);
  await storage.put('compute:chain:tip', signed.hash);
  return row;
}

export async function listChain(storage, { limit = CHAIN_LIST_LIMIT } = {}) {
  const seq = Number((await storage.get('compute:chain:latest-seq')) || 0);
  if (!seq) return [];
  const from = Math.max(1, seq - Math.min(limit, CHAIN_LIST_LIMIT) + 1);
  const out = [];
  for (let i = from; i <= seq; i++) {
    const row = await storage.get(`compute:chain:seq:${String(i).padStart(6, '0')}`);
    if (row) out.push(row);
  }
  return out; // oldest first
}

export function headDayKey(ts) {
  return `compute:heads:day:${new Date(Number(ts)).toISOString().slice(0, 10)}`;
}

export async function appendHead(storage, head) {
  const key = headDayKey(head.ts);
  const day = (await storage.get(key)) || [];
  day.push(head);
  while (day.length > HEAD_DAY_LIMIT) day.shift();
  await storage.put(key, day);
  return head;
}

/** Oldest-first heads with ts >= sinceMs (walks back up to 3 day buckets). */
export async function listHeads(storage, { sinceMs = 0, now = Date.now() } = {}) {
  const out = [];
  for (let d = 2; d >= 0; d--) {
    const dayTs = now - d * 86400000;
    const day = (await storage.get(headDayKey(dayTs))) || [];
    for (const h of day) if (Number(h.ts) >= sinceMs) out.push(h);
  }
  out.sort((a, b) => Number(a.ts) - Number(b.ts));
  return out;
}

export async function listHeadsForDay(storage, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return null;
  return (await storage.get(`compute:heads:day:${dateStr}`)) || [];
}
