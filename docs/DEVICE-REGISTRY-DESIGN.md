# Named-Device Registry — design

**Status:** design only, no code. Session-hardening theme; pairs with the login-train
work on `auth_method`/`auth_time` claims (TASKS.md #16) and session rotation (TASKS.md #17).
Related tasks: #18 (step-up auth), #19 (server-side registry), #20 (timeouts),
#25/#26 (QR cross-device handoff), #34 (/account page), #38 (legal review).

**Written:** 2026-09-18. **Author:** quill. **Merge:** do NOT merge — docs PR for review;
deploy lane (Grok Bot) only after John's security-posture sign-off (TASKS.md #23).

## 1. Where we are today

Sessions are a stateless HMAC-signed cookie (`__Host-dasha_x`, `dasha-lobby-x.mjs`):

```js
signPayload(env.LOBBY_SESSION_SECRET, {
  v: 1,
  provider: 'x' | 'google' | 'email' | 'wallet' | 'grok',
  /* provider identity fields */,
  iat: now,
  exp: now + 30 * 24 * 3600 * 1000, // 30 days, no idle timeout
});
```

There is **no server-side record** of any session. Consequences:

- No way to list "where am I signed in" — /account cannot show it (blocks #34).
- No revocation — a stolen cookie is valid for the full 30 days; "sign out everywhere"
  only clears the current browser's cookie.
- No device concept at all — step-up auth (#18) cannot distinguish "my MacBook" from
  "a browser I've never seen".
- `authSessionFromRequest` is pure verify-and-trust; nothing checks whether the token
  was invalidated after issuance.

The registry keeps the HMAC cookie as the bearer (no session-DB lookup is the fast
path today) but adds a **server-side registry of active sessions per account** that
is consulted on every authenticated request and makes revocation real.

## 2. Design decisions (the short version)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Keep the HMAC cookie; **add** a KV registry, don't replace the cookie with opaque tokens | Zero client churn, SameSite/HttpOnly posture unchanged, revocation becomes enforceable |
| D2 | Two new token claims: `sid` (random 128-bit session id) and `did` (stable device id per account) | `sid` is the revocation handle; `did` is the device handle. Pairs with #16's `auth_method`/`auth_time` claims |
| D3 | Devices are **user-named labels** + a server-held secret hash. **No fingerprinting** — no UA/IP harvesting for identity | Standing no-fingerprint rule (AGENTS.md, Compute referral tasks). A label is what the user calls the device, nothing more |
| D4 | Registry write on login, revocation check on every authenticated request | KV read per request (~single-digit ms); revocation must be synchronous to be meaningful |
| D5 | Enrollment prompt at login: "Name this device" — optional, defaults to `Device N` | Non-blocking (John's minimal-noise bar); user can rename later in /account |
| D6 | QR cross-device handoff reuses the existing Grok Bot pairing shape: QR + one-time code, 2-min expiry, **approve on the old device is mandatory** | WhatsApp-Web pattern, already socialized in TASKS.md #25; the approve step is what makes it phishing-resistant |
| D7 | Step-up auth is **device-aware**: trusted device + fresh `auth_time` → no friction; unknown/untrusted device → step-up required for payout-wallet / API-key / account-delete actions | Pairs with #18; unknown devices are where account-takeover damage happens |
| D8 | 30-day absolute cap stays; 7-day idle sliding refresh added; both surfaced on /privacy | TASKS.md #20; idle tracked via `last_seen` in the registry |
| D9 | Legacy (sid-less) cookies get one 30-day grace cycle, auto-enrolled as an unnamed device, then rejected | No flag-day logout for every user; migration is invisible |

## 3. Token shape (after #16 + this design)

```js
{
  v: 1,
  provider: 'x' | 'google' | 'email' | 'wallet' | 'grok', // existing
  /* existing provider identity fields, unchanged */
  auth_method: 'x' | 'google' | 'email' | 'wallet' | 'grok' | 'passkey', // #16
  auth_time: 1750000000000,                                            // #16, ms epoch
  sid: 'b64url(16 random bytes)',     // NEW — revocation handle
  did: 'b64url(16 random bytes)',     // NEW — device handle, stable per device+account
  iat: now,
  exp: now + SESSION_TTL_MS,          // 30d absolute cap, unchanged
}
```

`v` stays `1`: the new claims are additive and `authSessionFromRequest` ignores
unknown fields, so old code reads new cookies safely. (Bump to `v: 2` only if a
breaking claim is ever needed.)

## 4. Storage model (KV)

One new KV namespace, `LOBBY_SESSIONS` (or reuse the existing lobby KV with a
`dsess:` prefix — operator's call; separate namespace is cleaner for TTL/ops).

### 4.1 Session rows — `sess:{sid}`

```jsonc
{
  "acct": "acct_01J...",      // stable account id (TASKS.md #35 account graph)
  "did": "…",                // device handle
  "auth_method": "google",
  "auth_time": 1750000000000,
  "created": 1750000000000,
  "last_seen": 1750000100000,
  "idle_exp": 1750604800000, // last_seen + 7d, sliding
  "abs_exp": 1752592000000,  // created + 30d, fixed
  "revoked_at": null,        // set on revoke; row kept 30d for audit, then TTL'd
  "rotated_from": null       // previous sid, for #17 rotation chains / debugging
}
```

- Written at login (and at rotation, #17). `last_seen` updated on a sampled basis
  (e.g. at most once per 10 minutes per sid) to bound KV writes.
- **Check on every authenticated request:** row exists, `revoked_at == null`,
  `now < idle_exp`, `now < abs_exp`. Any failure → 401 + clear cookie.
  The HMAC verify stays first (cheap reject for forged tokens), registry second.

### 4.2 Device rows — `acct:{acct}:devices` (single JSON doc per account)

```jsonc
{
  "devices": {
    "{did}": {
      "label": "MacBook Pro",        // user-chosen, max 48 chars
      "enrolled_via": "google",      // auth_method at enrollment
      "enrolled_at": 1750000000000,
      "last_seen": 1750000100000,
      "trusted": true,               // set by explicit user action (see §7)
      "session_count": 2
    }
  }
}
```

- One doc per account keeps /account rendering to a single KV read.
- **No fingerprint material is stored, ever:** no user-agent, no IP, no screen/geo
  hints. `last_seen` is a timestamp, not a location. The no-fingerprint rule is a
  product principle, not just a referral-telemetry rule — the registry must not
  become a tracking surface by accident.
- Per-device secret (the "device-bound token"): the `sid` random is unguessable and
  server-revocable; the registry stores only the sid → device mapping. No additional
  client secret is needed — the HMAC-signed cookie already binds sid+did to the
  account. Revoking the device = `revoked_at` on all its session rows + removing the
  device entry.

### 4.3 Account id

TASKS.md #35 (multi-method identity linking) defines the stable `acct` id. The
registry is keyed off it, not off `xId`/email/wallet, so linking a second method
doesn't orphan devices. If #35 lands after this, the interim key is the primary
method identity with a documented re-key migration.

## 5. Enrollment flows

### 5.1 First login on a new device (the common case)

1. User completes any login method → server creates account (or resolves existing).
2. Server mints `did` (new random), `sid` (new random), writes both KV rows.
3. Response sets the session cookie **and** returns `device_enrollment: { did, suggested_label: "Device 2" }`.
4. Login page shows one quiet inline prompt: *"Name this device — e.g. MacBook Pro"*
   with the suggestion pre-filled and a **Skip** link. Submitting PATCHes the label;
   skipping keeps the default. Dismissal is per-device; the prompt never reappears
   for that `did`.
5. First device on an account is auto-`trusted: true` (it passed full auth). Later
   devices start `trusted: false` until the user marks them trusted in /account
   (one tap, "Trust this device") — or they become trusted implicitly after 30 days
   of uneventful use. (Implicit-trust window is a #23 sign-off item.)

No fingerprinting anywhere in this flow: the suggested label is just `Device N`
(count of existing devices + 1). Do not derive "Chrome on macOS" from the UA —
that is fingerprint-shaped data even if shown innocently.

### 5.2 QR cross-device handoff ("Sign in on this device")

Pairs with TASKS.md #25; the approve-on-old-device requirement is load-bearing.

1. On the **new** device, /account (or /login) → "Add this device" → server mints a
   handoff record `handoff:{code}` (6-char code + QR encoding a URL), TTL 120s, bound
   to nothing yet.
2. New device shows QR + code + visible 2:00 countdown.
3. User scans with the **old** (signed-in) device → old device shows an explicit
   approve screen: *"Sign in 'Device 3' to your Dasha account?"* with
   Approve / Deny. **No approve, no session — the code alone is not enough.**
4. On approve, server mints `did`+`sid` for the new device, writes registry rows,
   marks the handoff consumed. New device polls, receives its session cookie, then
   runs the §5.1 naming prompt.
5. Deny or expiry → handoff record deleted; the new device shows "request denied /
   expired, try again". Denials are logged (aggregate count only) for abuse
   monitoring.

Threat note: the QR encodes a single-use, 2-minute, approve-gated grant — not a
session. Screenshots of the QR are useless without the old device's approval tap.

### 5.3 Passkey enrollment (forward-compat)

TASKS.md #5/#6 (passkey registration) stores credential IDs in KV per account.
When it lands, a passkey registered on a device sets that device's
`has_passkey: true` flag, and passkey sign-in counts as a trusted-device signal.
No changes to this doc's storage shape beyond that one flag.

## 6. Revocation UX (/account → Devices)

Part of the #34 /account page. One section, minimal noise:

```
Devices
  ● MacBook Pro          Trusted · Last active 2h ago      [Revoke]
  ● iPhone               Last active 3d ago   [Trust]      [Revoke]
  ○ Device 3             Last active 31d ago (expired)     [Remove]
  [ Sign out all other devices ]
```

- **Revoke** (per device): sets `revoked_at` on all its session rows immediately;
  removes the device entry. The revoked browser's next request 401s and its cookie
  is cleared. Copy: *"Signed out everywhere on MacBook Pro."*
- **Sign out all other devices**: revokes every session except the current `sid`.
  This is the "I lost my phone" button — one tap, prominent.
- **Trust**: one tap; enables the low-friction path in §7.
- Expired devices (all sessions past absolute expiry) show dimmed with Remove
  (purely cosmetic cleanup).
- Renaming: inline edit on the label, 48 chars.

Every revocation writes an audit entry (account-scoped, in the session row's
`revoked_at` + a small `acct:{acct}:audit` ring buffer, 50 entries) so "why was I
signed out" is answerable.

## 7. Step-up auth on unknown devices (pairs with #18)

Sensitive actions: **payout-wallet set/change, API key create/rotate, account
delete** (the #18 list).

| Device state | auth_time fresh (<15m) | auth_time stale |
|---|---|---|
| Trusted device | allow | step-up required |
| Untrusted / unknown device | **step-up required** | step-up required |

Step-up = re-verify with any method on the account: email OTP re-send, wallet
re-sign, passkey assertion, or OAuth re-login — user's choice, presented as
*"Confirm it's you to continue."* On success, `auth_time` is refreshed (new `sid`
via rotation, #17) and the action proceeds.

Rationale: a stolen cookie on an attacker's machine is the realistic session-theft
shape. The cookie alone never authorizes money-movement or key-issuance from a
device the user hasn't trusted. Trusted devices keep the one-tap experience John
wants; everything else pays the 30-second step-up cost exactly where it matters.

New-device alert emails (TASKS.md #24) would complement this but are a separate
John-gated send; the registry's `enrolled_at`/`enrolled_via` fields are the data
source when he approves.

## 8. Session rotation (pairs with #17)

- On method link/unlink or privilege change: mint new `sid`, set old row's
  `revoked_at` + `rotated_from` chain, set the new cookie. Old token dies
  server-side immediately (closes the session-fixation gap in today's long-lived
  cookie).
- Idle sliding refresh (#20): when `now > idle_exp - 24h` and request is
  authenticated, extend `idle_exp`/`last_seen` and re-issue the cookie with the
  **same** `sid` (no rotation needed for a routine refresh; rotation is for
  privilege changes).
- Absolute 30d cap is never extended — at `abs_exp` the user re-authenticates
  fully, which re-runs device enrollment (§5.1) against the existing `did`.

## 9. Migration from today's stateless sessions

No flag-day logout. Three phases:

- **Phase 0 — write-only (deployable now):** login paths write `sess:` and device
  rows; reads ignore the registry. Validates KV shape, key cardinality, and write
  volume against production traffic with zero user impact.
- **Phase 1 — enforce for new sessions:** requests carrying `sid` get the registry
  check (§4.1); sid-less (legacy) cookies keep the old verify-only path. Revocation
  works for everything issued after cutover.
- **Phase 2 — legacy sunset (one TTL cycle later):** after 30 days, sid-less cookies
  are rejected with the standard "session expired, please sign in again" copy.
  Users re-authenticate once and land in the enrolled world via §5.1.

Edge cases: users with cookies issued pre-Phase-0 simply hit Phase 2's re-login —
the same thing that already happens every 30 days today. API keys and guest keys
are untouched (separate credential systems, out of scope).

## 10. What this deliberately does NOT do

- **No fingerprinting.** Restated because it matters: no UA parsing, no IP
  geolocation, no "Chrome on macOS, São Paulo" strings derived from request
  metadata. Device identity = user label + server random. (If John later approves
  new-device alert emails (#24), the *copy* for those is a separate decision.)
- **No passwords.** Unchanged principle (TASKS.md #45).
- **No cross-subdomain session sync** (#39) — cookie stays `__Host-` host-bound;
  the registry is per-account so it works whenever #39 lands.
- **No "Sign in with Dasha" third-party issuance** (#48/#49) — the registry is
  first-party only; third-party tokens get their own design.
- **No change to API-key or guest-key auth** — those are capability credentials,
  not sessions.

## 11. Open questions for John (TASKS.md #23 cluster)

1. Implicit-trust window: do untrusted devices auto-trust after 30 days of quiet
   use, or stay untrusted until the user taps Trust? (Security vs. friction.)
2. New-device alert emails (#24): on by default once the Resend rail is healthy?
3. Idle timeout length: 7 days proposed — confirm.
4. QR handoff launch approval (#26): the approve-gate answers the phishing concern,
   but it's still John's explicit call.
5. Legal/retention review (#38): device rows + audit buffer are new stored auth
   data — run past counsel with the #36/#37 export/delete work.

## 12. Build order (when approved)

1. KV namespace + `sess:`/`devices` writers on all five login paths (Phase 0).
2. Registry check in the auth middleware + 401/clear-cookie path (Phase 1).
3. /account Devices section: list, rename, trust, revoke, sign-out-others (#34).
4. Device naming prompt on the login page (§5.1).
5. QR handoff endpoints + approve screen (§5.2).
6. Step-up gate on payout-wallet / API-key / account-delete (§7).
7. Phase 2 legacy sunset (30d after Phase 1 deploy, Grok Bot's deploy lane).

Each step is independently shippable behind the Phase 0/1/2 gates; none of it
deploys without John's #23 sign-off and Grok Bot running the deploy train.
