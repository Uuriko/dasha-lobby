# Passkey enrollment design — Dasha Lobby

**Status:** design only (no code, no deploy). Depends on John's go-ahead for
passkey production enablement (task #6) and the security-posture sign-off
(task #23) before any credential record is written in production.
Grounded in the current login/session code (dasha-lobby-worker.mjs,
dasha-lobby-x.mjs session tokens, dasha-lobby-google.mjs, dasha-lobby-github.mjs)
and PR #278 (config-gated login buttons).

## 0. Where passkeys fit in the current system

The lobby serves five login methods today: X OAuth, Google OAuth, email OTP
(Resend), Solana wallet challenge-response, and Grok Bot device-code pairing.
PR #278 makes `/login` server-render only the methods that are actually
configured — unconfigured methods are **hidden, not disabled**.

Sessions are a stateless HMAC-signed cookie (`__Host-dasha_x`,
`signPayload(LOBBY_SESSION_SECRET, {...})`) with payload
`{v:1, provider: 'x'|'google'|'email'|'wallet'|'grok', ..., iat, exp}` and a
30-day absolute TTL (dasha-lobby-x.mjs). There are **no `auth_method` /
`auth_time` claims yet** — task #16 designs them; `provider` is the de-facto
method discriminator today. There is **no KV binding**; all mutable auth state
(email OTP pending codes, send caps, metrics) lives in the `DashaLobby`
Durable Object's SQLite storage (`this.state.storage`).

Design principle: passkeys arrive as a **sixth method** that is
registration-gated (only enrolled accounts see passkey UI), never a wall.
Everything below respects PR #278's rule: an unconfigured or unenrolled
method never renders a dead door.

## 1. WebAuthn registration ceremony

Registration is **post-auth only**: it requires a live session and must never
be reachable from the unauthenticated `/login` page.

### 1.1 Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/passkey/register/start` | session | Returns creation options: challenge + rp + user entity |
| `POST /auth/passkey/register/finish` | session | Verifies attestation response, stores credential, re-issues session |
| `GET /auth/passkey/status` | session | `{enrolled: n, lastUsed}` — drives the nudge; also tells `/login` whether to offer passkey sign-in |

### 1.2 Ceremony flow

1. Client calls `register/start`. Server asserts a valid session and that
   `LOBBY_SESSION_SECRET` is set (same 503 gate as the other methods), then
   mints a 32-byte random challenge, HMAC-signs it with the session secret
   (same `signPayload` pattern as the OAuth state tokens), stores
   `{challenge, exp: now+5min, singleUse: true}` in DO storage, and returns
   the creation options.
2. Client calls `navigator.credentials.create({publicKey})` with:
   - `rp: {name: "Dasha", id: "getdasha.com"}` — see §5.1 for the RP-ID choice.
   - `user: {id: accountAnchor, name: email-or-handle, displayName}`
     — account anchor is the task-#35 stable account id when it exists; until
     then, the normalized email (SHA-256, server-side; never the raw email in
     the credential record).
   - `pubKeyCredParams`: **ES256 (-7) and RS256 (-257) only.** Workers'
     `crypto.subtle` does not verify EdDSA/Ed25519, so requesting it would
     create credentials the server cannot verify. Restricting the alg list at
     registration keeps every issued credential verifiable in the Worker.
   - `authenticatorSelection: {userVerification: "preferred",
     residentKey: "preferred"}` — discoverable credentials enabled so
     conditional-UI sign-in works, but server-side `allowCredentials` remains
     the primary path (works for synced passkeys and roaming keys alike).
   - `attestation: "none"`, `excludeCredentials` = the account's existing
     credential IDs (prevents double-enrollment of the same key).
3. Client posts the attestation response to `register/finish`. Server:
   - verifies the signed challenge (single-use, deletes on consume);
   - parses the authenticator data, verifies `rpIdHash == SHA-256("getdasha.com")`,
     asserts origin ∈ `{https://lobby.getdasha.com, https://www.getdasha.com}`,
     asserts flags `userPresent`, and — since UV is "preferred" — does **not**
     fail when `userVerified` is false (UV fallback keeps roaming keys usable);
   - with `attestation: "none"`, verifies the `none` attestation statement is
     well-formed (per WebAuthn §attestation verification) and stores the
     credential public key + metadata (see §3).
   - **re-issues the session** with `auth_method: 'passkey'` /
     `auth_time: now` (task #16 claims) so the post-registration session
     reflects the strongest method used. Old token is invalidated server-side
     once the session registry (task #19) exists; until then the re-issue is
     the rotation mechanism (task #17 pattern).

Rate limiting: `simpRate` buckets `passkey-register-ip` and
`passkey-register-acct` mirroring the email-OTP pattern (12/hr per IP,
4/hr per account). Honest 429 copy, no enumeration.

### 1.3 Sign-in ceremony (conditional UI)

`POST /auth/passkey/auth/start` takes an email (or nothing, for conditional UI)
and returns a challenge with `allowCredentials` = the account's credential IDs
(or empty for discoverable-credential flow). Client uses
`mediation: "conditional"` so the browser autofills the passkey from the email
field. `POST /auth/passkey/auth/finish` verifies the assertion: signature over
clientDataHash‖authData with the stored COSE key, `signCount` handling (§3.3),
rpIdHash + origin checks, then issues a session with
`auth_method: 'passkey'`, `auth_time: now`, 30-day TTL — same shape as every
other method's token.

## 2. Soft post-auth enrollment nudge ("little noise")

John's bar is minimal noise, so the nudge is a whisper, not a wall.

### 2.1 When it appears

- Only **after a successful login via a different method** (email OTP, social,
  wallet, Grok Bot) — never on `/login`, never pre-auth, never mid-flow.
- Only on **WebAuthn-capable devices**: `window.PublicKeyCredential` exists
  AND (`isUserVerifyingPlatformAuthenticatorAvailable` or
  `isConditionalMediationAvailable` resolves true). Capability is probed
  client-side; the server never fingerprints (standing no-fingerprint rule).
- Only once per session, and never if the current session already used a
  passkey (`auth_method === 'passkey'` ⇒ suppress).
- Only if `/auth/passkey/status` says the account has **zero** enrolled
  credentials.
- Only if the passkey backend is enabled (PR #278-style availability flag —
  the nudge copy must never advertise a method that can't complete).

### 2.2 Dismissability + frequency caps

- Rendered as a **single dismissible card** on the post-login landing page
  (and later on `/account` as a quiet "Security" row), one line of copy:
  *"Sign in with a touch next time — add a passkey."* with
  `[Add passkey] [Not now]`. A "Don't ask again" affordance is the third,
  tertiary action. Non-blocking; the page works fully underneath.
- Dismissal state is persisted **device-locally** in
  `localStorage` (`dasha_passkey_nudge_v1`: `{impressions, dismissedAt,
  neverAsk}`), matching the established pattern ("dismissal persisted
  device-locally", task #4). No server-side per-device tracking — that would
  be fingerprint-adjacent.
- Caps (all client-side, device-local):
  - max **1 impression per 7 days**;
  - max **3 lifetime impressions** per device;
  - **never again** after the user picks "Don't ask again";
  - **stops permanently** once `status.enrolled > 0` (the server stops the
    nudge the moment enrollment succeeds — the local state becomes moot).
- The card never re-appears because of a code path: if enrollment succeeded,
  the credential count on `/auth/passkey/status` gates it server-side too.

### 2.3 What it never does

No full-screen modal, no blocking interstitial, no email nag, no banner on
every page. The nudge appears at most once per login, respects all caps, and
dies the moment a passkey exists.

## 3. Credential storage model

Storage location: **DashaLobby DO SQLite storage**, namespaced
`passkeyCreds:<accountAnchor>` (the same DO that holds `emailLogins` today —
no new infrastructure, no KV). Keyed records, max ~10 credentials per
account.

### 3.1 Stored per credential

| Field | What | Why |
|---|---|---|
| `credentialId` | base64url, 64–1024 bytes | primary key; sent back as `allowCredentials` |
| `publicKey` | COSE-encoded public key bytes | signature verification |
| `alg` | -7 (ES256) or -257 (RS256) | algorithm pinned at registration |
| `signCount` | uint32 | clone detection (§3.3) |
| `aaguid` | 16 bytes, optional | authenticator model metadata (display only) |
| `transports` | `["internal"\|"hybrid"\|"usb"...]` | UX hints ("this Mac", "security key") |
| `label` | user-editable string, ≤48 chars | "MacBook Pro" — user-named, per the no-fingerprint rule |
| `createdAt` / `lastUsedAt` | ms timestamps | rotation hygiene, GDPR export |

### 3.2 Never stored

- **Private keys** — they never leave the authenticator; the server only ever
  sees public key material.
- **Biometrics, PINs, or biometric templates** — user verification happens
  entirely inside the authenticator; the server learns only the boolean
  `userVerified` flag.
- **Raw challenge values after use** — single-use, deleted on consume.
- **Raw emails in the credential record** — the user-entity id is a SHA-256
  of the normalized account anchor; the human-readable `name` field in
  creation options is only used in the browser ceremony, not persisted.
- **Passkey-derived session tokens** — sessions remain HMAC-signed tokens;
  credentials are authentication inputs, not session state.

### 3.3 Sign-count handling

- `signCount == 0` on first verification is accepted (some authenticators
  don't implement counters).
- Thereafter the stored counter must **strictly increase**; equal or
  decreasing counters are treated as credential cloning → the credential is
  flagged, the sign-in is rejected, and the account is told to re-enroll
  ("Your passkey may be duplicated — remove it and add a new one").
- This mirrors the standard WebAuthn clone-detection guidance and costs
  nothing to implement.

## 4. Attestation stance: `attestation: "none"`

**Recommendation: request `attestation: "none"` and do not verify
attestation chains.**

Justification:

1. **Threat model.** Passkeys here authenticate users to a consumer compute
   marketplace, not to high-value financial rails or regulated infrastructure.
   The registration ceremony is already gated behind an authenticated session
   (§1) — the authenticator's supply-chain provenance adds no meaningful
   security over that gate.
2. **Privacy.** `direct` attestation exposes the AAGUID (authenticator model)
   to the RP and, in enterprise/batch attestation, can narrow a user to a
   device cohort. `none` keeps enrollment anonymous by default, consistent
   with the lobby's no-fingerprint stance.
3. **Operational cost.** `direct`/`indirect` require maintaining a trust
   anchor store (FIDO MDS), handling attestation-format sprawl, and dealing
   with self-attestation edge cases. The lobby team is small; that cost buys
   nothing for this threat model.
4. **What we still verify.** Every registration still checks rpIdHash, origin,
   challenge freshness/single-use, user-presence flag, credential-ID length
   bounds, and COSE key well-formedness. The authenticator is untrusted
   hardware regardless of attestation; the signature verification on every
   sign-in is the real security, and it is unaffected by attestation choice.

Escape hatch: if risk analysis later demands supply-chain fencing (e.g.
provider-payout credentials), `indirect` can be adopted per-route without
changing the credential schema — the `aaguid` field is already stored.

## 5. Account recovery — a lost passkey never bricks the account

This is the hard requirement the design optimizes for.

### 5.1 The invariant

**A passkey is never the sole authentication method on an account.**
Enrollment requires an existing session, so every passkey-bearing account
provably has at least one other working method. Two guards enforce it:

1. **Unlink guard:** `/account` refuses to remove the last non-passkey
   method while passkeys exist, and refuses to remove the final passkey
   while no other method is linked — phrased as honest copy:
   *"Add another sign-in method first (email code works)."*
2. **Registration coupling:** the first passkey is enrolled from a session
   created by email OTP / OAuth / wallet / Grok Bot, so the recovery path
   below is always provisioned at enrollment time.

### 5.2 Lost-passkey flow

1. User signs in with **email OTP** — the universal fallback that requires
   only inbox control (existing `/auth/email/*` flow, 6-digit code, honest
   503 when the Resend rail is down).
2. On `/account` → Security, the lost credential is listed by its label and
   `lastUsedAt` ("MacBook Pro — last used 12 days ago"), with a
   **[Remove]** action.
3. Removing the lost credential is a single authenticated action; a new
   passkey can be enrolled in the same session via the §1 ceremony.
4. If the account has **zero** working methods (should be unreachable given
   the guards, but defense in depth): email OTP **is** the account — any
   account with an email on file can always bootstrap a session from the
   inbox, so "zero methods" resolves to "sign in with email."

### 5.3 Social/wallet-only accounts

Accounts created via X/Google/wallet/Grok Bot with no email on file recover
through their original method (the guard in §5.1 ensures at least one
remains). The enrollment nudge for these accounts additionally suggests
linking email OTP as the recovery method — one quiet line on `/account`,
not in the nudge card.

### 5.4 Why email OTP is the right fallback

It already exists, it is already rate-limited and hashed-at-rest
(`emailLoginCodeHash`), it proves control of the same inbox the account was
anchored to, and it is the one method that works on any device with no
hardware dependency. The recovery story is therefore: **passkeys are
convenience; email OTP is continuity.**

## 6. RP ID and origin

- **RP ID: `getdasha.com`.** The lobby serves both `lobby.getdasha.com` and
  `www.getdasha.com` (PR #278 renders `/login` on both), and task #39 moves
  toward cross-subdomain session sync. An RP ID of `getdasha.com` makes one
  enrollment valid on both hosts and on any future subdomain, with zero
  re-enrollment. (An RP ID of `lobby.getdasha.com` would strand www users.)
- **Allowed origins:** `https://lobby.getdasha.com`, `https://www.getdasha.com`
  only — asserted server-side on both ceremonies, alongside rpIdHash.
- **RP name:** `"Dasha"` — what the OS prompt shows the user.

## 7. Migration path: passkeys as the long-term primary

2025–2026 auth guidance (and the task brief) puts passkeys as the primary
with email OTP as fallback. The migration is deliberately gradual and gated:

| Phase | Change | Gate |
|---|---|---|
| **0 — enablement** | Passkey endpoints exist behind a config flag; credential writes disabled | John's explicit go-ahead (task #6) + security sign-off (#23) |
| **1 — soft nudge** | §2 nudge + registration ceremony; passkey sign-in works for enrolled accounts via a quiet link on `/login` | This design; PR #278 availability plumbing extended with a `passkeyEnabled(env)` flag |
| **2 — passkey-first UX** | Email-first progressive disclosure (task #2): entering an email reveals "Continue with passkey" as the top option when the account has enrolled credentials; conditional-UI autofill in the email field | Enrolled-credential lookup on `/login` (privacy-safe: only a yes/no per identifier, same enumeration posture as the email flow) |
| **3 — primary** | Passkey becomes the headline method ordering for enrolled users; `auth_method: 'passkey'` sessions preferred for step-up auth (task #18: payout-wallet changes, API-key creation prefer fresh passkey auth) | John's method-lineup decision (task #3) — the permanent ordering is his product call |
| **4 — ecosystem** | Passkey-linked accounts get one-tap cross-device handoff (task #25) and agent-facing "Sign in with Dasha" OAuth (task #48) can accept passkey-backed sessions | Launch approvals (#26, #49) |

What never changes: **email OTP stays as the universal fallback**, the
no-passwords principle (task #45) is untouched (passkeys *are* the
passwordless story), and no method is ever removed without John's call.

## 8. Telemetry, privacy, compliance

- **Metrics:** aggregate counters only, via the existing `bumpLobbyMetric`
  (`signin:start:passkey`, `signin:success:passkey`, `register:success:passkey`,
  `signin:fail:passkey:bad-signature`) — no per-user data, per task #40.
- **GDPR:** credential records are personal data. `/account/export` (task #36)
  includes credential *metadata* (label, createdAt, lastUsedAt, aaguid) but
  never the public key bytes; full account deletion (task #37) deletes all
  `passkeyCreds:*` rows. Retention schedule review (task #38) covers this
  design before ship.
- **Public health:** `/login/health` (task #40) gains a `passkey` field so
  status copy never advertises a disabled passkey backend.

## 9. Test plan (for the future build PR)

- Unit: challenge mint/verify (single-use, 5-min expiry), signCount
  progression/regression, excludeCredentials round-trip, origin/rpIdHash
  rejection cases, ES256 + RS256 fixture verification, EdDSA rejection at
  registration (alg not offered).
- Served: `/auth/passkey/status` gating (unauthenticated → 401; unenrolled →
  `enrolled: 0`); `/login` never renders passkey UI when the flag is off or
  the account is unenrolled (extends the #278 gating tests).
- Copy audit: unlink-guard messages, clone-detection message, lost-passkey
  recovery copy — one plain line + one recovery action each (task #44 style).

## 10. Open decisions for John (not in this design)

1. Passkey production enablement — task #6 (his explicit go-ahead).
2. Permanent method lineup / whether passkey becomes the headline — task #3.
3. Whether new-device alerts fire on passkey enrollment — task #24 (external
   send, needs his tap and a healthy Resend rail).
4. No-passwords principle confirmation — task #45.
