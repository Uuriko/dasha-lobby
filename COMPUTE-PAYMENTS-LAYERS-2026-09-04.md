# Compute payments layers — one-pager — 2026-09-04

**Product:** [getdasha.com/compute](https://getdasha.com/compute)  
**Style:** primary-cite (from COMPUTE-RESEARCH-V4)  
**Fetched/ship:** 2026-09-04 ~6:41 PM PT  
**Not legal advice.**

---

## Layer map

| Layer | Role | Dasha v1 |
|---|---|---|
| **Humans** | Login + prepaid credits (USDC / `$dasha`) | **Live spine** — packs → Solana Pay → ledger |
| **Agents (optional later)** | Programmatic settle on API calls | Spike **x402 *or* MPP** — **not both in v1** |
| **AP2** | Authz / Intent·Cart **mandates** (payment-agnostic) | Later spend-cap UX; **≠ checkout** |
| **ACP** | Merchant Instant Checkout (Stripe×OpenAI) | **Out of scope** for inference micropay |

Primary: [AP2 announce](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol) · [MPP](https://stripe.com/blog/machine-payments-protocol) · [ACP Instant Checkout](https://stripe.com/gb/newsroom/news/stripe-openai-instant-checkout) · prior COMPUTE-RESEARCH-V4-METHOD-APPLIED-2026-09-04.md §2

---

## What is live today

| Piece | Value / behavior | Source |
|---|---|---|
| Credit packs | `$5` / `$20` / `$50` (`CREDIT_PACKS`) | `dasha-compute-credits.mjs` |
| Solana Pay dest | `3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN` | same (`CREDIT_DEST`) |
| USDC mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | same |
| `$dasha` mint | `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump` | same |
| Provider settle | Operator `COMPUTE_PAYOUT_SECRET` → pending list + **manual mark-paid**; auto-send **off** unless `COMPUTE_PAYOUT_KEYPAIR` | `dasha-compute-provider-earn.mjs` · PARK-compute-provider-payout-settle.md |

Humans: session login → buy pack → pay USDC/`$dasha` with Solana Pay reference → credits spend on Hosted Ask / API key chat (self-route free). Session UI Community Ask stays free. Key `limit_cents` is runaway-only (not a free allowance). Sponsor tip accepts a wallet-only guest (`anonymous:true`, `name:null`); Name-a-Mac still needs login. Providers: earn ledger → payout request → operator settle. Never invent auto treasury send.

---

## Explicit non-goals

1. **Stripe card top-up** — deferred (`dasha-compute-credits.mjs` header: Card/Stripe deferred).  
2. **Do not pitch ACP** as replacing prepaid credits — ACP is chat-merchant checkout, weak fit for inference API micropay (V4 §2).  
3. **Do not ship both x402 and MPP** in the first agent-settle experiment.

---

## OpenRouter apply note (usage)

v1 `POST /compute/api/v1/chat/completions` returns `usage` on non-stream JSON and on the SSE final `finish_reason:"stop"` chunk (`dasha-compute-network.mjs` `streamResponse`; non-stream complete). Non-self community/mixture chat requires and debits prepaid credits ($0.05/job, reason `api-chat`); self-route (own Mac) is free. Key `limit_cents` is runaway protection, not a free allowance. Page Hosted `POST /compute/api/chat` SSE also emits OpenAI-style `usage` on the final stop chunk (parity with v1; see `dasha-compute-hosted-chat-usage-sse.test.mjs`). Gateway docs: `GET /compute/api/v1` → `usage.chat_completions` + `usage.hosted_chat` + `usage.jobs`; `billing.chat_completions` = prepaid $0.05/job for community/mixture, self-route free, key cap runaway-only. Status `GET /compute/api` notes usage.
