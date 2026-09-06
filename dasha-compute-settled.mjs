/**
 * Settled paid-inference receipts + rolling 24h token counters (honest zeros).
 * Record only when money/work actually settled: credits charged (hosted) or
 * community/mixture job complete with provider earn (not free floor, not self-route).
 * Never invent Darkbloom-style volume.
 */
import { randomUrlToken } from './dasha-lobby-x.mjs';

export const SETTLED_HOUR_PREFIX = 'compute:settled-hour:';
export const SETTLED_RECEIPT_PREFIX = 'compute:settled-receipt:';
export const SETTLED_REPLAY_PREFIX = 'compute:settled-replay:';
export const SETTLED_24H_MS = 24 * 60 * 60_000;
export const SETTLED_ENGINES = new Set(['hosted', 'community', 'mixture', 'api']);

export function hourBucket(now = Date.now()) {
  return Math.floor(Math.max(0, Number(now) || 0) / 3_600_000);
}

export function emptySettled24h() {
  return { tokens: 0, jobs: 0, cents: 0 };
}

export function normalizeSettledBucket(raw) {
  const base = emptySettled24h();
  if (!raw || typeof raw !== 'object') return base;
  base.tokens = Math.max(0, Math.floor(Number(raw.tokens) || 0));
  base.jobs = Math.max(0, Math.floor(Number(raw.jobs) || 0));
  base.cents = Math.max(0, Math.floor(Number(raw.cents) || 0));
  return base;
}

export function tokensFromUsage(usage) {
  const total = Math.floor(Number(usage?.total_tokens) || 0);
  if (total > 0) return Math.min(10_000_000, Math.max(0, total));
  const prompt = Math.max(0, Math.floor(Number(usage?.prompt_tokens) || 0));
  const completion = Math.max(0, Math.floor(Number(usage?.completion_tokens) || 0));
  return Math.min(10_000_000, prompt + completion);
}

export function publicSettled24h(summary) {
  const s = normalizeSettledBucket(summary);
  return {
    tokens: s.tokens,
    jobs: s.jobs,
    cents: s.cents,
  };
}

export function publicReceipt(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: String(row.id || ''),
    engine: String(row.engine || ''),
    tokens: Math.max(0, Math.floor(Number(row.tokens) || 0)),
    cents: Math.max(0, Math.floor(Number(row.cents) || 0)),
    at: Math.max(0, Math.floor(Number(row.at) || 0)) || null,
    job_id: row.job_id || null,
    request_id: row.request_id || null,
    kind: 'paid-inference',
  };
}

/**
 * Idempotent settle record. replayKey required (job:… / hosted:… / api:…).
 * Returns { ok, replay, receipt }.
 */
export async function recordSettledInference(storage, {
  owner = null,
  engine = 'community',
  usage = null,
  tokens = null,
  cents = 0,
  jobId = null,
  requestId = null,
  replayKey = null,
  now = Date.now(),
  idFactory = () => `rcp_${randomUrlToken(10)}`,
} = {}) {
  const eng = String(engine || '').toLowerCase();
  if (!SETTLED_ENGINES.has(eng)) return { ok: false, error: 'bad engine' };
  const rk = String(replayKey || '').trim().slice(0, 120);
  if (!rk) return { ok: false, error: 'replayKey required' };

  const prior = await storage.get(`${SETTLED_REPLAY_PREFIX}${rk}`);
  if (prior && typeof prior === 'object' && prior.id) {
    return { ok: true, replay: true, receipt: prior };
  }

  const tok = tokens != null
    ? Math.max(0, Math.min(10_000_000, Math.floor(Number(tokens) || 0)))
    : tokensFromUsage(usage);
  const charge = Math.max(0, Math.floor(Number(cents) || 0));
  // Zero-token free noise: still allow cents-only settle, but skip empty free rows.
  if (tok <= 0 && charge <= 0) return { ok: false, error: 'nothing to settle' };

  const id = String(idFactory()).slice(0, 40);
  const who = owner ? String(owner).trim().slice(0, 80) : null;
  const receipt = {
    id,
    owner: who,
    engine: eng,
    tokens: tok,
    cents: charge,
    job_id: jobId ? String(jobId).slice(0, 64) : null,
    request_id: requestId ? String(requestId).slice(0, 80) : null,
    at: now,
    kind: 'paid-inference',
  };

  const hour = hourBucket(now);
  const hourKey = `${SETTLED_HOUR_PREFIX}${hour}`;
  const bucket = normalizeSettledBucket(await storage.get(hourKey));
  bucket.tokens += tok;
  bucket.jobs += 1;
  bucket.cents += charge;
  bucket.updatedAt = now;

  await storage.put(hourKey, bucket);
  await storage.put(`${SETTLED_REPLAY_PREFIX}${rk}`, receipt);
  if (who) {
    await storage.put(`${SETTLED_RECEIPT_PREFIX}${who}:${id}`, receipt);
  }
  return { ok: true, replay: false, receipt };
}

/** Sum hour buckets overlapping the last 24h. Honest zeros when empty. */
export async function sumSettled24h(storage, now = Date.now()) {
  const end = hourBucket(now);
  const start = hourBucket(now - SETTLED_24H_MS + 1);
  const out = emptySettled24h();
  for (let h = start; h <= end; h++) {
    const bucket = normalizeSettledBucket(await storage.get(`${SETTLED_HOUR_PREFIX}${h}`));
    out.tokens += bucket.tokens;
    out.jobs += bucket.jobs;
    out.cents += bucket.cents;
  }
  return out;
}

export async function listReceiptsForOwner(storage, owner, { limit = 20 } = {}) {
  const who = String(owner || '').trim();
  if (!who) return [];
  const prefix = `${SETTLED_RECEIPT_PREFIX}${who}:`;
  const rows = [...(await storage.list({ prefix })).values()]
    .filter((row) => row && typeof row === 'object')
    .sort((a, b) => Number(b.at || 0) - Number(a.at || 0))
    .slice(0, Math.max(1, Math.min(50, Math.floor(Number(limit) || 20))))
    .map(publicReceipt)
    .filter(Boolean);
  return rows;
}
