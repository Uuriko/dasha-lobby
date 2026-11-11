# "Sign in with Dasha" — OAuth-provider design

Task #48 · [AUTO] design only, no build · 2026-09-17

Turning the login investment into an agent-identity layer: third-party MCP
clients and autonomous agents authenticate users via Dasha identity and call
the Dasha APIs on their behalf, instead of copy-pasting long-lived API keys.

**Lane rules (unchanged):** design + PR only. Never merge (Grok Bot's lane),
never deploy, no credentials/secrets handling, no money moves, no external
sends. Launch approval is task #49 and is a [JOHN] tap, not this doc.

Tags: [AUTO] = worker can do alone. [JOHN] = needs John's tap.

---

## 1. Goal & scope

**Goal:** any MCP client (Claude Desktop, Cursor, an agent's own harness) can
offer "Sign in with Dasha", obtain the user's consent, and call
`/v1/chat/completions`, job, receipt, and key endpoints as that user — with
short-lived, scoped, revocable tokens.

**In scope:** OAuth 2.1 provider endpoints, OIDC identity layer, dynamic
client registration / client metadata, consent UX, scopes, token lifetimes,
security model, phased rollout.

**Non-goals:** no changes to the existing 5 login methods; no change to
existing compute API keys (they keep working); no first-party agent SDK yet;
no DPoP/mTLS in v1 (Phase 4); no federation *out* to other IdPs beyond what
login already does.

**Why now:** today's "MCP support" is a static tool catalog
(`/compute/mcp.json`, `/.well-known/mcp.json`) — a tool *list*, no streamable
MCP session, no auth story. Agents today authenticate with a raw Bearer API
key (`DASHA_API_KEY`) pasted into config — long-lived, all-powerful, no
consent record, no per-client revocation. The MCP 2025-06-18 authorization
spec expects exactly what this doc designs: OAuth 2.1 + client metadata +
protected-resource discovery.

---

## 2. What exists today (grounding)

Read from the repo at `origin/main` (dasha-lobby-worker.mjs ~13.7k lines,
dasha-lobby-{x,google,github}.mjs, dasha-compute-network.mjs):

- **Login (5 methods):** Grok Bot pairing code, X OAuth 2.0+PKCE (verified
  working), Google OAuth 2.0+PKCE (merged #247, unconfigured — live is rolled
  back, "Continue with Google" 404s), email OTP via Resend (provider-level
  failures), Solana wallet SIWS challenge-response.
- **Sessions:** stateless HMAC-signed payload cookies (`signPayload` /
  `verifyPayload` with `LOBBY_SESSION_SECRET`), `__Host-` prefix, HttpOnly,
  Secure, SameSite=Lax, 30-day TTL (`SESSION_TTL_MS`). **No server-side
  session registry.** Task #19 (server-side registry) is still open.
- **Dasha as OAuth *client* (RP):** `/oauth/x/start|callback`,
  `/oauth/google/start|callback`, `/oauth/github/...`. Issuer-side code does
  not exist yet. PKCE S256, signed state cookies (900s), `randomUrlToken`
  entropy, id-token verification with JWKS (Google) — these primitives are
  reusable for the provider side.
- **Compute auth:** Bearer API keys managed at `/compute/keys` (hash rows
  stored, revocable per key — "revoke an API key to drop its hash row").
  Non-self `v1/chat/completions` debits prepaid credits ($0.05/job,
  `reason: 'api-chat'`); per-key `limit_cents` is runaway-only spend cap,
  not a free allowance.
- **Hosts:** login callbacks live on `https://lobby.getdasha.com`; the
  public site/API on `https://www.getdasha.com`. One Worker serves both.

Implication: the provider role is genuinely new server-side state
(authz codes, client registry, consent records, refresh-token families).
Sessions being stateless means the *grant* store cannot ride on the session
cookie — it needs a KV namespace or Durable Object. This is the single
biggest infrastructure decision in this doc (see §10).

---

## 3. Proposed endpoint surface (OAuth 2.1 + OIDC)

Issuer (fixed, never configurable per client):

```
https://lobby.getdasha.com
```

| Endpoint | Method | Purpose |
|---|---|---|
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 discovery |
| `/.well-known/openid-configuration` | GET | OIDC discovery (superset) |
| `/.well-known/oauth-protected-resource` | GET | RFC 9728 resource metadata: which scopes the compute API accepts, where the AS is — this is what MCP hosts use to discover "Sign in with Dasha" |
| `/.well-known/jwks.json` | GET | ES256 signing keys (rotation via `kid`) |
| `/oauth/register` | POST | RFC 7591 Dynamic Client Registration |
| `/oauth/authorize` | GET | authorization endpoint (browser; user must hold a valid Dasha session cookie first) |
| `/oauth/token` | POST | code exchange (PKCE), refresh rotation |
| `/oauth/userinfo` | GET | OIDC userinfo (Bearer access token) |
| `/oauth/revoke` | POST | RFC 7009 token revocation (also powers "revoke client" in /account) |

Flows supported: **authorization code only.** No implicit, no hybrid, no
resource-owner password, no client-credentials grant in v1 (service agents
use the existing API keys — that's what they're for).

---

## 4. Client registration model

Two lanes — the split is deliberate, and the open-vs-allowlisted line for
lane B is a **[JOHN] tap**:

**Lane A — self-serve (public clients).** RFC 7591 DCR, but the recommended
path is the MCP pattern: the client hosts a **Client-Initiated Metadata
Document (CIMD)** and passes `client_metadata_url` instead of registering up
front. Either way, self-serve clients get:
- `redirect_uris`: exact-match allowlist, `https://` only, except the
  RFC 8252 loopback exception (`http://127.0.0.1:<port>/...` for CLI agents).
  No wildcards, no custom schemes in lane A, no `localhost` hostname.
- scopes capped at `openid profile email compute:read`.
- a `client_id` issued, **no client secret** (public client).

**Lane B — allowlisted (confidential clients).** Partners / first-party
agents that need `compute:spend`. Registration issues `client_id` +
`client_secret` (stored as a hash, shown once). Eligible for the spend scope
and for custom-scheme redirects (documented native-app case). **[JOHN]:
open DCR for lane B too, or manual allowlist?** Recommendation: manual
allowlist until abuse metrics exist (see §14 P3) — money moves on this
scope.

Client metadata shown at consent time comes from the registration record /
CIMD document: `client_name`, `logo_uri`, `client_uri`, `contacts`.
Unverifiable metadata is displayed with a "unverified publisher" treatment —
never presented as Dasha-vouched.

---

## 5. Scopes

| Scope | Grants | Lane | Phase |
|---|---|---|---|
| `openid` | OIDC `sub`, `iss`, `aud` | A | P2 |
| `profile` | display name, avatar | A | P2 |
| `email` | verified email address only if the linked method verified it | A | P2 |
| `compute:read` | models list, network status, own jobs/receipts/usage | A | P2 |
| `compute:spend` | spend prepaid credits on chat/jobs *as the user*, bounded by per-client cap (§9) | B only | P3 |
| `compute:keys` | create/revoke the user's API keys | — | P4, [JOHN] |

Explicitly **not** exposed: other users' data, admin endpoints, Simp/Board
moderation, referral payouts, settlement. Scope strings are additive and
down-scopable at refresh; `prompt=consent` re-shows when scopes widen.

Human-readable consent copy per scope is part of the build (e.g.
"`compute:spend` — let this agent spend your Dasha credits, up to
$X/month"). Copy needs one editorial pass at build time.

---

## 6. PKCE & client authentication

- **PKCE S256 required for every client**, public or confidential (OAuth 2.1
  §4). No `plain`, no `none`. Reuse the existing `pkceChallengeS256` /
  `randomUrlToken` primitives.
- Confidential (lane B) clients additionally authenticate at `/oauth/token`
  with `client_secret_basic`. Secrets are random 256-bit, stored hashed,
  rotatable, and never logged.
- `state` (≥128-bit entropy) required on authorize; exact `redirect_uri`
  match against the registered allowlist — this is the existing X/Google
  callback hardening (task #10) applied to the provider side.

---

## 7. Authorization & consent UX

1. Client → `GET /oauth/authorize?...&client_metadata_url=...`.
2. Worker checks the user session cookie. **No session → normal Dasha login
   first** (any of the 5 methods; post-login returns to authorize). The login
   system is the identity proof — anonymous authorize is rejected.
3. Consent screen (server-rendered, same quiet style as /login):
   - client name, logo, domain, "unverified publisher" badge when applicable;
   - exact scopes in plain language + the spend cap for `compute:spend`;
   - "This agent will act **as you** on Dasha" framing;
   - Allow once / Allow & remember / Deny.
4. On allow: 302 to `redirect_uri` with `code` + `state`. Authz code is
   10-minute, single-use, bound to `(client_id, redirect_uri,
   code_challenge, scope, user)`.
5. Consent remembered per `(user, client_id, scope-set)`; revocable at
   `/account` → "Connected agents" (ties into task #34 /account page).
   `prompt=consent` forces re-display; remembered consent expires after
   12 months of non-use.

Step-up auth (task #18) composes here later: first grant of `compute:spend`
or a cap increase can require fresh authentication (`max_age` / `acr`).

---

## 8. Subject & userinfo claims

- `sub`: **stable, opaque, public**: `dasha_` + base64url(sha256(accountId)).
  Stable across clients (agents need correlation for billing/ownership of
  jobs); opaque (no X handle / wallet / email embedded). Pairwise subs were
  considered — rejected for v1 because per-user billing and job ownership
  need a join key, and Dasha is not an anonymity product.
- `email` + `email_verified`: `email_verified=true` only when the linked
  login method verified it (Google/X verified; OTP-verified; wallet-only
  accounts have no email claim).
- `preferred_username` / `name` / `picture`: from the account profile
  (task #34). No X handle or wallet address in the default claim set —
  wallet addresses stay behind an explicit future scope, not `profile`.

---

## 9. Token lifetimes & format

| Token | Format | Lifetime | Notes |
|---|---|---|---|
| Authorization code | opaque | 10 min, single-use | bound to client+redirect+PKCE+scope+user |
| Access token | JWT, ES256 | **1 hour** | `iss=https://lobby.getdasha.com`, `aud` = the resource server origin it's presented to (`https://www.getdasha.com`), `scope`, `sub`, `client_id`, `jti` |
| Refresh token | opaque | 30 days, **rotating** | reuse of an old token in a family → revoke the whole family (theft signal) |
| ID token | JWT, ES256 | 5 min | standard OIDC claims only |

- Signing keys: P-256 via `crypto.subtle`, `kid`-stamped, published at
  `/.well-known/jwks.json`, rotated with overlap (old `kid` verifies for
  2× access-token lifetime after rotation).
- **Bridge to compute auth:** access tokens are accepted everywhere
  `DASHA_API_KEY` Bearer keys are accepted today, with scope checks enforced
  *alongside* the existing key spend-cap logic. A token with
  `compute:spend` spends against the **per-client monthly cap** (default
  proposed: **$5/month, [JOHN] tap**) *and* the account's prepaid balance —
  whichever hits first. No token may spend more than the account could
  spend with its own keys.
- Access tokens are 1h on purpose: agent compromise blast radius stays
  small; refresh rotation keeps UX smooth. Aligning with the 30-day cookie
  session TTL is a non-goal — the cookie only gates the authorize step.

---

## 10. Storage — the one infrastructure decision

The provider role needs server-side state: client registry, authz codes,
consent records, refresh-token families, signing-key versions. Sessions
being stateless means none of this can ride the cookie.

**Recommendation:** new KV namespace `DASHA_OAUTH` (+ bindings in
`dasha-lobby-wrangler.jsonc`), using Cloudflare's
`@cloudflare/workers-oauth-provider` as the implementation base — it's the
reference pattern the task brief names (DCR/CIMD helpers, grant store,
PKCE enforcement), and it keeps the code we write to Dasha-specific parts
(consent UX, scope→billing bridge, userinfo claims).

**[JOHN] / Grok Bot implications:** new KV namespace + npm dependency +
wrangler config change — Grok Bot owns the deploy lane
(`dasha-lobby-wrangler.deploy.jsonc` only), so the build PR must not touch
deploy config; the namespace creation itself is an account action for John.

Alternative considered: Durable Object for the grant store (stronger
consistency for refresh-family reuse detection). KV + short code lifetimes
is sufficient for v1; DO is the Phase-4 answer if reuse races ever matter.

---

## 11. Security considerations

- **Redirect allowlist:** exact string match on authorize *and* token;
  mismatch = hard error, no redirect (open-redirector safe).
- **Audience binding:** resource servers reject tokens whose `aud` isn't
  them; `iss` pinned to `https://lobby.getdasha.com`. (Today's Google
  id-token verification already does iss/aud checks — same discipline.)
- **No downgrade:** no implicit/hybrid; `response_mode` limited to
  `query`; `code_challenge_method` S256-only.
- **Refresh hygiene:** rotation + reuse detection + absolute 30-day cap;
  revocation endpoint also revokes the family; `/account` shows and
  revokes per-client grants.
- **Token endpoint hardening:** rate-limited per IP + per client (abuse
  task #21 patterns apply); constant-time secret compare; no secret in
  error messages.
- **Consent phishing:** unverified-publisher treatment (§4); consent page
  served from `lobby.getdasha.com` only, never iframed (`frame-ancestors:
  'none'`); scope copy fixed, not client-supplied.
- **Key custody:** signing keys in Worker secrets / KV, never in the repo;
  rotation runbook in the build PR. (Standing trust gap per memory:
  custody is the highest-leverage item — don't add a new key without a
  named custodian/rotation story.)
- **Phase 4:** DPoP (RFC 9449) sender-constraining for high-value clients;
  `compute:keys` scope; step-up auth on cap increases.

---

## 12. Relation to existing API keys

No migration, no breakage. API keys remain the path for service-to-service
and scripts. "Sign in with Dasha" is the path for **agents acting as a
user**. Over time the consent/Connected-agents UI becomes the natural home
for key management too (task #34 /account), but keys and OAuth grants stay
independent credential families in v1.

---

## 13. MCP-client specifics

MCP's 2025-06-18 authorization spec is OAuth 2.1 with:
1. **Protected Resource Metadata** (RFC 9728) at
   `/.well-known/oauth-protected-resource` on the *resource server*
   (`www.getdasha.com`) — advertises `authorization_servers` and
   `scopes_supported`. **This is the discovery hook** that makes MCP hosts
   offer "Sign in with Dasha" unprompted.
2. **CIMD** (`client_metadata_url`) so MCP clients never need a
   pre-registration step.
3. `resource` parameter (RFC 8707) binding tokens to the API origin —
   matches the `aud` design in §9.

Phase 2 ships 1+2; the static `/compute/mcp.json` catalog stays as the
tool list and gains an `auth` pointer to the protected-resource metadata.

---

## 14. Phased rollout

- **P0 — now:** this design doc; John's taps (§15). No code.
- **P1 — dogfood (first-party only):** authorize/token/userinfo/jwks +
  revoke behind lane-B allowlist containing only Dasha's own agent
  tooling. Validates the grant flow, the scope→billing bridge, and
  refresh rotation end-to-end. No public registration.
- **P2 — public read:** open CIMD/DCR for lane A (`openid profile email
  compute:read`); RFC 9728 metadata live; consent UX + Connected-agents
  revocation in /account.
- **P3 — spend:** `compute:spend` for allowlisted lane-B clients, per-client
  caps, abuse dashboards; DCR-for-spend stays closed pending metrics.
- **P4 — hardening:** DPoP, `compute:keys` scope ([JOHN]), step-up auth
  integration, refresh-family analytics.

Each phase is independently shippable behind the existing config-gating
pattern (task #1: unconfigured → not rendered, never a dead button).

---

## 15. Open questions — John's taps [JOHN]

1. **Client registration policy:** open DCR for spend-scope clients, or
   manual allowlist indefinitely? (Doc recommends allowlist until abuse
   metrics exist.)
2. **Third-party scopes:** is `compute:read` + identity acceptable for any
   registered client, or should even read require allowlisting at first?
3. **Default per-client spend cap:** $5/month proposed — confirm or set.
4. **`sub` stability:** stable opaque `sub` across clients (recommended)
   vs pairwise per-client subs (more private, breaks billing joins).
5. **Grant-store backend:** KV namespace (recommended, v1) vs Durable
   Object now. Either way it's a new account-level resource Grok Bot/John
   must create.
6. **Launch approval:** task #49 — nothing here ships without it.
7. **Method-lineup interplay:** consent UX copy assumes the task #3 lineup
   decision; passkey/WebAuthn (tasks #5–6) later becomes the strongest
   `acr` signal for step-up.

---

## Appendix — quick reference

**Endpoints** (all under `https://lobby.getdasha.com`):
`/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`,
`/.well-known/jwks.json`, `/oauth/register`, `/oauth/authorize`,
`/oauth/token`, `/oauth/userinfo`, `/oauth/revoke`;
on `https://www.getdasha.com`: `/.well-known/oauth-protected-resource`.

**Scopes:** `openid`, `profile`, `email`, `compute:read` (lane A, P2);
`compute:spend` (lane B allowlist, P3); `compute:keys` (P4, [JOHN]).

**Lifetimes:** code 10 min single-use · access JWT 1 h · refresh opaque
30 d rotating w/ reuse detection · ID token 5 min · remembered consent
12 months idle expiry.

**Hard requirements:** PKCE S256 always; exact redirect match; https-only
(+ 127.0.0.1 loopback exception); authorization-code flow only; ES256
JWTs with rotating `kid`s; audience-bound access tokens.
