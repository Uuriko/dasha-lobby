/**
 * Receipt-economics private ledger (growth/traction/economy FINAL spec, Sep 23 2026).
 *
 * Append-only event rows in DO storage under compute:ledger:e: (time-ordered keys).
 * The PUBLIC receipt chain is untouched: every field here lives only in this private
 * ledger. No prompts, outputs, emails, or handles - buyer_id is a sha256 pseudonym.
 *
 * Rows:
 *   job_event           one per state change: created / settled / failed / refunded
 *   payout_event        one per provider payout request (face + dasha bonus split)
 *   buyer_event         first row per buyer (cohort joins via buyer_id only)
 *   provider_event      lifecycle: registered / first heartbeat
 *   provider_online_hour  one row per provider per UTC hour (put-if-absent;
 *                           online=1 only - offline is recorded by ABSENCE of a row)
 *
 * buyer_event.first_job_at_ms stays null: activation is derived from the buyer's
 * first settled job_event instead. The weekly chain tie-out is scoped to
 * route in (community, mixture) - the chain holds zero hosted receipts, so
 * hosted rows never belong in that sum. Hosted rows carry
 * provider_payout_usd_micros = 0 (nobody is owed a payout on hosted jobs) and
 * hosted_inference_cost_usd_micros NULL until a real per-job Workers AI cost
 * exists (economy ruling, Sep 23 2026).
 * credit_used_usd_micros is null until promo/free-credit draw is measurable.
 *
 * Money is integer micro-dollars with the currency in the field name (usd_micros).
 * Timestamps are UTC epoch ms. History is never rewritten: refunds and corrections
 * are NEW rows pointing at the original receipt_id.
 */
import { randomUrlToken } from './dasha-lobby-x.mjs';

export const LEDGER_EVENT_PREFIX = 'compute:ledger:e:';
export const LEDGER_POH_PREFIX = 'compute:ledger:poh:';
export const LEDGER_KEY_BUYER_PREFIX = 'compute:ledger:keybuyer:';
export const LEDGER_OWNER_BUYER_PREFIX = 'compute:ledger:ownerbuyer:';
export const LEDGER_EXPORT_LIMIT_DEFAULT = 500;
export const LEDGER_EXPORT_LIMIT_MAX = 1000;

export const JOB_PATHS = ['api', 'ui_ask', 'ui_hosted', 'self_routed'];
export const LEDGER_KEY_TYPES = ['dgk_', 'dsk_', 'none'];
export const LEDGER_FAILURE_REASONS = ['provider_offline', 'timeout', 'model_error', 'client_abort'];

export function usdMicrosFromCents(cents) {
  if (cents == null || !Number.isFinite(Number(cents))) return null; // null means unknown - never invent a zero
  return Math.max(0, Math.floor(Number(cents))) * 10_000;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const fin = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : null);

export function utcHour(now) {
  return new Date(Math.max(0, Number(now) || 0)).toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

export function mapLedgerFailureReason(reason) {
  const r = String(reason || '').toLowerCase();
  if (r.includes('cut') || r.includes('offline') || r.includes('unreachable')) return 'provider_offline';
  if (r.includes('expired') || r.includes('timeout') || r.includes('stall')) return 'timeout';
  if (r.includes('cancel') || r.includes('abort')) return 'client_abort';
  return 'model_error';
}

/** Append one immutable event row. Keys sort chronologically within the prefix. */
export async function appendLedgerEvent(storage, kind, row, now = Date.now()) {
  const ms = String(Math.max(0, Math.floor(Number(now) || 0))).padStart(15, '0');
  const key = `${LEDGER_EVENT_PREFIX}${ms}:${String(kind).slice(0, 24)}:${randomUrlToken(6)}`;
  await storage.put(key, { kind, ...row });
  return key;
}

export function buildLedgerCreatedRow({ jobId, requestId, path, keyType, modelId, buyerId, sessionId, createdAtMs } = {}) {
  return {
    job_id: jobId || null,
    request_id: requestId || null,
    status: 'created',
    path: JOB_PATHS.includes(path) ? path : null,
    key_type: LEDGER_KEY_TYPES.includes(keyType) ? keyType : 'none',
    model_id: modelId || null,
    buyer_id: buyerId || null,
    session_id: sessionId || null,
    created_at_ms: fin(createdAtMs),
  };
}

export function buildLedgerSettledRow({ receiptId, jobId, providerId, usage, durationMs, settledAtMs, buyerChargeCents, creditUsedCents, providerPayoutCents, hostedInferenceCostCents, pricingVersion, engine } = {}) {
  return {
    receipt_id: receiptId || null,
    engine: engine || null,
    job_id: jobId || null,
    provider_id: providerId || null,
    status: 'settled',
    prompt_tokens: fin(usage?.prompt_tokens),
    completion_tokens: fin(usage?.completion_tokens),
    duration_ms: fin(durationMs),
    settled_at_ms: fin(settledAtMs),
    buyer_charge_usd_micros: usdMicrosFromCents(buyerChargeCents),
    credit_used_usd_micros: usdMicrosFromCents(creditUsedCents),
    provider_payout_usd_micros: usdMicrosFromCents(providerPayoutCents),
    hosted_inference_cost_usd_micros: hostedInferenceCostCents == null ? null : usdMicrosFromCents(hostedInferenceCostCents), // param in CENTS; NULL until the Workers AI bill yields a real per-job number - never guessed
    payment_fee_usd_micros: null,
    pricing_version: String(pricingVersion || 'unversioned'),
  };
}

export function buildLedgerFailedRow({ jobId, failureReason, durationMs, createdAtMs, providerId } = {}) {
  return {
    job_id: jobId || null,
    receipt_id: null,
    status: 'failed',
    failure_reason: LEDGER_FAILURE_REASONS.includes(failureReason) ? failureReason : mapLedgerFailureReason(failureReason),
    duration_ms: fin(durationMs),
    created_at_ms: fin(createdAtMs),
    provider_id: providerId || null,
  };
}

export function buildLedgerRefundRow({ receiptId, jobId, refundCents } = {}) {
  return {
    receipt_id: receiptId || null,
    job_id: jobId || null,
    status: 'refunded',
    refund_usd_micros: usdMicrosFromCents(refundCents),
  };
}

export function buildLedgerPayoutRow({ payoutId, providerId, requestedAtMs, method, faceCents, payoutCents } = {}) {
  const face = faceCents == null || !Number.isFinite(Number(faceCents)) ? null : Math.max(0, Math.floor(Number(faceCents)));
  const payout = payoutCents == null || !Number.isFinite(Number(payoutCents)) ? null : Math.max(0, Math.floor(Number(payoutCents)));
  const option = String(method || '').trim() === 'dasha' ? 'dasha' : 'usdc';
  return {
    payout_id: payoutId || null,
    provider_id: providerId || null,
    requested_at_ms: Math.max(0, Math.floor(Number(requestedAtMs) || 0)),
    paid_at_ms: null,
    payout_face_usd_micros: face == null ? null : face * 10_000,
    payout_option: option,
    dasha_bonus_usd_micros: option === 'dasha' ? (face == null || payout == null ? null : (payout - face) * 10_000) : 0,
    dasha_quantity: null,
    dasha_quote: null,
  };
}

/** Pseudonymous buyer ids. Key-minted ids carry over to a later account. */
export async function buyerIdFromKeyId(keyId) {
  return `buy_${(await sha256Hex(`buyer:key:${keyId}`)).slice(0, 16)}`;
}
export async function buyerIdFromOwner(owner) {
  return `buy_${(await sha256Hex(`buyer:owner:${owner}`)).slice(0, 16)}`;
}
export function anonBuyerId(sessionId) {
  return `anon:${String(sessionId || '').slice(0, 64)}`;
}

export async function resolveBuyerId(storage, { owner = null, keyId = null } = {}) {
  if (keyId) {
    const keyed = await storage.get(`${LEDGER_KEY_BUYER_PREFIX}${keyId}`);
    if (keyed) return keyed;
  }
  if (owner) {
    const existing = await storage.get(`${LEDGER_OWNER_BUYER_PREFIX}${owner}`);
    if (existing?.buyer_id) return existing.buyer_id;
  }
  return null;
}

/** Mint (or return existing) buyer_id at key issuance. When the caller is a
 *  logged-in account, the account mapping is written too so later account
 *  sightings reuse the key-minted id. */
export async function mintBuyerForKey(storage, { keyId, owner = null, acquisitionSource = 'organic_direct', now = Date.now() } = {}) {
  if (owner) {
    const existing = await storage.get(`${LEDGER_OWNER_BUYER_PREFIX}${owner}`);
    if (existing?.buyer_id) {
      await storage.put(`${LEDGER_KEY_BUYER_PREFIX}${keyId}`, existing.buyer_id);
      return existing.buyer_id;
    }
  }
  const keyed = await storage.get(`${LEDGER_KEY_BUYER_PREFIX}${keyId}`);
  if (keyed) return keyed;
  const buyerId = await buyerIdFromKeyId(keyId);
  await storage.put(`${LEDGER_KEY_BUYER_PREFIX}${keyId}`, buyerId);
  if (owner) await storage.put(`${LEDGER_OWNER_BUYER_PREFIX}${owner}`, { buyer_id: buyerId, merged_from_key: keyId });
  await appendLedgerEvent(storage, 'buyer_event', {
    buyer_id: buyerId,
    buyer_first_seen_at_ms: Math.max(0, Math.floor(Number(now) || 0)),
    acquisition_source: String(acquisitionSource || 'organic_direct').slice(0, 64),
    first_job_at_ms: null,
  }, now);
  return buyerId;
}

/** Mint (or return existing) buyer_id for an authenticated account sighting.
 *  If the account already holds keys, the FIRST key's buyer_id carries over. */
export async function mintBuyerForOwner(storage, { owner, acquisitionSource = 'organic_direct', now = Date.now() } = {}) {
  const existing = await storage.get(`${LEDGER_OWNER_BUYER_PREFIX}${owner}`);
  if (existing?.buyer_id) return existing.buyer_id;
  const keys = [...(await storage.list({ prefix: 'compute:api-key:' })).values()]
    .filter((k) => k && k.owner === owner)
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  for (const k of keys) {
    const mapped = await storage.get(`${LEDGER_KEY_BUYER_PREFIX}${k.id}`);
    if (mapped) {
      await storage.put(`${LEDGER_OWNER_BUYER_PREFIX}${owner}`, { buyer_id: mapped, merged_from_key: k.id });
      return mapped;
    }
  }
  const buyerId = await buyerIdFromOwner(owner);
  await storage.put(`${LEDGER_OWNER_BUYER_PREFIX}${owner}`, { buyer_id: buyerId });
  await appendLedgerEvent(storage, 'buyer_event', {
    buyer_id: buyerId,
    buyer_first_seen_at_ms: Math.max(0, Math.floor(Number(now) || 0)),
    acquisition_source: String(acquisitionSource || 'organic_direct').slice(0, 64),
    first_job_at_ms: null,
  }, now);
  return buyerId;
}

/** One row per provider per UTC hour; put-if-absent so a hot poll loop costs one get. */
export async function recordProviderOnlineHour(storage, providerId, now = Date.now()) {
  const hour = utcHour(now);
  const key = `${LEDGER_POH_PREFIX}${String(providerId)}:${hour}`;
  if (await storage.get(key)) return { ok: true, replay: true };
  await storage.put(key, { provider_id: String(providerId), hour_utc: hour, online: 1 });
  return { ok: true, replay: false };
}

/** Cursor-paginated export over the append-only event log. */
export async function exportLedgerEvents(storage, { after = '', limit = LEDGER_EXPORT_LIMIT_DEFAULT } = {}) {
  const cap = Math.max(1, Math.min(LEDGER_EXPORT_LIMIT_MAX, Math.floor(Number(limit) || LEDGER_EXPORT_LIMIT_DEFAULT)));
  const opts = { prefix: LEDGER_EVENT_PREFIX, limit: cap + 1 };
  if (after) opts.startAfter = String(after);
  const entries = [...(await storage.list(opts)).entries()];
  const hasMore = entries.length > cap;
  const batch = hasMore ? entries.slice(0, cap) : entries;
  return {
    rows: batch.map(([key, row]) => ({ ledger_key: key, ...row })),
    cursor: batch.length ? batch[batch.length - 1][0] : String(after || ''),
    has_more: hasMore,
  };
}
