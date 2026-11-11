/**
 * Login observability primitives (TASKS.md theme e: tasks 40 + 43).
 *
 * Aggregate-only, PII-free login telemetry for the lobby login flow:
 *   - per-method success/failure funnel events (wallet, email, grok, x, google)
 *   - per-route latency histograms (cumulative buckets, ms)
 *   - quiet-failure alerting hooks (success-rate drops, provider-error spikes)
 *
 * PII policy: events are whitelist-validated. method/route/outcome must be one
 * of the constants below; latencyMs is a bounded number. No emails, tokens,
 * IPs, handles, or wallet addresses are accepted or stored — unknown fields
 * are ignored and invalid events are dropped silently (never throw).
 *
 * Storage layout (single Durable Object, 'public' lobby instance):
 *   login-metrics:<yyyy-mm-dd>            -> { v: 1, counters: { "<m>:<r>:<o>": n,
 *                                                "lat:<m>:<r>:le<bucket>": n,
 *                                                "lat:<m>:<r>:count": n } }
 *   login-alert:<yyyy-mm-dd>:<m>:<kind>   -> { at, method, kind, terminal,
 *                                                successes, fails,
 *                                                providerErrors, rate }
 * Alert rows are INTERNAL ONLY: no public route reads or serves them.
 *
 * The Worker isolate has no Durable Object storage on the OAuth paths, so
 * recordWorkerLoginMetric() forwards worker-side events to the lobby DO via
 * the internal POST /auth/__login-metrics route (or writes directly when a
 * test/storage binding is present). This closes the production gap where the
 * old `env?.__lobbyMetricStorage` was always undefined on live.
 */

export const LOGIN_METHODS = ['wallet', 'email', 'grok', 'x', 'google', 'login'];
export const LOGIN_ROUTES = ['challenge', 'verify', 'start', 'callback', 'status', 'page'];
export const LOGIN_OUTCOMES = [
  // semantic funnel events
  'start', 'success', 'fail', 'provider-error', 'rate-limited', 'view',
  // automatic per-response completions (outcome derived from HTTP status)
  'ok', 'client-error', 'server-error', 'other',
];
export const LOGIN_TERMINAL_OUTCOMES = ['success', 'fail', 'provider-error'];
export const LATENCY_BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** Routes the observability wrapper tracks, mapped to [method, route]. */
export const LOGIN_OBSERVED_ROUTES = {
  '/auth/wallet/challenge': ['wallet', 'challenge'],
  '/auth/wallet/verify': ['wallet', 'verify'],
  '/auth/email/start': ['email', 'start'],
  '/auth/email/verify': ['email', 'verify'],
  '/auth/grok/start': ['grok', 'start'],
  '/auth/grok/status': ['grok', 'status'],
  '/auth/grok/verify': ['grok', 'verify'],
  '/oauth/x/start': ['x', 'start'],
  '/oauth/x/callback': ['x', 'callback'],
  '/oauth/google/start': ['google', 'start'],
  '/oauth/google/callback': ['google', 'callback'],
  '/login': ['login', 'page'],
};

export function loginObservedRoute(pathname) {
  if (!pathname) return null;
  const p = String(pathname).replace(/\/+$/, '') || '/';
  return LOGIN_OBSERVED_ROUTES[p] || null;
}

export function loginCompletionOutcome(status) {
  const s = Number(status) || 0;
  if (s >= 200 && s < 400) return 'ok'; // 302 start-redirects are the happy path
  if (s >= 400 && s < 500) return 'client-error';
  if (s >= 500 && s < 600) return 'server-error';
  return 'other';
}

// ---- alerting thresholds (documented in docs/login-perf-budget.md) ----
export const ALERT_MIN_TERMINAL = 5; // min terminal events/day/method before a rate alert can fire
export const ALERT_SUCCESS_RATE_FLOOR = 0.5; // success rate below this (with >= MIN_TERMINAL) raises an alert
export const ALERT_PROVIDER_ERROR_MIN = 3; // provider-error events/day/method that raise an alert

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeToken(value, whitelist) {
  const v = String(value || '').trim().toLowerCase();
  return whitelist.includes(v) ? v : null;
}

function sanitizeLatency(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 600000) return null;
  return Math.round(n);
}

function metricsKey(date) {
  return `login-metrics:${date}`;
}

/**
 * Record one aggregate login event. Never throws; returns true when recorded.
 * Extra fields on `event` are ignored — this is what keeps logging PII-free.
 */
export async function recordLoginEvent(storage, event) {
  try {
    if (!storage || typeof storage.get !== 'function' || typeof storage.put !== 'function') return false;
    const method = sanitizeToken(event?.method, LOGIN_METHODS);
    const route = sanitizeToken(event?.route, LOGIN_ROUTES);
    const outcome = sanitizeToken(event?.outcome, LOGIN_OUTCOMES);
    if (!method || !route || !outcome) return false;
    const latencyMs = sanitizeLatency(event?.latencyMs);
    const date = today();
    const key = metricsKey(date);
    const cur = (await storage.get(key)) || { v: 1, counters: {} };
    if (!cur.counters || typeof cur.counters !== 'object') cur.counters = {};
    const c = cur.counters;
    c[`${method}:${route}:${outcome}`] = (c[`${method}:${route}:${outcome}`] || 0) + 1;
    if (latencyMs != null) {
      c[`lat:${method}:${route}:count`] = (c[`lat:${method}:${route}:count`] || 0) + 1;
      for (const b of LATENCY_BUCKETS_MS) {
        if (latencyMs <= b) c[`lat:${method}:${route}:le${b}`] = (c[`lat:${method}:${route}:le${b}`] || 0) + 1;
      }
    }
    await storage.put(key, cur);
    if (LOGIN_TERMINAL_OUTCOMES.includes(outcome)) {
      // Quiet-failure alerting hook: evaluate success-rate / provider-error
      // thresholds after every terminal event. Awaited for determinism;
      // login volume is low and the evaluation is a single storage read.
      await evaluateLoginAlerts(storage, { date, method });
    }
    return true;
  } catch {
    return false;
  }
}

/** Read the raw aggregate counters for a date (tests + alert evaluation). */
export async function readLoginMetrics(storage, { date } = {}) {
  try {
    if (!storage || typeof storage.get !== 'function') return {};
    const d = date || today();
    const cur = await storage.get(metricsKey(d));
    return cur && typeof cur.counters === 'object' ? { ...cur.counters } : {};
  } catch {
    return {};
  }
}

/** Per-method terminal-event counts for alerting: { start, success, fail, 'provider-error', 'rate-limited' }. */
export async function readMethodOutcomes(storage, { date, method } = {}) {
  const counters = await readLoginMetrics(storage, { date });
  const out = { start: 0, success: 0, fail: 0, 'provider-error': 0, 'rate-limited': 0 };
  const prefix = `${method}:`;
  for (const [k, v] of Object.entries(counters)) {
    if (!k.startsWith(prefix)) continue;
    const outcome = k.slice(prefix.length).split(':').slice(1).join(':');
    if (outcome in out) out[outcome] += Number(v) || 0;
  }
  return out;
}

function alertKey(date, method, kind) {
  return `login-alert:${date}:${method}:${kind}`;
}

async function writeAlert(storage, date, method, kind, detail) {
  const key = alertKey(date, method, kind);
  try {
    const existing = await storage.get(key);
    if (existing) return { ...existing, fresh: false };
  } catch {}
  const alert = { at: Date.now(), method, kind, ...detail, fresh: true };
  try {
    await storage.put(key, alert);
  } catch {}
  return alert;
}

/**
 * Quiet-failure alerting hook. Evaluates per-method thresholds for one day
 * and writes internal-only alert rows (never served publicly).
 * Returns the list of raised/existing alerts.
 */
export async function evaluateLoginAlerts(storage, { date, method } = {}) {
  const alerts = [];
  try {
    if (!storage || typeof storage.get !== 'function' || typeof storage.put !== 'function') return alerts;
    const d = date || today();
    const methods = method ? [method] : LOGIN_METHODS.filter((m) => m !== 'login');
    for (const m of methods) {
      if (!LOGIN_METHODS.includes(m)) continue;
      const o = await readMethodOutcomes(storage, { date: d, method: m });
      const terminal = o.success + o.fail + o['provider-error'];
      const rate = terminal > 0 ? o.success / terminal : null;
      if (terminal >= ALERT_MIN_TERMINAL && rate != null && rate < ALERT_SUCCESS_RATE_FLOOR) {
        alerts.push(await writeAlert(storage, d, m, 'success-rate-drop', {
          terminal, successes: o.success, fails: o.fail, providerErrors: o['provider-error'], rate: Math.round(rate * 1000) / 1000,
        }));
      }
      if (o['provider-error'] >= ALERT_PROVIDER_ERROR_MIN) {
        alerts.push(await writeAlert(storage, d, m, 'provider-errors', {
          terminal, successes: o.success, fails: o.fail, providerErrors: o['provider-error'], rate,
        }));
      }
    }
  } catch {}
  return alerts;
}

/** Internal-only read of today's alert rows (no public route exposes these). */
export async function listLoginAlerts(storage, { date } = {}) {
  try {
    if (!storage) return [];
    const d = date || today();
    if (typeof storage.list === 'function') {
      const rows = await storage.list({ prefix: `login-alert:${d}:` });
      const out = [];
      for (const [, v] of rows) if (v && typeof v === 'object') out.push(v);
      return out.sort((a, b) => (a.at || 0) - (b.at || 0));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Worker-isolate path (OAuth callbacks, /login page): the Worker has no DO
 * storage, so forward the event to the lobby DO's internal
 * POST /auth/__login-metrics route. In tests, env.__lobbyMetricStorage is
 * written directly. Only whitelisted scalar fields are forwarded, so no PII
 * can cross this boundary.
 */
export async function recordWorkerLoginMetric(env, event) {
  try {
    if (!event || typeof event !== 'object') return false;
    const direct = env?.__lobbyMetricStorage;
    if (direct && typeof direct.get === 'function' && typeof direct.put === 'function') {
      return recordLoginEvent(direct, event);
    }
    const lobby = env?.LOBBY;
    if (!lobby || typeof lobby.get !== 'function' || typeof lobby.idFromName !== 'function') return false;
    const stub = lobby.get(lobby.idFromName('public'));
    if (!stub || typeof stub.fetch !== 'function') return false;
    const payload = {
      method: event.method,
      route: event.route,
      outcome: event.outcome,
      latencyMs: event.latencyMs,
    };
    const res = await stub.fetch(
      new Request('https://internal/auth/__login-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
    return res != null && res.ok === true;
  } catch {
    return false;
  }
}
