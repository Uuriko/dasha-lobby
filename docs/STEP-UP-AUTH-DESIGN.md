# Step-up authentication for sensitive actions — design doc

Wave-10, dasha-lobby task 18 (session-hardening theme; builds on PR #289).
Docs only — no code, no deploys, no external sends. Do not merge without
John's #23 security-posture sign-off.

## 1. Problem

PR #289 (branch `quill-s2/session-hardening`) gave every session token
`auth_method`, `auth_time`, and a `sid` revocation handle, and rotates the
token on logins, method link/unlink, privilege changes, and destructive
actions. Rotation kills the old token — but a *stolen current token* is
still fully the user until the 30-day TTL expires. The money-adjacent
actions must therefore demand a *fresh* proof of identity that a stolen
cookie cannot produce. That is step-up auth.

## 2. What #289 gives us (explicit claims we reuse)

All defined in `dasha-lobby-x.mjs` (`sessionClaims`, `authSessionFromRequest`,
`reissueSessionToken`, `rotateSessionForRequest`, `revokeSessionSid` /
`isSessionSidRevoked` against the `lobby:revoked-sids` registry):

| Claim | Meaning | Step-up relevance |
|---|---|---|
| `auth_method` | `x` / `google` / `wallet` / `email` / `grok` / `github` — which method proved the identity | Picks which step-up methods are acceptable for this session |
| `auth_time` | Epoch ms of the authentication moment; **NOT refreshed on rotation** | The thing we compare against. Rotation never re-arms it, so a freshly-rotated stolen token does not buy fresh `auth_time`. |
| `sid` | Unique session id, the server-side revocation handle | The step-up grant is bound to one `sid` (replay containment) |
| `iat` / `exp` | 30-day TTL (`SESSION_TTL_MS`) | Upper bound on every grant |

Legacy (pre-claim) tokens backfill `auth_method`/`auth_time` from
`provider`/`iat` — step-up treats a backfilled `auth_time` the same as a
real one, so no migration cliff.

## 3. Which actions require step-up

An action needs step-up if hijacking it moves money, mints spend
credentials, or irreversibly destroys identity. Read-only and
recovery-friendly actions do not.

| Action | Endpoint(s) | Step-up | Rationale |
|---|---|---|---|
| Set / change payout wallet | `POST /compute/api/provider/payout-pref` | **Yes** | Redirects future earnings to attacker wallet — the #1 session-hijack payout |
| Request a payout | `POST /compute/api/provider/payout` | **Yes** | Initiates money movement |
| Create an API key | `POST /compute/api/keys` | **Yes** | Mints a spend credential the attacker can take off-device |
| Raise an API-key spend limit | key limit update path | **Yes** (on raise only) | Increases credential power; lowering needs no step-up |
| Change account email | future /account email-change (tasks 34/35) | **Yes, via a *different* linked method** | Email is itself an identity method — self-confirming through it is circular |
| Delete the account | `/simp/leave` + future whole-account deletion | **Yes** | Irreversible |
| Revoke / delete an API key | `DELETE /compute/api/keys/{id}` | **No** | A hijacker "revoking" is a nuisance; the real owner revoking a *stolen* key must never be blocked — recovery paths stay one click |
| Rotate / reissue | any session rotation | **No** | Rotation preserves `auth_time`; it never satisfies or extends a step-up grant |
| Read / list (earnings, keys, sessions) | GET paths | **No** | Read-only |

`#289` already rotates the session around key create/delete, payout-pref
change, and payout request. Step-up sits *before* that rotation: verify
fresh identity → then act → then rotate as today.

## 4. Acceptable step-up methods, per original `auth_method`

Rule: step-up must be a **fresh interactive proof from the same human**,
matched to the method that originally authenticated them. No new hardware,
no fingerprinting.

| Session `auth_method` | Acceptable step-up | Why |
|---|---|---|
| `wallet` | Wallet **re-sign** of a fresh challenge (SIWS one-click `signIn`, task 7) | Same keyholder, domain+nonce-bound, seconds of work |
| `email` | OTP **re-verify** — new 6-digit code, single-use, 5-attempt cap (task 21) | Proves current inbox access, not a remembered secret |
| `x` / `google` / `github` | Provider **re-auth flow** (e.g. Google `prompt=select_account`; X/GitHub re-consent) | The provider is the identity proof; a stale session can't mint it |
| `grok` | Re-approve in Grok Bot (same pairing approval pattern, task 12) | The pairing device is the proof |
| `passkey` (tasks 4/5, future) | WebAuthn assertion re-auth | Becomes the **universal step-up method**: once a passkey is enrolled on the account, any session — regardless of `auth_method` — may step up with it. One biometric touch, no per-method special-casing. |

Cross-method shortcut: if the account has ≥2 linked methods (task 35), the
user may step up with **any other linked method** — often the strongest and
the sleekiest option (wallet user signs with their X-linked… no: proves via
their passkey or OTP). The challenge UI offers only *linked* methods, never
the full lineup.

What is NOT acceptable: the session cookie alone (obviously), "I know my
email address", security questions, device fingerprinting (standing rule),
IP/UA checks (the same data #289 deliberately excludes from tokens).

## 5. Max age of step-up (the numbers — John's #23 call)

- **Step-up grant window: 10 minutes.** A successful step-up lets the user
  complete the gated action(s) for 10 minutes without re-prompting.
- **Fresh login counts as step-up:** if `auth_time` is < 10 minutes old, the
  gated action proceeds with no extra prompt — one authentication, not two.
- **Grant representation:** a new signed claim `step_up_at` (epoch ms) +
  `step_up_method`, written by re-issuing the token at the moment of
  successful step-up. Rotation preserves it for the rest of its 10-minute
  window; it can never extend beyond it.
- **Grant binding:** `step_up_at` lives in the token next to `sid`, so it
  is usable only by the session that performed the step-up. A hijacker
  holding a *sibling* (pre-step-up) token cannot ride the grant — and the
  post-step-up rotation (existing #289 behavior) revokes that sibling
  server-side anyway.
- **Per-action, not per-token:** the grant is checked at the gate of each
  §3 endpoint, comparing `step_up_at` (or `auth_time`) against the 10-minute
  window. No global "elevated session" state in KV.

Why 10 minutes and not 15 (the TASKS.md sketch): the payout request and
payout-pref change are single-shot actions; a short window keeps the
attacker window small while never punishing a normal human. The final
number is John's #23 sign-off.

## 6. UX flow (John's "sleek" bar: minimal noise, no dead ends)

1. User clicks the gated action in /account. Server sees stale `auth_time`
   and no valid `step_up_at` → responds `403 { error: 'step_up_required',
   step_up_methods: ['passkey','wallet'], expires: 300 }` instead of the
   action result. (Machine-readable so the page and API clients behave the
   same.)
2. The page swaps **only the action card** for a one-line inline prompt:
   "Confirm it's you to continue — [Sign with wallet]". No modal, no
   redirect, no page reload. Methods shown = §4 list for this account,
   passkey first when enrolled.
3. User completes the proof (one wallet signature / one OTP entry / one
   biometric touch). Server verifies, re-issues the token with
   `step_up_at`/`step_up_method`, and **completes the original action in
   the same response** — the user never has to click the action twice.
4. The challenge is single-use with a 5-minute expiry; OTP re-sends reuse
   the existing rate-limit + lockout rules (task 21).

Copy style follows the quiet-failure audit (task 44): one plain line, one
recovery action, no codes. On the page the prompt is quiet; in API clients
the 403 body is self-describing.

## 7. Threat model

| Threat | How step-up answers it |
|---|---|
| **Session hijack** (XSS cookie theft, shared machine, shoulder-surfed token) | The stolen token has a stale `auth_time` and no `step_up_at`. Payout-wallet changes, payout requests, and key creation refuse it. The attacker's window is limited to read/low-impact actions. |
| **Token theft *after* step-up** | The grant is bound to the `sid` that performed it; the post-action #289 rotation revokes that `sid` server-side, so a token captured later is dead on arrival. |
| **Rotation as a freshness trick** | Impossible by construction: #289's `reissueSessionToken` preserves `auth_time`, and step-up is the *only* event that writes `step_up_at`. A rotated stolen token stays stale. |
| **Step-up phishing** (fake "confirm it's you" page) | Wallet re-sign binds domain + nonce + short expiry per the SIWS spec; OTP codes are single-use and attempt-capped; passkey assertions are origin-bound by WebAuthn. A phished proof doesn't transfer to the real origin. |
| **OTP interception** (email compromise) | Email-method sessions stepping up via OTP inherit the method's own strength — acceptable because the attacker who owns the inbox already owns the account. Cross-method step-up (§4) is offered to de-risk exactly this case. |
| **Fully compromised device** (malware can sign) | Out of scope for step-up — documented honestly. Mitigated by new-device login alerts (#23/#24, needs Resend rail + John's tap) and the payout flow's existing pending/payout separation. |
| **Attacker *revoking* the owner's keys to cause chaos** | Key revocation intentionally needs no step-up (§3) — the owner's recovery path must stay frictionless. |

### On failure

- A failed step-up **never logs the user out** and never touches the
  pending action's data. The user lands back on the action card with one
  quiet line: "That didn't go through — try again."
- 3 failed attempts on the same challenge → the challenge is invalidated;
  the user gets one fresh challenge. Repeated failure past that falls back
  to the normal login flow (re-authenticate fully), which resets
  `auth_time` and satisfies step-up by the fresh-login rule (§5).
- Every failed step-up attempt is logged as an aggregate metric
  (method, outcome — no per-user data, same privacy rule as task 40).
  A spike in failures on one account is *not* auto-locked; lockout policy
  stays with the OTP rules (task 21) to avoid giving attackers a
  denial-of-service button.
- After a **successful** payout-wallet step-up, once the Resend rail is
  healthy and John taps #24, a "your payout wallet was changed" notice is
  sent to the account email — the last line of defense against a coerced
  or device-level compromise.

## 8. Build order (when John green-lights)

1. `step_up_at` / `step_up_method` claim support in `sessionClaims` +
   `reissueSessionToken` (preserved like `auth_time`); gate helper
   `requireStepUp(session, windowMs)` in `dasha-lobby-x.mjs`.
2. Wallet re-sign challenge endpoint (reuses task-7 SIWS verify path) and
   OTP re-verify endpoint (reuses task-21 buckets).
3. Gate the §3 endpoints; wire the 403 `step_up_required` contract.
4. Passkey step-up for free once tasks 4/5 land (assertion verify path is
   the same one sign-in uses).
5. Cross-method step-up rides on the task-35 account graph.

## 9. Open questions for John (#23 sign-off)

- Grant window: 10 minutes (recommended) vs 15.
- New-device login alerts (#24) — external sends, need tap; Resend rail
  must be healthy first.
- Whether payout-request should additionally require the *pending* state
  + a confirmation delay, independent of step-up.
