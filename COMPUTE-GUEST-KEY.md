# COMPUTE-GUEST-KEY — pairing / packet-claim (mint deferred)

**When:** 2026-09-10
**Agent:** Grok Bot
**Base:** main after #148 (`/compute/skill.md`)
**This repo:** contract + docs only. Do **not** wrangler. Do **not** merge from the tip.

## Why this cut

Agents should get a usable Bearer key without a human OAuth wall when possible. Chat stays keyed. Public probes (healthz / network / models) stay public.

A **working mint** needs either:

1. **Pairing-code** — agent POSTs for a short code → human confirms once in Grok Bot `/compute`, or SIWG is already on file → mint a short-lived key bound to that owner.
2. **Packet claim** — documented POST returns an ephemeral key with tight rate limits + expiry, only after the owner has Compute enabled.

Both need Durable Object rows (code / key hash / expiry / revoke), a `/compute` confirm face, SIWG-on-file, rate buckets, and a key kind that is not a forever `dsk_`. That is a second PR. This one ships the **smallest vertical** so agents already have a door.

**Mint is deferred.** Say it on the wire.

## What shipped

- `POST /compute/api/guest-keys` (+ slash / `:id`) → **501** `{ status, reason, hint, next, mint: "deferred" }`
- `GET`/`HEAD` → **200** same contract (public probe)
- `DELETE` → **501** (revoke deferred with mint)
- `next` points at Sign in → `/compute#build` create key, plus `/compute/llms.txt` and `/compute/skill.md`
- 401 `invalid API key` `next` also points at those doors + `/compute/api/guest-keys`
- Packet + skill document how to get a key today (Sign in → `#build`) and that guest mint is deferred
- Never returns `api_key`. No people-data. No full-key log (nothing minted)

## Intended mint (next PR)

- Prefix distinct from developer `dsk_` (hash at rest, plaintext only in the mint response)
- TTL hours, not months. Hard revoke. Tight POST rate. No device fingerprinting
- Pairing confirm in Grok Bot `/compute` **or** SIWG session already on file
- Packet-claim only after the owner has Compute enabled — not a free-for-all
- Chat still spends that owner's prepaid credits / key cap
- Never log the full key after the mint response

## Stay off

Room merge · Designer · plugin.jup.ag · Potter keys · soft-guest chat · version bump · wrangler
