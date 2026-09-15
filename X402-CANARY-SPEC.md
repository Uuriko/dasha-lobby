# Dasha Compute x402 canary specification

Status: design + inert prototype only. No live payment, facilitator call, funds, or public payment claim.

## Owner decisions still required

- Treasury `payTo` wallet.
- Per-call USDC price in atomic units.
- Any $DASHA discount or burn design.
- Any funded daily paid canary.

A facilitator choice and its fee-payer identity must also be validated before enablement. The prototype refuses to quote until all values exist and the route equals the one allow-listed canary route.

## Canary boundary

Use a new, explicit endpoint: `POST /compute/api/x402/v1/chat/completions`. Do not overload the prepaid `POST /compute/api/v1/chat/completions`: existing 402 responses there mean exhausted credits or a key spend cap, so sharing the path creates ambiguous client behavior and dual-charge risk.

Only one model route is admitted at launch. Choose it from observed availability, not a permanent model name in code. The launch gate is: healthy route now, no chain-of-thought leak, idempotency support, fail-loud JSON, and an owner-approved fixed price.

Sequence:

1. Unpaid request receives HTTP 402 plus `PAYMENT-REQUIRED`, with x402 v2, Solana mainnet CAIP-2, exact scheme, USDC mint, exact amount, treasury `payTo`, facilitator `feePayer`, and a unique memo.
2. Client creates and partially signs the constrained Solana transaction, then retries with `PAYMENT-SIGNATURE`.
3. Gateway validates the payload shape and exact echo of scheme/network/asset/amount/payTo/resource. It calls facilitator `/verify`, acquires a replay lock on the transaction payload, calls `/settle`, and requires a successful settlement response with a Solana transaction signature.
4. Only after settlement succeeds does Dasha accept the inference job. The request's `Idempotency-Key` maps retries to the same payment, job, and result.
5. Dasha settles its normal signed OCM receipt. A separately signed companion `dasha.x402-receipt-binding.v0` binds that receipt hash to the x402 transaction, network, payer, amount and asset. Existing `dasha.receipt.v0` stays byte-compatible, so the public chain and old verifiers do not break.
6. Response includes the normal completion and receipt plus `PAYMENT-RESPONSE` and the companion binding. Verification by receipt hash exposes both signatures and the on-chain transaction reference.

## Why a companion receipt

The current canonical OCM body is exactly `{job_id, engine, tokens, cents, at, prev_hash}`. Adding a settlement field directly would change every receipt hash and verifier. The companion binding signs the payment-to-receipt relationship without rewriting the existing chain. A later receipt schema version can fold it in after migration tooling exists.

## Threat model

| Threat | Failure | Control / gate |
| --- | --- | --- |
| Duplicate settlement race | One Solana payment unlocks several jobs | Durable replay state keyed by hash of serialized transaction; states `verifying -> settling -> settled -> job_id`; reject reuse across resource/body; retain beyond the 120s hot lock for audit. The x402 SVM spec calls out the race even though Solana deduplicates the transfer. |
| Settlement says success but payment is wrong | Free inference or payment diversion | Match response to the original requirements, require success + tx signature, then independently confirm transfer mint/amount/destination before marking paid. Treat facilitator as operationally trusted, not cryptographic truth. |
| Malicious SVM instructions drain/sponsor funds | Facilitator fee payer or seller exposed | Use a facilitator that enforces the protocol's strict 3-6 instruction order, TransferChecked, exact destination ATA, exact amount, fee-payer exclusion from instruction accounts/source/authority, bounded compute price, memo rules and account-existence rules. Pin `/supported` output. |
| Replay on a changed prompt/model | Old payment buys a different resource | Bind a challenge id/body hash/model class in server state and unique memo; reject `accepted` or resource drift. Keep `Idempotency-Key` separate from payment transaction identity. |
| Dual billing | Bearer credits and x402 both charge | Dedicated endpoint rejects `Authorization`; no calls to credit debit or key-spend code. |
| Pay first, inference fails | Buyer pays for no usable result | Canary only on healthy stable route; failover before first token where safe; define signed failed-job/refund policy before live launch. Initial contract must not promise automatic refund unless implemented. |
| Inference first, settle later | Service is given away | Settle before job admission. Never use verify-only as payment. |
| Facilitator outage or compromise | Payment path unavailable or false settlement | Circuit breaker; no fallback to unpaid inference; allowlisted facilitator origin; timeout; response schema checks; independent chain confirmation; operator alert. |
| Quote substitution/cache poisoning | Client pays stale/wrong wallet or price | `Cache-Control: no-store` on 402; canonical resource URL; short timeout; exact accepted-object match; published offer carries status and owner-config requirement. |
| Directory probes trigger spend/load | Crawlers buy or run expensive inference | Health/readiness route stays free; manifests describe only the single canary; accept unpaid 402 probes cheaply; rate-limit by origin; directory submissions only after live challenge exists. |
| Privacy leakage | Prompt or payer metadata leaks into chain/receipts | Memo contains opaque challenge id only, never prompt/user text. Public binding may expose payer already visible on-chain; document this and allow a privacy review before launch. |
| Receipt forgery/misbinding | Valid OCM receipt is paired with another transaction | Companion object signs receipt hash + settlement transaction + amount/asset/network/payer; verify both Dasha signature and on-chain transfer. |
| Price/body mismatch | Fixed payment buys unbounded work | Canary caps request bytes, max tokens, model class and timeout. Reject unsupported streaming/tool-call shapes initially. |
| Model output abuse | Paid route bypasses content/resource limits | Same inference controls and no-think safeguards as the stable prepaid route; payment does not widen model permissions. |

## Machine discovery

Serve an honest `GET /.well-known/x402` or dedicated offer URL from the Worker only after routing can support it. Until then, the checked-in `dasha-compute-x402-offer.json` says `enabled:false` and carries null price/payTo.

Proposed live offer fields:

- Identity and homepage.
- `payment.x402`: version 2, USDC, Solana CAIP-2, `payTo`, fixed atomic amount, and non-custodial statement.
- One tool: method, canonical route, description, request schema/OpenAPI link, response MIME, fixed-price terms and availability.
- Machine links: OpenAPI, `/compute/llms.txt`, pricing, readyz, network, proof, keys and receipt verifier.
- Data handling: opaque memo; payer and transaction retained for reconciliation; prompt never placed on-chain.
- Reliability: measured uptime/latency links, not self-reported snapshots.

Add to `/compute/llms.txt` only when live:

```text
x402 canary: POST https://www.getdasha.com/compute/api/x402/v1/chat/completions
payment: x402 v2 exact, Solana mainnet USDC; call without PAYMENT-SIGNATURE for the current quote
limits: one allow-listed model route; no Bearer auth; settle before inference
receipt: normal signed OCM receipt plus dasha.x402-receipt-binding.v0; verify at /compute/api/verify?hash={receipt_hash}
offer: https://www.getdasha.com/.well-known/x402
```

Do not mention a price, wallet, paid availability or daily paid proof until those are real.

## Directory plan

1. Preflight with a stock x402 Solana client and unpaid curl: 402 shape, canonical resource, USDC only, no-store, correct fee payer, then a funded test only after owner approval.
2. `x402-list`: use its web submission flow after the endpoint is payment-ready. It continuously records payment readiness and offers a higher verified tier only after a paid delivery probe. Provide origin, one route, OpenAPI, docs, USDC/Solana and the proof URL.
3. `agent402`: serve `/.well-known/x402`, then `POST https://agent402.tools/api/index/register` with `{"origin":"https://www.getdasha.com"}`. Its crawler reads the manifest/OpenAPI and probes hourly without paying. Run its external x402 audit first.
4. `402radar`: submit name, website, OpenAPI URL, docs link, one sample x402 endpoint, category `LLM Inference`, chains/pricing notes, and contact. It says one endpoint is enough and discovers the rest from OpenAPI/docs.
5. Save submission timestamps and listing URLs; check machine APIs for the exact row and reported network/price/payTo. Correct drift before publicity.

## Daily paid canary

Owner-gated because it spends USDC. When approved, use a dedicated low-balance buyer wallet and a daily budget cap. The canary should:

1. Fetch the current 402 for a tiny deterministic prompt on the single route.
2. Assert version/scheme/network/USDC/price/payTo/fee payer against pinned owner-approved values.
3. Sign and settle once with a fresh idempotency key.
4. Assert one charge, one job, usable response, `PAYMENT-RESPONSE`, signed OCM receipt, companion binding, independent on-chain transfer match, and `/verify` ANCHORED verdict.
5. Write no prompt or secret to public logs. Publish only timestamp, route class, latency, transaction, receipt hash and checks passed.
6. Page on failure; never retry a paid step automatically. A later retry must first prove the transaction did not settle.

Keep a free hourly canary for challenge shape/readiness. Daily paid proof complements it; it does not replace service health monitoring.

## Rollout gates

- Phase 0 (this patch): inert builders, fail-closed config, null-valued offer fixture, receipt-binding schema, tests and this spec.
- Phase 1: owner selects wallet and price; team selects/validates facilitator; security tests against malformed transactions and replay concurrency.
- Phase 2: staging/devnet or isolated mainnet canary with explicit tiny approved budget; no directory submissions.
- Phase 3: one production route, low rate limit, circuit breaker and daily spend cap; observe.
- Phase 4: submit directories; expand only after payment, inference and receipt evidence remain clean.
