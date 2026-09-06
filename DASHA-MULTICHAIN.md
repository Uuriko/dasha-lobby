# Dasha multichain: acquisition now, a backed Base representation next

Implementation prepared 6 September 2026.

The first release helps someone with funds outside Solana reach the canonical
Solana asset. A later token release can let people hold and use a backed
representation on Base. These are separate capabilities with separate evidence.

## Implemented in this branch

| Surface | Behavior |
| --- | --- |
| `/multichain` | Choose a starting network and SOL or USDC on Solana; receive explicit acquisition steps. |
| `/multichain?from=solana&via=usdc` | Go directly to the exact-mint Jupiter swap, without a bridge step. |
| `/.well-known/dasha-chains.json` | Versioned project registry with the canonical mint, pair, explorer, empty representation list, and actual acquisition capabilities. |
| How to Buy | One link into the new flow; the existing mint checker and Jupiter buy action remain. |
| `inspectBacking()` | Integer-only accounting for a future Solana escrow and Base supply, including decimal normalization and removal of double-counted escrow. |

All purchase actions use jup.ag. The form works without JavaScript. There is no
wallet connection, deposit address, quote request, signing, custody, provider
session, purchase analytics, or transaction-success state in this implementation.
Selecting a starting network describes the intended route; it does not establish
provider support for that network, asset, amount, or recipient.

The bridge link opens Jupiter's generic bridge screen. It does not prefill the
network or output. The page explicitly tells the user to make those choices there,
review availability and terms, and confirm funds in their own Solana wallet before
the separate swap. The final swap link pins the full canonical mint and the chosen
Solana sell asset. Unrecognized or repeated routing values produce a 400 with no
swap action. No source amount, wallet address, or destination override is accepted.

This implements the acquisition direction in
[Pocket issue 10](https://github.com/Uuriko/dasha-pocket/issues/10) and
[Dasha issue 74](https://github.com/Uuriko/dasha-desk/issues/74).

## Native Base representation

The proposed next token architecture is a Solana hub with a Base spoke. Hold
existing tokens in the Solana hub; issue the corresponding amount on Base; burn
on Base before releasing the Solana backing.

Wormhole NTT supports that model. Its Solana guide explicitly distinguishes the
locking mode, which does not require changing the existing mint authority, from
burn-and-mint, which requires authority transfer.
[NTT overview](https://wormhole.com/docs/products/token-transfers/native-token-transfers/overview/),
[Solana deployment guide](https://wormhole.com/docs/products/token-transfers/native-token-transfers/guides/deploy-to-solana/).

That makes locking the appropriate candidate for Dasha's existing mint. The
[current buy page](https://www.getdasha.com/how-to-buy) reports revoked mint and
freeze authorities; its token statistics are historical. Fresh finalized RPC
observations of mint ownership, decimals, supply, extensions and authorities are
required before choosing the production configuration. This branch does not claim
those on-chain observations were performed.

Use one Base representation first. Publish the exact contracts, escrow account,
programs, deployment revisions, decimals and administrative roles in the registry
only after a complete round trip has been independently checked. Keep the existing
Solana market and identity as the reference. Do not count bridge escrow as additional
circulating supply or treat a second chain as a second independent issuance.

For reconciled finalized observations, after normalization to a common precision:

    Base outstanding supply <= Solana escrow balance
    circulating supply = Solana total - Solana escrow + Base outstanding

The helper checks this arithmetic using BigInt, preserving even a one-unit
shortfall. A surplus still needs reconciliation against in-flight locks, burns,
releases and any unsolicited transfers. A balanced snapshot is not proof of a
correct bridge, canonical contracts, fresh observations or completed transfers.
Every report explicitly leaves chain verification and launch readiness false.

The deployment adapter still needs:

1. Exact reviewed NTT version and immutable build inputs.
2. Independently verified program/contract and escrow identities.
3. Token decimal/normalization behavior, including dust and round-trip limits.
4. Reviewed manager peers, mint/burn permissions, upgrade and pause roles.
5. Chain-specific transfer limits and an operator response for a backing deficit.
6. A devnet/testnet round trip with independent destination and return evidence.
7. A narrowly funded production round trip, followed by reconciliation.
8. Base liquidity and a public redemption path before promotion.

No bridge contract, token, pool, authority change, mainnet transaction or deployment
is created by this branch.

## Direct cross-chain acquisition

The public Jupiter handoff is usable as a guide without an embedded execution
system. Jupiter currently exposes a bridge screen that compares provider routes;
the actual quote belongs to the selected provider.
[Jupiter bridge](https://jup.ag/deposit/bridge).

NEAR Intents remains a candidate for direct output in the canonical mint. Its
listing model requires coordination with a solver and liquidity. This does not
establish Dasha eligibility, a listing, named wallet exposure or commercial terms.
[NEAR Intents token listing](https://intents.near.org/use-cases/token-listing).

The Relay canary proposed in
[issue 74's follow-up](https://github.com/Uuriko/dasha-desk/issues/74#issuecomment-5542410380)
needs one correction before implementation: strict addresses do not provide
automatic wrong-chain recovery, and unsupported wrong-token deposits can be
unrecoverable. Strict EXACT_OUTPUT underpayments refund; excess payments are
refunded after the quoted output is filled. Those are provider-documented
behaviors, not Dasha test results.
[Relay deposit addresses](https://docs.relay.link/features/deposit-addresses).

For that separate canary, pin an origin chain/asset, disposable Solana recipient,
explicit origin refund address and a Solana USDC target. Use `/quote/v2`,
`strict: true`, `useDepositAddress: true`, and `EXACT_OUTPUT`. Interpret amount
using the selected trade type and verify the returned output and decimals.
The earlier `/quote` documentation is deprecated.
[Relay quote v2](https://docs.relay.link/references/api/get-quote-v2).

Implement quote inspection, request tracking and independent RPC reconciliation
before surfacing any deposit address. Track exact amounts as integer strings.
Provider completion or a wallet callback alone must not become a Dasha receipt.
Keep sponsorship and direct-$DASHA output out of the first USDC canary. This branch
does not request a provider quote or prove a fill/refund.

## Pocket and community

Pocket can consume `dasha-chains/v1` without adopting the website's UI. Keep the
existing wallet-optional Today/Missions/Make/Tape/Me direction. A chain connection
is an optional capability; it does not change mission eligibility, contribution
receipts or community rank. USDC remains the unit for substantive paid work.

The immediate follow-on integrations are the shared registry consumer, public
mission/receipt deep links, and the accepted-contribution loop. Android MWA and
iOS wallet handoffs retain their own device-evidence requirements.

## Source and verification

Base commit: `f487eb5bf00d9af017b761c572e7637504691fcb`.
Base tree: `3620c6fa709af3ed1ab7381118fd459b684efe7e`.
The local base was reconstructed from the public main delta and matched that
tree and signed commit exactly. No Arcade draft changes are included.

The new behavior is confined to three modules, two test files, this handoff, an
isolated-branch claim record, and five changed Worker lines. Package files,
generated static source, deployment configuration and existing social-preview
assets are unchanged.

Validation:

- Node 24.19.0: 12 new tests pass.
- Four existing How to Buy suites also pass: route aliases, route copy,
  page-copy transformation, and existing social metadata.
- Tests exercise the actual Worker handler, GET/HEAD, status and MIME behavior,
  both routed hosts, invalid selections, query override resistance, no-JavaScript
  forms, canonical output, the rendered How to Buy link, and exact integer backing
  arithmetic.
- All new tests run offline. No wallet or provider is invoked.
- Browser, real-device, accessibility and real-money transfer tests have not been
  performed; no such pass is claimed.

## Release handoff

This is a review branch in the Cloudflare-first mirror. Grok Bot remains the live
ship-tree owner. Before release, claim the current live paths, apply the modules
and small Worker delta to the authoritative source, and check that the selected
Jupiter bridge URL still leads to the intended screen.

Run the route suite and the ordinary preview/canary, check the form at mobile and
desktop sizes, follow both acquisition steps without submitting funds, and verify
that the registry and How to Buy discovery link are served from the resulting
Worker. Record the deployment revision and verify production after publication.

The current Worker config covers www.getdasha.com and lobby.getdasha.com.
The apex hostname's `/multichain` is outside that routing config; use the www
canonical URL. This branch changes neither apex routing nor production.
