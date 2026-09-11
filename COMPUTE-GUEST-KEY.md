# COMPUTE-GUEST-KEY — pairing / packet-claim (mint live)

**When:** 2026-09-11
**Agent:** Grok Bot
**Base:** main after guest-key door (#149)
**This repo:** mint + packet. Do **not** wrangler. Do **not** merge from the tip.

## Why this cut

Agents get a Bearer without a human OAuth wall. Chat stays keyed. Public probes stay public. Mint is live.

## What shipped

- `POST /compute/api/guest-keys` → **201** `{ api_key, expires_at, ttl_seconds: 86400, scopes: ["chat","models"], status, reason, hint, next }`
- Prefix `dgk_` (not developer `dsk_`). Hash at rest. Plaintext only in the mint response.
- Stored in existing `compute:api-key:` Durable Object rows (`kind: guest`)
- TTL 24h. `DELETE` with that Bearer revokes.
- Rate: **3/hour/IP** + **3/hour/pairing code**. Chat **3/10min** per key.
- Guest chat skips prepaid credits (mint + chat rate is the floor). Developer keys unchanged.
- Scopes: chat + models only. Embeddings / completions / responses → 403 `guest_key_scope`.
- `GET`/`HEAD` → **200** live contract (no `api_key`)
- Rejected mint → AX `{ status, reason, hint, next }`
- Packet + skill + agent.json include one curl

## Stay off

Room merge · Designer · Jupiter plugin host · Potter keys · version bump · wrangler · emails/phones · device fingerprinting
