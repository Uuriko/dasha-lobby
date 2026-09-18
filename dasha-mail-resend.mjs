/**
 * Resend mail rail (mirrored from live bundle 2026-09-07).
 * Internal smoke endpoint only: POST /internal/mail/smoke.
 * Gate: Bearer RESEND_API_KEY or x-dasha-internal == LOBBY_SESSION_SECRET.
 * No facilitator secrets in repo - env var names only.
 *
 * Failure classification + bounded retry queue (resend deliverability
 * code-side overhaul):
 * - classifyResendFailure() buckets every provider failure as `config`
 *   (bad key, unverified sending domain - retries can never fix),
 *   `provider-rejection` (validation, bad recipient - do not retry), or
 *   `transient` (network/5xx/rate-limit - bounded retry with backoff).
 * - sendResendMail() returns { failure: { kind, retryable } } on every
 *   failure so callers can branch without parsing messages.
 * - enqueueMailRetry()/pumpMailRetryQueue() implement the bounded retry
 *   queue: 5 attempts, 30s->8m backoff, 24h TTL, 200-entry cap.
 * - PII rule: log lines and metric names NEVER contain recipient addresses,
 *   subjects, or message bodies. The retry queue entry is the one place a
 *   pending send's payload rests (TTL-bounded); emailLogins still stores
 *   hash-only codes.
 */
var RESEND_API = "https://api.resend.com/emails";
var DEFAULT_FROM = "Dasha <potter@trydemigod.com>";
var SMOKE_TO = "potter@trydemigod.com";
function resendConfigured(env) {
  return Boolean(String(env?.RESEND_API_KEY || "").trim());
}
function resendFrom(env) {
  const v = String(env?.RESEND_FROM || "").trim();
  return v || DEFAULT_FROM;
}
function asList(value) {
  if (Array.isArray(value)) return value.map((s) => String(s || "").trim()).filter(Boolean);
  const one = String(value || "").trim();
  return one ? [one] : [];
}

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------
export const MAIL_FAILURE_CONFIG = "config";
export const MAIL_FAILURE_PROVIDER_REJECTION = "provider-rejection";
export const MAIL_FAILURE_TRANSIENT = "transient";

/**
 * Bucket a Resend/provider failure. `config` = fix by changing config
 * (key, sending domain); `provider-rejection` = Resend refused the message
 * (validation); `transient` = may succeed on retry (network, 5xx, 429).
 * Never inspects or returns PII: only status + the provider's error text.
 */
export function classifyResendFailure({ status, error } = {}) {
  const s = Number(status) || 0;
  const msg = String(error || "").toLowerCase();
  if (s === 401 || msg.includes("invalid_api_key") || msg.includes("missing_api_key")) {
    return { kind: MAIL_FAILURE_CONFIG, retryable: false };
  }
  if ((s === 403 || s === 422) && /(from|domain|sender|dkim|spf)/.test(msg)) {
    return { kind: MAIL_FAILURE_CONFIG, retryable: false };
  }
  if (s === 0 || s === 408 || s === 425 || s === 429 || s >= 500) {
    return { kind: MAIL_FAILURE_TRANSIENT, retryable: true };
  }
  return { kind: MAIL_FAILURE_PROVIDER_REJECTION, retryable: false };
}

/** One-line failure log. Never logs recipient, subject, or body. */
function mailLog(level, fields) {
  try {
    const line = Object.entries(fields)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" ");
    if (level === "warn") console.warn(`[mail] ${line}`);
    else console.info(`[mail] ${line}`);
  } catch {}
}

export async function sendResendMail(env, opts = {}) {
  const key = String(env?.RESEND_API_KEY || "").trim();
  if (!key) {
    mailLog("warn", { send: "fail", kind: MAIL_FAILURE_CONFIG, status: 503, retryable: false, note: "resend-unset" });
    return { ok: false, error: "resend unset", status: 503, failure: { kind: MAIL_FAILURE_CONFIG, retryable: false } };
  }
  const to = asList(opts.to);
  const subject = String(opts.subject || "").trim();
  const html = opts.html != null ? String(opts.html) : "";
  const text = opts.text != null ? String(opts.text) : "";
  if (!to.length) return { ok: false, error: "to required", status: 400, failure: { kind: MAIL_FAILURE_CONFIG, retryable: false } };
  if (!subject) return { ok: false, error: "subject required", status: 400, failure: { kind: MAIL_FAILURE_CONFIG, retryable: false } };
  if (!html && !text) return { ok: false, error: "body required", status: 400, failure: { kind: MAIL_FAILURE_CONFIG, retryable: false } };
  const body2 = {
    from: String(opts.from || resendFrom(env)).trim() || DEFAULT_FROM,
    to,
    subject
  };
  if (html) body2.html = html;
  if (text) body2.text = text;
  const replyTo = asList(opts.replyTo);
  if (replyTo.length) body2.reply_to = replyTo.length === 1 ? replyTo[0] : replyTo;
  if (Array.isArray(opts.tags) && opts.tags.length) body2.tags = opts.tags;
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = String(opts.idempotencyKey).slice(0, 256);
  }
  let res;
  try {
    res = await fetch(RESEND_API, {
      method: "POST",
      headers,
      body: JSON.stringify(body2),
      signal: opts.signal || AbortSignal.timeout(12e3)
    });
  } catch (e) {
    const failure = { kind: MAIL_FAILURE_TRANSIENT, retryable: true };
    mailLog("warn", { send: "fail", kind: failure.kind, status: 502, retryable: true, note: "network" });
    return { ok: false, error: String(e?.message || e).slice(0, 160), status: 502, provider: "resend", failure };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data && (data.message || data.error || data.name) || `resend ${res.status}`;
    const failure = classifyResendFailure({ status: res.status, error: msg });
    mailLog("warn", { send: "fail", kind: failure.kind, status: res.status, retryable: failure.retryable });
    return {
      ok: false,
      error: String(msg).slice(0, 200),
      status: res.status,
      provider: "resend",
      failure
    };
  }
  const id2 = data && data.id ? String(data.id) : "";
  if (!id2) {
    const failure = { kind: MAIL_FAILURE_TRANSIENT, retryable: true };
    mailLog("warn", { send: "fail", kind: failure.kind, status: 502, retryable: true, note: "empty-id" });
    return { ok: false, error: "resend empty id", status: 502, provider: "resend", failure };
  }
  return { ok: true, id: id2, provider: "resend" };
}

// ---------------------------------------------------------------------------
// Bounded retry queue with backoff (transient failures only)
// ---------------------------------------------------------------------------
export const MAIL_RETRY_KEY = "mailRetryQueue";
export const MAIL_RETRY_MAX_ATTEMPTS = 5;
export const MAIL_RETRY_MAX_ENTRIES = 200;
export const MAIL_RETRY_TTL_MS = 24 * 60 * 60_000;

/** Backoff: 30s, 1m, 2m, 4m, 8m (attempt is 0-based, capped at 30m). */
export function mailRetryDelayMs(attempt) {
  const a = Math.max(0, Number(attempt) || 0);
  return Math.min(30_000 * 2 ** a, 30 * 60_000);
}

function mailRetryNonce() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

async function loadRetryQueue(storage, now) {
  let raw = null;
  try {
    raw = await storage.get(MAIL_RETRY_KEY);
  } catch {
    raw = null;
  }
  const list = Array.isArray(raw) ? raw : [];
  // Prune expired entries (TTL) on every touch.
  const live = list.filter(
    (e) => e && typeof e === "object" && Number(e.firstAt) > now - MAIL_RETRY_TTL_MS
  );
  return { queue: live, pruned: list.length - live.length };
}

/**
 * Enqueue a failed send for background retry. Entry shape:
 * { id, kind, email?, to[], subject, html?, text?, from?, replyTo?, tags?,
 *   idempotencyKey (required), payload? (opaque caller state, e.g. pending
 *   login { codeHash, nonce, exp }), attempts, nextAt, firstAt,
 *   lastError, lastKind }.
 * Returns { queued: true, id } or { queued: false, reason }.
 * Queue is bounded (MAIL_RETRY_MAX_ENTRIES) and deduplicates by
 * idempotencyKey. `email` is used only for supersede checks, never logged.
 */
export async function enqueueMailRetry(storage, entry = {}, now = Date.now()) {
  if (!storage || typeof storage.get !== "function" || typeof storage.put !== "function") {
    return { queued: false, reason: "no-storage" };
  }
  const to = asList(entry.to);
  const idempotencyKey = String(entry.idempotencyKey || "").trim().slice(0, 256);
  if (!to.length) return { queued: false, reason: "to-required" };
  if (!idempotencyKey) return { queued: false, reason: "idempotency-required" };
  if (!entry.text && !entry.html) return { queued: false, reason: "body-required" };
  const { queue, pruned } = await loadRetryQueue(storage, now);
  const live = queue.filter((e) => Number(e.attempts) < MAIL_RETRY_MAX_ATTEMPTS);
  const dup = live.find((e) => String(e.idempotencyKey) === idempotencyKey);
  if (dup) return { queued: true, id: dup.id, deduped: true };
  if (live.length >= MAIL_RETRY_MAX_ENTRIES) {
    mailLog("warn", { retry: "enqueue-fail", reason: "queue-full", entries: live.length });
    return { queued: false, reason: "queue-full" };
  }
  const id = String(entry.id || "").trim() || `retry/${mailRetryNonce()}`;
  live.push({
    id,
    kind: String(entry.kind || "generic").slice(0, 32),
    email: String(entry.email || "").trim() || undefined,
    to,
    subject: String(entry.subject || "").trim().slice(0, 200),
    html: entry.html != null ? String(entry.html).slice(0, 100_000) : undefined,
    text: entry.text != null ? String(entry.text).slice(0, 20_000) : undefined,
    from: entry.from != null ? String(entry.from).trim().slice(0, 200) : undefined,
    replyTo: asList(entry.replyTo),
    tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 8) : undefined,
    idempotencyKey,
    payload: entry.payload && typeof entry.payload === "object" ? entry.payload : undefined,
    attempts: 0,
    nextAt: now + mailRetryDelayMs(0),
    firstAt: now,
    lastError: String(entry.lastError || "").slice(0, 160),
    lastKind: String(entry.lastKind || MAIL_FAILURE_TRANSIENT).slice(0, 32),
  });
  try {
    await storage.put(MAIL_RETRY_KEY, live);
  } catch {
    return { queued: false, reason: "storage-error" };
  }
  if (pruned) mailLog("info", { retry: "pruned", entries: pruned });
  mailLog("info", { retry: "queued", id, kind: String(entry.kind || "generic").slice(0, 32) });
  return { queued: true, id };
}

function retryMailOpts(entry) {
  const opts = {
    to: entry.to,
    subject: entry.subject,
    idempotencyKey: entry.idempotencyKey,
    signal: AbortSignal.timeout(12e3),
  };
  if (entry.from) opts.from = entry.from;
  if (entry.html) opts.html = entry.html;
  if (entry.text) opts.text = entry.text;
  if (entry.replyTo && entry.replyTo.length) opts.replyTo = entry.replyTo;
  if (entry.tags) opts.tags = entry.tags;
  return opts;
}

/**
 * Pump due retry entries. Options:
 * - send: (env, opts) => send result. Defaults to sendResendMail.
 * - shouldSkip(entry): drop entries superseded by newer state (e.g. a fresh
 *   OTP was issued after this one was queued).
 * - onDelivered(entry, result): caller hook after a retry send succeeds
 *   (e.g. persist the pending login the first attempt never stored).
 * - bump(name): metric counter. Log/metric output never includes PII.
 * Returns { checked, due, sent, requeued, dropped, pending }.
 */
export async function pumpMailRetryQueue({
  storage,
  env,
  send,
  shouldSkip,
  onDelivered,
  bump,
  now = Date.now(),
} = {}) {
  const stats = { checked: 0, due: 0, sent: 0, requeued: 0, dropped: 0, pending: 0 };
  const doBump = typeof bump === "function" ? bump : () => {};
  if (!storage || typeof storage.get !== "function" || typeof storage.put !== "function") {
    return stats;
  }
  const doSend = typeof send === "function" ? send : (e, o) => sendResendMail(e, o);
  const { queue, pruned } = await loadRetryQueue(storage, now);
  if (pruned) {
    stats.dropped += pruned;
    doBump("mail:retry:expired");
  }
  const remaining = [];
  for (const entry of queue) {
    stats.checked += 1;
    if (Number(entry.nextAt) > now) {
      remaining.push(entry);
      continue;
    }
    stats.due += 1;
    if (Number(entry.attempts) >= MAIL_RETRY_MAX_ATTEMPTS) {
      stats.dropped += 1;
      doBump("mail:retry:dead");
      mailLog("warn", { retry: "dropped", id: entry.id, reason: "attempts-exhausted", attempts: entry.attempts });
      continue;
    }
    let skip = false;
    try {
      skip = typeof shouldSkip === "function" ? Boolean(await shouldSkip(entry)) : false;
    } catch {
      skip = false;
    }
    if (skip) {
      stats.dropped += 1;
      doBump("mail:retry:superseded");
      mailLog("info", { retry: "dropped", id: entry.id, reason: "superseded" });
      continue;
    }
    let result = null;
    try {
      result = await doSend(env, retryMailOpts(entry));
    } catch (e) {
      result = { ok: false, error: String(e?.message || e).slice(0, 160), status: 502, provider: "resend" };
    }
    if (result && result.ok) {
      stats.sent += 1;
      doBump("mail:send:ok");
      mailLog("info", { retry: "sent", id: entry.id, kind: entry.kind, attempts: Number(entry.attempts) + 1 });
      try {
        if (typeof onDelivered === "function") await onDelivered(entry, result);
      } catch {}
      continue;
    }
    const failure = (result && result.failure) || classifyResendFailure(result || {});
    if (failure.retryable && Number(entry.attempts) + 1 < MAIL_RETRY_MAX_ATTEMPTS) {
      entry.attempts = Number(entry.attempts) + 1;
      entry.nextAt = now + mailRetryDelayMs(entry.attempts);
      entry.lastError = String((result && result.error) || "send failed").slice(0, 160);
      entry.lastKind = failure.kind;
      remaining.push(entry);
      stats.requeued += 1;
      doBump("mail:retry:requeued");
      mailLog("warn", {
        retry: "requeued",
        id: entry.id,
        kind: entry.kind,
        attempt: entry.attempts,
        failure: failure.kind,
        status: (result && result.status) || 0,
        nextInMs: entry.nextAt - now,
      });
    } else {
      stats.dropped += 1;
      doBump("mail:retry:dead");
      mailLog("warn", {
        retry: "dropped",
        id: entry.id,
        kind: entry.kind,
        reason: failure.retryable ? "attempts-exhausted" : "not-retryable",
        failure: failure.kind,
        status: (result && result.status) || 0,
      });
    }
  }
  try {
    if (remaining.length) await storage.put(MAIL_RETRY_KEY, remaining);
    else await storage.delete(MAIL_RETRY_KEY);
  } catch {}
  stats.pending = remaining.length;
  return stats;
}

export function mailInternalAllowed(request, env) {
  const key = String(env?.RESEND_API_KEY || "").trim();
  const auth = String(request?.headers?.get?.("Authorization") || "");
  if (key && auth === `Bearer ${key}`) return true;
  const lobby = String(env?.LOBBY_SESSION_SECRET || "").trim();
  const internal = String(request?.headers?.get?.("x-dasha-internal") || "");
  if (lobby && internal && internal === lobby) return true;
  return false;
}
export async function handleMailSmoke(request, env) {
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  if (!resendConfigured(env)) {
    return Response.json({ error: "resend unset" }, { status: 503 });
  }
  if (!mailInternalAllowed(request, env)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  let body2 = {};
  try {
    const raw = await request.text();
    if (raw && raw.length <= 4096) body2 = JSON.parse(raw || "{}");
  } catch {
    body2 = {};
  }
  const subject = String(body2.subject || "Dasha Resend smoke").slice(0, 120);
  const text = String(
    body2.text || `Resend rail ok from dasha-lobby \xB7 ${(/* @__PURE__ */ new Date()).toISOString()}`
  ).slice(0, 2e3);
  const result = await sendResendMail(env, {
    to: SMOKE_TO,
    subject,
    text,
    tags: [{ name: "kind", value: "smoke" }],
    idempotencyKey: `smoke/${Date.now()}`
  });
  if (!result.ok) {
    return Response.json(
      { ok: false, provider: "resend", error: result.error, kind: result.failure?.kind || "transient", retryable: Boolean(result.failure?.retryable) },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }
  return Response.json({ ok: true, provider: "resend", id: result.id, to: SMOKE_TO });
}
export function isMailSmokePath(pathname) {
  const p = String(pathname || "");
  return p === "/internal/mail/smoke" || p === "/internal/mail/smoke/";
}
export function isMailRetryPath(pathname) {
  const p = String(pathname || "");
  return p === "/internal/mail/retry" || p === "/internal/mail/retry/";
}
