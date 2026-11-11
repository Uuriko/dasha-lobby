# Login performance budget + observability

TASKS.md theme (e): tasks 40 (funnel metrics + alerting) and 43 (perf budget).
Implementation: `dasha-login-metrics.mjs`, wired into `dasha-lobby-worker.mjs`.

## Server-side p95 latency targets (per route)

Measured edge-handler time (no network round trip), recorded automatically on
every login route via the `loginObservedRoute` wrapper in the lobby DO and the
worker dispatch. Histogram buckets: 50 / 100 / 250 / 500 / 1000 / 2500 / 5000 /
10000 ms.

| Route | p95 target | What dominates |
|---|---|---|
| `GET /login` (HTML) | ≤ 300 ms | static HTML serve |
| `POST /auth/wallet/challenge` | ≤ 800 ms | HMAC sign + KV writes |
| `POST /auth/wallet/verify` | ≤ 1,500 ms | Ed25519 signature verify |
| `POST /auth/email/start` | ≤ 3,000 ms | Resend API call |
| `POST /auth/email/verify` | ≤ 800 ms | hash compare + HMAC sign |
| `POST /auth/grok/start` | ≤ 600 ms | KV write + HMAC sign |
| `GET /auth/grok/status` | ≤ 300 ms | poll — keep tiny, no crypto |
| `GET /oauth/x/start` (302) | ≤ 500 ms | PKCE + state sign |
| `GET /oauth/x/callback` | ≤ 4,000 ms | token exchange + profile fetch |
| `GET /oauth/google/start` (302) | ≤ 500 ms | PKCE + state sign |
| `GET /oauth/google/callback` | ≤ 4,000 ms | token exchange + JWKS verify |

If a route's p95 exceeds its target for a day, treat it as a perf bug, not
traffic: login volume is low enough that p95 should track the target.

## Login page budget (task 43)

- HTML ≤ 40 KB (served `/login` is ~13.7 KB as of 2026-09-17).
- No render-blocking JS: no `<script>` in `<head>`; every external script
  carries `defer` or `async`.
- Real SRI hashes on client scripts — the `__X_CONNECT_SRI__` placeholder that
  shipped on `/login` (and would have made browsers block `x-connect.js`) is
  resolved to the live `X_CONNECT_SRI` pin at serve time.
- Enforced by `dasha-login-metrics.test.mjs` (perf budget section).

## Metric scheme

All keys live in the lobby DO (`public` instance) storage, one JSON object per
day: `login-metrics:<yyyy-mm-dd>` → `{ v: 1, counters: { "<m>:<r>:<o>": n, … } }`.

- **Semantic funnel events** — `signin:<method>:<route>:<outcome>` with
  outcome ∈ `start` (attempt began), `success` (session established), `fail`
  (user-recoverable: wrong/expired code, bad signature, OAuth cancelled or
  invalid state), `provider-error` (Resend / X / Google upstream failed),
  `rate-limited`, `view` (`/login` page views).
- **Automatic completions** — same key shape, outcome ∈ `ok` (2xx/3xx),
  `client-error` (4xx), `server-error` (5xx), `other`. Recorded for every login
  route without per-branch edits.
- **Latency histograms** — `signin:lat:<m>:<r>:count` plus cumulative
  `signin:lat:<m>:<r>:le<bucket>` for every recorded event.

Methods: `wallet`, `email`, `grok`, `x`, `google`, `login` (page views only).

### Reading the metrics

```js
import { readLoginMetrics, readMethodOutcomes } from './dasha-login-metrics.mjs';
const counters = await readLoginMetrics(storage); // today's counters object
const email = await readMethodOutcomes(storage, { method: 'email' });
// p95 approximation for a route: smallest bucket with leN/count >= 0.95
```

The Worker isolate has no DO storage on the OAuth paths, so worker-side events
are forwarded to the lobby DO via the internal `POST /auth/__login-metrics`
route (`recordWorkerLoginMetric`). This closes the old production gap where
`env.__lobbyMetricStorage` was always undefined on live and X/Google successes
were never recorded. The ingest route rejects browser POSTs (Origin/Referer
present) and whitelist-validates the payload.

## Quiet-failure alerting hooks

`evaluateLoginAlerts()` runs after every terminal event
(`success`/`fail`/`provider-error`) and writes **internal-only** rows
(`login-alert:<yyyy-mm-dd>:<method>:<kind>`) — never served publicly.

| Alert kind | Threshold (per method, per day) | Catches |
|---|---|---|
| `success-rate-drop` | ≥ 5 terminal events and success rate < 50% | broken method, UX regression |
| `provider-errors` | ≥ 3 `provider-error` events | Resend/X/Google dying quietly |

Alert rows are idempotent per day (first trip wins). They are the hook a
watcher/cron reads — e.g. room-watch or a future webhook consumer — so
provider outages are caught in minutes, not days.

## PII-free policy

Events are whitelist-validated: `method`, `route`, `outcome` must be known
constants, `latencyMs` a bounded number. Unknown fields (email, token, IP,
handle, wallet address) are ignored; invalid events are dropped silently and
never throw. No per-user data is stored anywhere in this system.

## Notes

- `bumpLobbyMetric()` is kept for backward compatibility; login funnels now
  use `recordLoginEvent()`.
- Deploys stay in Grok Bot's lane (`dasha-lobby-wrangler.deploy.jsonc` only);
  this change ships through the normal PR → Grok Bot deploy train (task 42).
