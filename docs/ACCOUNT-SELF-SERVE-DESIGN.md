# Account self-serve — design

Design for tasks 34–37 (+16–19 dependencies): one `/account` home with multi-method
linking, GDPR/CCPA export, and full account deletion. Docs only; no code.
Status of this repo's auth as of 2026-09-17 is summarized in §0 so the design
lands on real code, not on an imagined system.

Companion tasks this design depends on or feeds:
- #16 (`auth_method` + `auth_time` session claims), #17 (session rotation),
  #19 (server-side session registry + named devices), #20 (idle + absolute TTLs),
  #34 (/account page), #38 (legal/retention review — John's tap).

## 0. How accounts work today (grounding)

There is **no account object** in the system today. Each of the 5 login methods
produces an independent, stateless, HMAC-signed session in the `__Host-dasha_x`
cookie (`dasha-lobby-x.mjs`):

| Method | Session payload | Server rows |
|---|---|---|
| X OAuth | `{v:1, xId, handle, name, verifiedType, avatar, xCreatedAt?, iat, exp}` — note: **no `provider` field**; `authSessionFromRequest` treats `xId`-bearing payloads as X | DO `public`: `simpProfiles[xId]`, `simpReferrals`, `simpClaims`, `simpQuizAttempts`, chess rows keyed by xId, season snapshots |
| Google OAuth | `{v:1, provider:'google', googleSub, email, name, avatar, iat, exp}` | none |
| Email OTP | `{v:1, provider:'email', email, iat, exp}` | none persistent; ephemeral `emailLogins` (pending codeHash/nonce/exp/attempts), `emailLoginSends` (send-cap timestamps), `emailLoginLastError` (internal diag) |
| Wallet (SIWS) | `{v:1, wallet, iat, exp}` — `provider` inferred as `'wallet'` from the address field | none persistent; ephemeral `walletLogins` (pending challenge nonce/exp) |
| Grok Bot pairing | `{v:1, provider:'grok', displayName, iat, exp}` | none persistent; ephemeral `grokLogins` (pending pair codes) |

- 30-day absolute TTL, no idle timeout, no server-side session list, no
  `auth_time`/`auth_method` claims yet (#16/#19/#20 open).
- The only server store is the `LOBBY` Durable Object (`idFromName('public')`).
  There are **no KV bindings**.
- The privacy page (`PRIVACY_HTML`) is honest about today's shape: X access
  tokens are never stored; wallet login keeps the address only in the signed
  session; "Leave Board" deletion removes X-keyed Board rows and scrubs season
  snapshots; aggregate counts survive.
- There is no `/account` page and no concept of "one account, many methods."

Consequences for this design: the account graph is new construction, not a
migration. It must be introduced lazily and must never break the existing
stateless sessions.

## 1. Account model

New Durable-Object keys (all under the `public` DO, consistent with today):

- `acct:<uuid>` — the account record:
  `{ id, createdAt, lastLoginAt, methods: [ {type, extId, linkedAt, lastUsedAt, verified} ], displayName, avatar }`
- `methodidx:<type>:<extId>` → `acctId`. `<type>` ∈ `x | google | email | wallet | passkey | grok`.
  `extId` is the stable provider identifier already used in sessions
  (`xId`, `googleSub`, normalized email, base58 wallet, credential id, grok
  display-name hash).
- `sess:<sid>` — session registry row (#19): `{ acct, sid, authMethod, authTime,
  deviceName, ipHash?, createdAt, lastSeenAt, revokedAt? }`. The signed cookie
  gains `sid` + `acct` claims alongside the existing identity payload; the
  cookie stays the bearer token, the registry is the kill-switch and the
  /account device list.
- `stepup:<token>` — single-use step-up proof, 15-minute TTL (see §4).
- `acct:tomb:<acctId>` — deletion tombstone: `{ acctId, deletedAt }` only. No PII.

### Method strength tiers

- **Strong**: X, Google, email OTP, wallet, passkey. Each proves control of a
  real, provider-verified identity (X user id, Google sub, inbox, keypair,
  WebAuthn credential).
- **Weak**: Grok Bot pairing. It proves only that someone confirmed a code in
  Grok Bot; `displayName` is free text. Linkable, but never sufficient alone.

Rule: after any link/unlink, the account must hold ≥1 method **and** ≥1 strong
method. Legacy grok-only accounts (created before this ships) are grandfathered
— the "cannot unlink the last method" rule already keeps them whole — but they
may not drop to zero strong methods any other way, and the UI nudges them to
link a strong method.

### Resolution on login

On each successful login the worker does `methodidx` lookup and attaches the
session to the existing account, or creates a new account (new uuid + index
row) when the method id is unknown. Existing sessions without `acct` claims
keep working (stateless fallback); they are bound to an account on their next
login, never mid-session.

**Auto-merge (safe by construction):** a verified email is a verified email.
Google login with `email_verified=true` and an email-OTP login for the same
normalized address resolve to the same `acct` — both proved control of the
inbox. Everything else (X ↔ wallet, X ↔ Google, wallet ↔ email with different
addresses) links **only** via the explicit in-session link flow (§2). Never
auto-merge across method types without a shared verified identifier.

## 2. Multi-method linking

### Link flow

1. From `/account` (authenticated session required — no anonymous linking),
   user picks "Link a new method."
2. The chosen method runs its **normal** start/verify flow with `mode=link`:
   the verify endpoint, on success, links the new method id to the *current
   session's* account instead of minting a fresh session. The browser keeps its
   existing session (rotated — see below).
3. Step-up (#4) is required *before* the link flow starts: `auth_time` < 15 min
   on the current session, or complete the step-up challenge first.

### Anti-takeover rules

- **Authenticated session required.** Link endpoints reject any request without
  a valid session on the target account. There is no "link by clicking an email
  link" path.
- **No cross-account theft.** If the method id being linked already exists in
  `methodidx` pointing at a *different* account, the link fails with a neutral
  error ("this X account is already linked to another Dasha account") and both
  accounts' audit trails get an entry. The only remedy is unlinking from the
  other account first, with step-up there.
- **One slot per type.** An account holds at most one X, one Google, one email,
  one wallet, one passkey, one grok. Linking a second method of the same type
  replaces the old one only after the new one verifies *and* a step-up on the
  old method succeeds (prevents an attacker with one session from swapping the
  recovery email out from under the owner).
- **Notification.** Every link triggers a "method added" notice surfaced on
  /account and in the audit trail; email/push notices are deferred to the
  new-device-alert decision (task #24, needs John's tap + a healthy Resend rail).
- **No secrets stored.** Linking stores only the stable provider identifier +
  public profile (handle/avatar/name). X/Google access tokens are never stored
  (consistent with the privacy page today), so link = one DO index row, and
  unlink has no remote revocation to forget.

### Unlink flow

1. `/account` → method row → "Unlink" → step-up (§4, `auth_time` < 15 min).
2. Rules enforced server-side, in this order:
   - **Cannot unlink the last method.** The button is disabled and the endpoint
     returns 409. The only exit from a one-method account is full deletion (§6).
   - **Strong-method floor.** The remaining set must contain ≥1 strong method.
   - **Session continuity.** If the unlinked method is the one the current
     session authenticated with, the session is re-issued onto a remaining
     method's identity immediately (rotation, #17) — the user is never left
     holding a token whose identity just vanished.
3. Effects: delete the `methodidx` row, remove from `acct.methods`, revoke any
   sessions whose `authMethod` was the unlinked one, rotate the surviving
   session, write the audit entry.

### Post-unlink safeguards

- **72-hour deletion freeze.** An account that unlinked any method in the last
  72 hours cannot start deletion. This blunts both rage-quits and
  attacker "unlink everything then delete" account wipes. The copy says why.
- The freeze window, like all durations, is subject to John's security-posture
  sign-off (task #23).

## 3. GDPR / CCPA export ("Download my data")

- Route: `POST /account/export` (step-up **not** required — read-only, but
  rate-limited to 1/hour/account). Returns a signed, single-use download URL;
  `GET /account/export/dl?t=<hmac>` serves the bundle. URL expires in 24h;
  each download is logged to the audit trail.
- Format: one JSON document, schema `dasha.export.v1`, plus a SHA-256 manifest
  inside the bundle. JSON is the machine-readable artifact GDPR/CCPA require;
  the /account page also offers the same content rendered as human-readable
  HTML for the "intelligible form" bar.

### Bundle contents

1. `account`: `{ id, createdAt, lastLoginAt }` — no internal keys.
2. `profile`: display name, avatar URL, per-method public handles the user
   chose to show.
3. `methods[]`: `{ type, identifier, linkedAt, lastUsedAt }`. Identifier is the
   **full** value (email address, X id + handle, wallet address, Google sub):
   it is the user's own data and redacting it from their own export would be
   absurd. CCPA "specific pieces" satisfied.
4. `sessions[]`: device names, auth method, created/last-seen timestamps —
   never IP addresses in full (hashed at rest, excluded from export).
5. `board` (if any): Simp Board profile row, quiz attempts + scores, badges,
   claims with state, referral rows where the user is inviter or invited
   (counterparty handles included — they are the user's own relationship data),
   chess rating + game/tournament ids + replay move lists, holder-proof
   timestamps (not the checked balances — those were never retained).
6. `compute` (if any): credit balance, top-up orders, ledger/spend rows, job
   metadata refs (job ids, model, route, status, usage — prompts only if the
   user never deleted them; already-deleted prompts stay deleted), API keys
   as `{ prefix, createdAt, lastUsedAt, label }` — **never the full key**
   (it was shown once at mint and is not kept), provider earnings rows.
7. `audit[]`: the account's own security trail — logins, link/unlink events,
   step-ups, exports, key operations — 1-year retention (§6).
8. `meta`: `{ schema: 'dasha.export.v1', exportedAt, sha256 }`.

CCPA extras: a `notices` section stating what is **not** collected (passwords —
there are none; seed phrases; DMs; payment cards) and that Dasha does not sell
or share personal information. Deletion of pending/ephemeral records
(`emailLogins`, `walletLogins`, `grokLogins`) is pointless — they expire in
minutes and are excluded by design; the export says so.

## 4. Step-up re-authentication

Sensitive actions — **unlink a method, create/rotate an API key, set/change the
payout wallet, start account deletion, reveal an API key secret at mint** —
require *fresh* authentication:

- The session must carry `auth_time` (#16). Fresh = `auth_time` within
  **15 minutes**.
- If stale, the API returns `449`-style `step_up_required` (exact code TBD in
  build; never a stack trace — quiet-failure copy, task #44) with
  `{ methods: [...] }` listing which re-auth paths are available for *this
  session's* account methods.
- Re-auth reuses the existing verify endpoints with `stepup=1`:
  - email → a fresh 6-digit OTP (respects the 5-attempt lockout and send caps);
  - wallet → a fresh SIWS challenge + signature (nonce, 5-min expiry);
  - X / Google → OAuth re-authorization (`prompt=select_account`, and
    `max_age=900` where the provider supports it);
  - grok → a fresh pairing code confirmed in Grok Bot;
  - passkey (future, task #5) → WebAuthn assertion.
- On success the worker mints `stepup:<token>` (random, single-use, 15-min TTL,
  bound to `acct` + action class) and rotates the session with a refreshed
  `auth_time`. The destructive endpoint consumes the step-up token.
- The step-up challenge itself is rate-limited per account (5 attempts, then
  lockout with the same honest 429 copy as OTP lockout, task #21).
- Audit: every step-up success *and* failure is logged to `audit:<acct>`.

No step-up bypass exists. There is no "remember this device for 30 days" for
destructive actions — the 15-minute window is the product decision; changing
it is John's call (task #23).

## 5. Full account deletion

Entry: /account danger zone → "Delete my account" →
**type DELETE to confirm** → step-up (§4) → final summary screen
("this is what goes away, this is what stays") → one more explicit confirm.
Deletion is **immediate and irreversible** — no grace period, no recovery
queue. The confirm copy says this in plain words. (A grace period would mean
retaining everything for 30 days; that is the opposite of deletion.)

Preconditions (checked in order, honest errors):
1. Step-up fresh (< 15 min).
2. No unlink in the last 72 hours (§2).
3. Compute balance must be zero or withdrawn first — deletion does not forfeit
   silently; if credits > 0, the flow stops and says exactly how to spend or
   withdraw them. Provider earnings unsettled → same stop.
4. No API keys with recent spend activity unacknowledged: the confirm screen
   lists every key being revoked.

### Cascade order (delete in this order; each step is idempotent so a retry or
a partial failure never leaves a half-deleted account)

1. **Lock the account.** Write `acct:tomb:<acctId>` and set the account record
   status to `deleting`. From this point any session presenting the account's
   `acct` claim fails closed.
2. **Revoke sessions.** Delete all `sess:<sid>` rows for the account; clear the
   browser cookie. (Stateless legacy tokens without registry rows die by the
   tombstone check at step 1.)
3. **Revoke API keys.** Delete key-hash rows. The audit trail keeps only
   "N keys revoked at <ts>" — hashes are gone.
4. **Unlink providers.** Delete all `methodidx` rows for the account. Nothing
   to revoke remotely: access tokens were never stored.
5. **Delete identity rows.** `simpProfiles[xId]`, `simpQuizAttempts`,
   `simpClaims`, `simpReferrals` (both as inviter and invited),
   `simpHolder:<xId>` rows, chess identity + games + tournaments involving the
   user, and the user's rows scrubbed from retained season snapshots
   (same scrub used by Leave Board today).
6. **Delete Compute rows.** Job + Night-task rows (prompts included), API key
   rows, credit/top-up rows. Financial ledger rows: see retention below.
7. **Delete the account record.** Remove `acct:<uuid>`. The tombstone from
   step 1 remains (30 days, PII-free) so the same method id cannot
   resurrect the account into a confusing half-state.
8. **Final export.** Before step 1, the flow offers one last data export (§3);
   after deletion there is nothing left to export.

### What is deleted vs retained

| Data | Fate |
|---|---|
| Account record, method links, session registry | Deleted |
| Board profile, quiz, claims, referrals, chess identity/games, holder rows, season-snapshot rows | Deleted (same scrub as Leave Board) |
| Compute jobs, Night-task prompts, API key hashes, credit balances, top-up orders | Deleted |
| Pending OTP/wallet/grok records | N/A — expire in minutes; untouched |
| Financial ledger / spend rows | **Retained 90 days, anonymized** (account id replaced with a one-way hash), then purged. Rationale: chargeback/tax/audit trail. Flagged for counsel in #38 — if counsel says delete-on-request, this row changes to immediate. |
| Abuse/fraud signals: `emailLoginSends` caps, rate-limiter buckets, login-failure counters, `emailLoginLastError` | **Retained 90 days**, keyed by hashed email/IP only, never re-linkable to an account. Legal basis: legitimate interest in abuse prevention (GDPR Art. 6(1)(f)). Documented on /privacy. |
| Aggregate funnel metrics (counts only) | Retained — never per-user. |
| Audit trail (`audit:<acct>`) | Retained **1 year** post-deletion, then purged. Needed to answer "what happened to my account" disputes. Included in the pre-deletion export. |
| Deletion tombstone | 30 days, PII-free (`{acctId, deletedAt}`), then purged. |

CCPA/GDPR note: the retained categories above are disclosed on /privacy with
basis + window before this ships, and task #38 (legal review) must sign off on
the 90-day ledger and 1-year audit windows before deletion goes live.

## 6. /account page (task #34 — surface this design needs)

The logged-in home: profile (handle/avatar per method), linked methods with
link/unlink, named devices/sessions with per-session revoke, API keys
(create/rotate/revoke, spend caps), danger zone (export, delete). Every
destructive control on it routes through §4. The page never renders a login
method button for an unconfigured provider (task #1 rule, extended here).

## 7. Build order

1. #16 claims (`auth_method`, `auth_time`) + #17 rotation + #19 registry —
   the substrate everything here stands on.
2. Account record + `methodidx` + lazy binding on login (read-only at first:
   write the rows, don't surface them).
3. Link flow (in-session, `mode=link`) with anti-takeover rules.
4. Step-up endpoints + `stepup:<token>`.
5. /account page (§6) with unlink + device revoke.
6. Export (§3).
7. Deletion (§5) — only after #38 legal review signs the retention schedule
   and #23 signs the security posture (TTLs, freeze window, lockouts).

## 8. Open questions for John

- #38: legal review of the 90-day anonymized ledger retention and 1-year audit
  retention before deletion ships.
- #23: sign-off on 15-min step-up window, 72-hour post-unlink deletion freeze,
  OTP attempt/lockout durations.
- #45 (no-passwords principle): confirm passkeys stay the only "new" method —
  the tier system assumes no passwords ever.
- Whether grok-pairing stays a linkable method at all, given its weak tier.

---
*Design doc for the dasha-lobby account self-serve track. Grounded in the
2026-09-17 tree: `dasha-lobby-x.mjs` (session creators, `authSessionFromRequest`),
`dasha-lobby-google.mjs` (Google session shape), `dasha-lobby-worker.mjs`
(`/auth/*` verify flows, `PRIVACY_HTML`, `handleSimp` DO storage keys).*
