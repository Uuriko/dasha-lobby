/**
 * Community provider work tracking + payout preference (v1).
 * Accrues USDC-face cents on real complete community jobs.
 * Payouts default to pending for operator/treasury settle — no auto-chain-send.
 * Operator settle: markProviderPayoutPaid + secret routes; optional USDC auto-send
 * only when COMPUTE_PAYOUT_KEYPAIR is set (never faucet tip key by default).
 */
import { base58Decode, isValidSolanaAddress } from './dasha-simp-actions.mjs';

export const PROVIDER_JOB_CENTS = 5;
export const PROVIDER_TOKEN_CENTS_PER_1K = 1;
export const PROVIDER_DASHA_BONUS = 1.1;
export const PROVIDER_DASHA_BONUS_FRAC = 0.1;
export const PROVIDER_MIN_PAYOUT_CENTS = 100;
export const PROVIDER_PAYOUT_METHODS = ['usdc', 'dasha'];
/** Worker never auto-sends; operator/treasury settles pending rows. */
export const PROVIDER_PAYOUT_MODE = 'pending';

export function earnCentsForJob(usage) {
  const completion = Math.max(0, Math.floor(Number(usage?.completion_tokens) || 0));
  const tokenCents = Math.floor((completion * PROVIDER_TOKEN_CENTS_PER_1K) / 1000);
  return PROVIDER_JOB_CENTS + tokenCents;
}

export function dashaPayoutCents(usdcCents) {
  const face = Math.max(0, Math.floor(Number(usdcCents) || 0));
  return Math.floor(face * PROVIDER_DASHA_BONUS);
}

export function payoutAmounts(usdcCents, method) {
  const face = Math.max(0, Math.floor(Number(usdcCents) || 0));
  const m = String(method || '').toLowerCase();
  if (m === 'dasha') return { method: 'dasha', usdc_cents: face, payout_cents: dashaPayoutCents(face) };
  return { method: 'usdc', usdc_cents: face, payout_cents: face };
}

export function normalizePayoutPref(input) {
  const method = String(input?.method || '').toLowerCase();
  const wallet = String(input?.wallet || '').trim();
  if (method !== 'usdc' && method !== 'dasha') return { ok: false, error: 'method must be usdc or dasha' };
  if (!isValidSolanaAddress(wallet)) return { ok: false, error: 'invalid wallet' };
  return { ok: true, method, wallet };
}

export function emptyEarnRow() {
  return { usdc_cents: 0, jobs: 0, completion_tokens: 0, updatedAt: 0 };
}

export function normalizeEarnRow(raw) {
  const base = emptyEarnRow();
  if (!raw || typeof raw !== 'object') return base;
  base.usdc_cents = Math.max(0, Math.floor(Number(raw.usdc_cents) || 0));
  base.jobs = Math.max(0, Math.floor(Number(raw.jobs) || 0));
  base.completion_tokens = Math.max(0, Math.floor(Number(raw.completion_tokens) || 0));
  base.updatedAt = Math.max(0, Math.floor(Number(raw.updatedAt) || 0));
  return base;
}

/**
 * Accrue once per jobId (replay key compute:provider-earn-job:{jobId}).
 * Call only on real complete (not failed/cancelled/hosted).
 */
export async function accrueProviderEarn(storage, { providerId, jobId, usage, now = Date.now() } = {}) {
  const pid = String(providerId || '').trim();
  const jid = String(jobId || '').trim();
  if (!pid || !jid) return { ok: false, error: 'providerId and jobId required' };

  const replayKey = `compute:provider-earn-job:${jid}`;
  const prior = await storage.get(replayKey);
  if (prior && typeof prior === 'object') {
    return {
      ok: true,
      replay: true,
      usdc_cents: Math.floor(Number(prior.usdc_cents) || 0),
      jobs: Math.floor(Number(prior.jobs) || 1),
      completion_tokens: Math.floor(Number(prior.completion_tokens) || 0),
      providerId: prior.providerId || pid,
      jobId: prior.jobId || jid,
      at: prior.at || prior.updatedAt || now,
    };
  }

  const completion = Math.max(0, Math.floor(Number(usage?.completion_tokens) || 0));
  const cents = earnCentsForJob(usage);
  const earnKey = `compute:provider-earn:${pid}`;
  const row = normalizeEarnRow(await storage.get(earnKey));
  const next = {
    usdc_cents: row.usdc_cents + cents,
    jobs: row.jobs + 1,
    completion_tokens: row.completion_tokens + completion,
    updatedAt: now,
  };
  const accrued = {
    usdc_cents: cents,
    jobs: 1,
    completion_tokens: completion,
    providerId: pid,
    jobId: jid,
    at: now,
  };
  await storage.put(earnKey, next);
  await storage.put(replayKey, accrued);
  return { ok: true, replay: false, ...accrued, balance: next };
}

export function earningsCatalog({ providers = [], pref = null, pending = [] } = {}) {
  const list = (providers || []).map((p) => {
    const usdc = Math.max(0, Math.floor(Number(p.usdc_cents) || 0));
    return {
      id: p.id,
      name: p.name || null,
      usdc_cents: usdc,
      dasha_cents: dashaPayoutCents(usdc),
      jobs: Math.max(0, Math.floor(Number(p.jobs) || 0)),
      completion_tokens: Math.max(0, Math.floor(Number(p.completion_tokens) || 0)),
      updated_at: p.updatedAt || p.updated_at || null,
    };
  });
  const total_usdc_cents = list.reduce((s, p) => s + p.usdc_cents, 0);
  const total_jobs = list.reduce((s, p) => s + p.jobs, 0);
  return {
    providers: list,
    total_usdc_cents,
    total_dasha_cents: dashaPayoutCents(total_usdc_cents),
    total_jobs,
    pref: pref && (pref.method === 'usdc' || pref.method === 'dasha') && pref.wallet
      ? { method: pref.method, wallet: pref.wallet, updated_at: pref.updatedAt || pref.updated_at || null }
      : null,
    pending: (pending || []).map((row) => {
      const signature = row.signature ? String(row.signature) : null;
      return {
        id: row.id,
        status: row.status || 'pending',
        method: row.method,
        wallet: row.wallet,
        usdc_cents: Math.floor(Number(row.usdc_cents) || 0),
        payout_cents: Math.floor(Number(row.payout_cents) || 0),
        created_at: row.createdAt || row.created_at || null,
        paid_at: row.paidAt || row.paid_at || null,
        signature,
        solscan: signature ? `https://solscan.io/tx/${encodeURIComponent(signature)}` : null,
      };
    }),
    rates: {
      job_cents: PROVIDER_JOB_CENTS,
      token_cents_per_1k: PROVIDER_TOKEN_CENTS_PER_1K,
      dasha_bonus: PROVIDER_DASHA_BONUS_FRAC,
      min_payout_cents: PROVIDER_MIN_PAYOUT_CENTS,
    },
    /** pending = operator/treasury settle; Worker does not auto-chain-send. */
    payout_mode: PROVIDER_PAYOUT_MODE,
  };
}

/**
 * Debit available USDC-face cents across owner's provider earn rows → pending payout.
 * Does not send on-chain.
 */
export async function createPendingPayout(storage, {
  owner,
  method,
  wallet,
  cents = null,
  now = Date.now(),
  idFactory = () => `payout_${Date.now().toString(36)}`,
} = {}) {
  const who = String(owner || '').trim();
  const norm = normalizePayoutPref({ method, wallet });
  if (!who) return { ok: false, status: 401, error: 'login required' };
  if (!norm.ok) return { ok: false, status: 400, error: norm.error };

  const providers = [...(await storage.list({ prefix: 'compute:provider:' })).values()]
    .filter((p) => p && p.owner === who)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const earnRows = [];
  let available = 0;
  for (const p of providers) {
    const row = normalizeEarnRow(await storage.get(`compute:provider-earn:${p.id}`));
    earnRows.push({ provider: p, row, key: `compute:provider-earn:${p.id}` });
    available += row.usdc_cents;
  }

  const want = cents == null ? available : Math.floor(Number(cents));
  if (!Number.isFinite(want) || want < PROVIDER_MIN_PAYOUT_CENTS) {
    return { ok: false, status: 400, error: `min payout ${PROVIDER_MIN_PAYOUT_CENTS} cents` };
  }
  if (want > available) return { ok: false, status: 400, error: 'insufficient balance' };

  let left = want;
  const debits = [];
  for (const item of earnRows) {
    if (left <= 0) break;
    const take = Math.min(item.row.usdc_cents, left);
    if (take <= 0) continue;
    const next = { ...item.row, usdc_cents: item.row.usdc_cents - take, updatedAt: now };
    await storage.put(item.key, next);
    debits.push({ provider_id: item.provider.id, usdc_cents: take });
    left -= take;
  }

  const amounts = payoutAmounts(want, norm.method);
  const id = String(idFactory()).slice(0, 64);
  const payout = {
    id,
    owner: who,
    status: 'pending',
    method: amounts.method,
    wallet: norm.wallet,
    usdc_cents: amounts.usdc_cents,
    payout_cents: amounts.payout_cents,
    debits,
    createdAt: now,
    updatedAt: now,
    note: 'pending — operator/treasury settle; Worker does not auto-chain-send',
  };
  await storage.put(`compute:provider-payout:${id}`, payout);
  await storage.put(`compute:provider-payout-pref:${who}`, {
    method: norm.method,
    wallet: norm.wallet,
    updatedAt: now,
  });
  return { ok: true, status: 201, payout };
}

/** Mainnet USDC — provider settle only; never confuse with CREDIT_DEST top-ups. */
export const PROVIDER_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
/** $dasha mint — auto-send skipped in v1 (needs price oracle). */
export const PROVIDER_DASHA_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

/**
 * USDC raw (6 decimals) from face cents.
 * $1.00 = 100 cents = 1_000_000 raw → raw = cents * 10_000.
 */
export function usdcRawFromCents(cents) {
  const n = Math.max(0, Math.floor(Number(cents) || 0));
  return n * 10_000;
}

/** Solana tx signature shape: base58, 64–128 chars, decodes to 64 bytes. */
export function isValidSolanaTxSignature(sig) {
  const s = String(sig || '').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(s)) return false;
  try {
    return base58Decode(s).length === 64;
  } catch {
    return false;
  }
}

export function computePayoutSecret(env = {}) {
  return String(env?.COMPUTE_PAYOUT_SECRET || '').trim();
}

/** Constant-time-ish compare for operator payout secret. */
export function payoutSecretOk(env = {}, provided = '') {
  const want = computePayoutSecret(env);
  const got = String(provided || '').trim();
  if (!want || !got || want.length !== got.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
}

/** Bearer token or x-dasha-payout-secret header. */
export function extractPayoutSecret(request) {
  const auth = String(request?.headers?.get?.('Authorization') || request?.headers?.get?.('authorization') || '').trim();
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  if (m) return m[1].trim();
  return String(
    request?.headers?.get?.('x-dasha-payout-secret')
    || request?.headers?.get?.('X-Dasha-Payout-Secret')
    || '',
  ).trim();
}

/** Explicit settle keypair only — never fall back to faucet tip key. */
export function computePayoutKeypair(env = {}) {
  return String(env?.COMPUTE_PAYOUT_KEYPAIR || '').trim();
}

export function autoSendUsdcEnabled(env = {}) {
  return Boolean(computePayoutKeypair(env));
}

export function solscanTxUrl(signature) {
  const s = String(signature || '').trim();
  if (!s) return null;
  return `https://solscan.io/tx/${encodeURIComponent(s)}`;
}

export function publicPayoutRow(row) {
  if (!row || typeof row !== 'object') return null;
  const status = String(row.status || 'pending');
  const signature = row.signature ? String(row.signature) : null;
  return {
    id: row.id,
    status,
    method: row.method,
    wallet: row.wallet,
    usdc_cents: Math.floor(Number(row.usdc_cents) || 0),
    payout_cents: Math.floor(Number(row.payout_cents) || 0),
    created_at: row.createdAt || row.created_at || null,
    paid_at: row.paidAt || row.paid_at || null,
    signature,
    solscan: signature ? solscanTxUrl(signature) : null,
    note: row.note || null,
  };
}

/**
 * Pending → paid with on-chain signature. Replay-safe for same signature.
 * Rejects already-paid (different sig) and cancelled.
 */
export async function markProviderPayoutPaid(storage, {
  payoutId,
  signature,
  note = null,
  now = Date.now(),
} = {}) {
  const id = String(payoutId || '').trim();
  const sig = String(signature || '').trim();
  if (!id) return { ok: false, status: 400, error: 'payout_id required' };
  if (!isValidSolanaTxSignature(sig)) return { ok: false, status: 400, error: 'invalid signature' };

  const key = `compute:provider-payout:${id}`;
  const row = await storage.get(key);
  if (!row || typeof row !== 'object') return { ok: false, status: 404, error: 'payout not found' };

  const status = String(row.status || '');
  if (status === 'cancelled' || status === 'canceled') {
    return { ok: false, status: 409, error: 'payout cancelled' };
  }
  if (status === 'paid') {
    const prior = String(row.signature || '').trim();
    if (prior && prior === sig) {
      return { ok: true, replay: true, payout: row };
    }
    return { ok: false, status: 409, error: 'already paid' };
  }
  if (status !== 'pending') {
    return { ok: false, status: 409, error: `cannot settle status ${status || 'unknown'}` };
  }

  const next = {
    ...row,
    status: 'paid',
    signature: sig,
    paidAt: now,
    updatedAt: now,
    note: note != null ? String(note).slice(0, 240) : (row.note || 'paid — operator/treasury settle'),
  };
  await storage.put(key, next);
  return { ok: true, replay: false, payout: next };
}

/** Operator list: all pending payouts (id, owner, method, wallet, cents). */
export async function listPendingProviderPayouts(storage) {
  const rows = [...(await storage.list({ prefix: 'compute:provider-payout:' })).values()]
    .filter((row) => row && row.status === 'pending')
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  return rows.map((row) => ({
    id: row.id,
    owner: row.owner,
    method: row.method,
    wallet: row.wallet,
    usdc_cents: Math.floor(Number(row.usdc_cents) || 0),
    payout_cents: Math.floor(Number(row.payout_cents) || 0),
    created_at: row.createdAt || null,
  }));
}
