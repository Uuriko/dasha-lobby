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
  return next;
}
