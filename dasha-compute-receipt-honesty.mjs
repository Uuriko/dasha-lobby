/**
 * Public Compute receipt / job JSON honesty extras.
 * SWE-2 steal: loop cost > raw tok/s — but only emit turns/steps we already
 * counted. route is community|hosted (same face as x-dasha-route).
 * Never invent USD, turns, or first_edit_at.
 */

const LOOP_MAX = 10_000;
const LATENCY_MAX_MS = 24 * 60 * 60_000;

export function asPositiveInt(raw, max = LOOP_MAX) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return n;
}

/** Fail-closed. Unknown / missing route is omitted — never default to community. */
export function receiptRouteFace(job) {
  const route = String(job?.route || '').trim().toLowerCase();
  const engine = String(job?.engine || '').trim().toLowerCase();
  if (engine === 'hosted' && !['community', 'mixture', 'self'].includes(route)) return 'hosted';
  if (route === 'hosted') return 'hosted';
  if (route === 'community' || route === 'mixture' || route === 'self') return 'community';
  return null;
}

/** Settled-row engine → same community|hosted face. api/unknown omitted. */
export function settledReceiptRoute(engine) {
  const e = String(engine || '').trim().toLowerCase();
  if (e === 'hosted') return 'hosted';
  if (e === 'community' || e === 'mixture') return 'community';
  return null;
}

/** User + assistant messages only. System / empty / missing → omit (never invent). */
export function countConversationTurns(messages) {
  if (!Array.isArray(messages) || !messages.length) return null;
  let n = 0;
  for (const row of messages) {
    const role = String(row?.role || '');
    if (role === 'user' || role === 'assistant') n += 1;
  }
  return asPositiveInt(n);
}

/**
 * Prefer a stored count. Else count remaining messages.
 * `steps` only when already stored on the job — do not derive from Night templates.
 */
export function honestLoopFields(job) {
  const turns = asPositiveInt(job?.turns) ?? countConversationTurns(job?.messages);
  if (turns) return { turns };
  const steps = asPositiveInt(job?.steps);
  if (steps) return { steps };
  return {};
}

/**
 * First-completion latency from timestamps we already store.
 * Prefer leasedAt (Mac picked up) else createdAt. No first_edit_at — we have no edit clock.
 */
export function firstCompletionLatencyMs(job) {
  const completed = Number(job?.completedAt);
  if (!Number.isFinite(completed) || completed <= 0) return null;
  const leased = Number(job?.leasedAt);
  const created = Number(job?.createdAt);
  const start = Number.isFinite(leased) && leased > 0 ? leased : created;
  if (!Number.isFinite(start) || start <= 0) return null;
  const ms = Math.floor(completed - start);
  if (!Number.isFinite(ms) || ms < 0 || ms > LATENCY_MAX_MS) return null;
  return ms;
}

export function attachReceiptHonesty(receipt, job) {
  if (!receipt || typeof receipt !== 'object') return receipt;
  const next = { ...receipt };
  const route = receiptRouteFace(job);
  if (route) next.route = route;
  Object.assign(next, honestLoopFields(job));
  const latency = firstCompletionLatencyMs(job);
  if (latency != null) next.latency_ms = latency;
  return attachResidualControl(next, job);
}

export const BONSAI_MODEL_ID = 'ternary-bonsai-2-27b';
export const BONSAI_RESIDUAL_SITES = 129;

/** Fail-closed. Missing / non-finite / out-of-range is omit — never invent 0. */
export function parseResidualAlpha(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -8 || n > 8) return null;
  return n;
}

function isBonsaiModel(id) {
  return String(id || '').trim().toLowerCase().includes('bonsai');
}

/**
 * Provider-reported residual control on Bonsai only.
 * Worker never defaults α — kit default 0 is stock and must be sent to appear.
 */
export function residualControlFields(input, model) {
  const id = String(model || input?.model || '').trim();
  if (!isBonsaiModel(id)) return {};
  const alpha = parseResidualAlpha(input?.residual_alpha);
  if (alpha == null) return {};
  const fields = { residual_alpha: alpha };
  const sites = Math.floor(Number(input?.residual_site_count));
  if (Number.isFinite(sites) && sites > 0 && sites <= 1024) fields.residual_site_count = sites;
  return fields;
}

export function attachResidualControl(receipt, job) {
  if (!receipt || typeof receipt !== 'object') return receipt;
  const fields = residualControlFields(job, job?.model);
  if (!Object.keys(fields).length) return receipt;
  return { ...receipt, ...fields };
}
