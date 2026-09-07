/**
 * Resend mail rail (mirrored from live bundle 2026-09-07).
 * Internal smoke endpoint only: POST /internal/mail/smoke.
 * Gate: Bearer RESEND_API_KEY or x-dasha-internal == LOBBY_SESSION_SECRET.
 * No facilitator secrets in repo - env var names only.
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
async function sendResendMail(env, opts = {}) {
  const key = String(env?.RESEND_API_KEY || "").trim();
  if (!key) return { ok: false, error: "resend unset", status: 503 };
  const to = asList(opts.to);
  const subject = String(opts.subject || "").trim();
  const html = opts.html != null ? String(opts.html) : "";
  const text = opts.text != null ? String(opts.text) : "";
  if (!to.length) return { ok: false, error: "to required", status: 400 };
  if (!subject) return { ok: false, error: "subject required", status: 400 };
  if (!html && !text) return { ok: false, error: "body required", status: 400 };
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
    return { ok: false, error: String(e?.message || e).slice(0, 160), status: 502, provider: "resend" };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data && (data.message || data.error || data.name) || `resend ${res.status}`;
    return {
      ok: false,
      error: String(msg).slice(0, 200),
      status: res.status,
      provider: "resend"
    };
  }
  const id2 = data && data.id ? String(data.id) : "";
  if (!id2) return { ok: false, error: "resend empty id", status: 502, provider: "resend" };
  return { ok: true, id: id2, provider: "resend" };
}
function mailInternalAllowed(request, env) {
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
      { ok: false, provider: "resend", error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }
  return Response.json({ ok: true, provider: "resend", id: result.id, to: SMOKE_TO });
}
export function isMailSmokePath(pathname) {
  const p = String(pathname || "");
  return p === "/internal/mail/smoke" || p === "/internal/mail/smoke/";
}
