# Compute audit (gate-first as of 2026-09-04 PM) — 2026-09-04

**Product:** getdasha.com/compute  
**Tree:** `/workspace/dasha-ship-src`  
**Lane:** keep-swarm-busy (hop DOWN, `DASHA_SHIP_SKIP_CLAIMS=1`)  
**Locks:** no Designer · no plugin.jup.ag · no Graham #44/#76 · no stripHomeCompute undo

## Today’s PARK ships (PT, newest first)

| When (PT) | PARK | Worker | What |
|---|---|---|---|
| ~9:48 AM PT | intent-gate-first | `906b11a5-a253-4c13-a377-fadb5151dcaf` | Gate Ask/Provide/Pay/Credits first paint; cut strange; Welcome note; Pay/Credits titles; digest kept |
| ~9:35 AM | api-faucet-fills-tape-casefold | (fill after deploy) | Title-case /Compute/api + /Faucet/fills|tape|status|me 308 (id/sig case kept) |
| ~9:20 AM | skill-faucet-fill-casefold | `8a1248a4-472b-4185-bedf-4f3f68851ab3` | Title-case skill + /Faucet/fill 308 lowercase (sig case kept) |
| ~8:42 AM | gate-marketplace-quiet | `dffee2c6-b44c-4ae4-bcef-09d4e45a979d` | Gate `#ocm-door` plain `Marketplace` (no · N); count peek Open only |
| ~8:18 AM | quiet-marketplace-count | `a812ce9d-01fc-4a47-a9b1-d77ae0679631` | Quiet `#ask-ocm` = `Marketplace` only; gate may `· N`; peek `Open · N`; Host peek CTA Run→Open |
| ~8:08 AM | host-peek | `c0760f8a-b865-433d-ab56-404db6ed84b2` | Ask Host → in-flow `#step-host`; Open → `/compute/ocm/provider` |
| ~8:00 AM | market-preview-soften-ask | `51cdbdb7-f226-4630-8f95-7c5557646100` | Market peek + soften dual Ask heading |
| ~8:00 AM | market-peek | `8ecb8b85-c27e-4fc8-a134-466920dcd9bc` | Marketplace Typeform peek (no hard leave) |
| ~7:55 AM | provide-done-ask | `820dfc21-e656-4faf-8edb-d887faa18447` | Provide Done → Ask (not gate) |
| ~7:45 AM | askfirst-skill-aeo | `a8da8f8a-1465-48e6-b002-c45fe67546e9` | USE skill + llms-full Ask-first lockstep |
| ~6:55 AM | progress-fraction | (see PARK) | Progress `N / M` beside dots |

Earlier Sep 3–2: Typeform P0, AI skills, night queue, unified Ask+Provide, OCM proxy, SSE, slash+HEAD leftovers — covered by dedicated `dasha-compute-*-slash-head` / night / hosted-sse tests.

## Test coverage map (flow-critical)

| Concern | Primary tests |
|---|---|
| Gate-first cold (Ask/Provide/Pay/Credits) / quiet doors / Host+Market peeks | `dasha-compute-typeform-first-paint.test.mjs` · `dasha-compute-less-is-more.test.mjs` · **`dasha-compute-ask-first-regression.test.mjs` (new)** |
| Word/design diet | `dasha-compute-less-is-more.test.mjs` |
| Skills + USE.md embed lockstep | `dasha-compute-skills.test.mjs` |
| Copy helpers | `dasha-compute-copy.test.mjs` |
| Unified / provide parity | `dasha-compute-unified-first-paint.test.mjs` · `dasha-compute-provide-setup-parity.test.mjs` |
| AEO / llms Ask-first line | `dasha-llms.test.mjs` |
| OCM proxy / healthz | `dasha-compute-ocm-proxy.test.mjs` |
| Hosted SSE | `dasha-compute-hosted-sse.test.mjs` |
| Canary contract | `dasha-canary-contract.test.mjs` |

## Gaps (untested or thin)

1. **Selected engine honesty on Ask** — Fixed Worker c928f749 via `paintAskEngine`; regression locks it.
2. **Ask-first regression** — `dasha-compute-ask-first-regression.test.mjs` (+ gate quiet lock this ship).
3. **Gate Marketplace · N** — Neutralized Worker dffee2c6; count on peek Open only.
4. **Live Puppeteer against www** (auth/network) — most UI is file:// or worker.fetch; live curl proves headers/bodies only.
5. **Provide kit first-hour copy** — QC P1 shipped (skill verify + Setup copy + kit README honesty). See PARK-compute-provide-kit-qc.md.
6. **Apex `/.well-known/grok-bot.json`** — DNS grey-cloud / Webflow; needs zone write (out of Worker scope). **Skip.**
7. **Logged-in Run → first token** end-to-end — needs session cookie; not in CI. **Skip.**

## Ranked bug backlog (live curl + source, 2026-09-04 ~8:20 AM PT)

| Rank | Bug | Evidence | Status |
|---|---|---|---|
| P0 | Quiet Ask Marketplace count leak (`Marketplace · N` mid-nav) | Prior usertest; source now `askOcm.textContent='Marketplace'` | **SHIPPED** (Worker a812ce9d) |
| P0b | Gate `#ocm-door` still `Marketplace · N` (legacy leak path) | `paintSplit` gateOcm template | **SHIPPED** Worker `dffee2c6` (gate plain; count peek Open only) |
| P1 | Hosted selected but not visibly surfaced on Ask | Was `Change engine` | **SHIPPED** Worker `c928f749` (`paintAskEngine` → `Hosted`) |
| P2 | Apex grok-bot.json 404 via Webflow | Zone read-only; grey-cloud | Open (DNS) |
| P3 | Provide kit first-hour copy | SHIPPED Worker `763f00b9` | PARK-compute-provide-kit-qc.md |
| — | Forum in-page Play/chess canary FAIL | Pre-existing dasha-ship post-prove | Unrelated; stay off |

## Prove checklist (this audit ship)

- [x] New ask-first-regression PASS
- [x] typeform / less-is-more / copy / skills PASS
- [x] Live: www+lobby `/compute` 200 `x-dasha-edge: compute`
- [x] Quiet nav: `#ask-ocm` paint = `Marketplace` (no ` · ` + digit in askOcm assignment)
- [x] Gate `#ocm-door` paint = `Marketplace` (no · N); count only on peek Open
- [x] `#change-engine` first paint / paintAskEngine = `Hosted`
- [x] skills use.md + ocm-host + kit + privacy + llms-full 200
- [x] no `plugin.jup.ag`

## Stay off

Designer · plugin.jup.ag · Graham #44/#76 · leftover CSS loop · people-data · stripHomeCompute undo · inventing chrome when clean

## This ship

Worker **dffee2c6-b44c-4ae4-bcef-09d4e45a979d** · PARK-compute-gate-marketplace-quiet.md  
(prior audit ship: Worker **c928f749** · PARK-compute-askfirst-audit-hosted-label.md)
