# Compute full review — smells / missing / broken
**Product:** https://www.getdasha.com/compute  
**When:** 2026-09-04 ~1:20 PM PT  
**Sources:** `/workspace/dasha-ship-src` (`dasha-compute.html`, `dasha-compute-page.mjs`, `dasha-compute-network.mjs`, `dasha-compute-credits.mjs`, ask-first / typeform / credits tests) · live Mozilla curls www + lobby  
**Deploy:** wave shipped 2026-09-04 ~1:35 PM PT · Worker `334aa8e1-143d-4d79-a6c0-41f8917de06a` · see `PARK-compute-review-fixes-wave.md`

## Live snapshot (prove)
| Probe | Result |
|---|---|
| `www` `/compute` | **200** `x-dasha-edge: compute` · ~80.6 KB · markers present |
| Apex `getdasha.com/compute` | **301** → www |
| `/Compute`, `/COMPUTE` | **308** → `/compute` |
| `/compute/` trailing | **200** (no canonical slash fold) |
| lobby `/compute/api/network` | **200** `providers_online:1` · `models_available:["gemma3-27b"]` · ~2.93 tok/s |
| lobby `/compute/api/status` | **200** `live:true` · `limit:"3 requests / 10 minutes"` |
| lobby `/auth/status` | **200** guest `loggedIn:false` |
| `POST …/credits/spend` (+ Origin) | **401** `login required` |
| `POST …/credits/orders` (+ Origin) | **401** `login required` |
| `/compute/ocm/healthz` | **200** `hosts:2` |
| lobby `/Compute/api/network` | **308** → **www** `/compute/api/network` (cross-host casefold) |
| HTML markers | `gate-signin` · `gate-you` · `ask-credits` · `answer-api` · `answer-credits` · `provide-tto` · `ask-starters` — **all live** |
| live vs disk | +123 B = CF injects `link rel=describedby` for llms — not a product drift |
| Tests (local) | ask-first-regression · typeform-first-paint · less-is-more · credits-spend · credits-routes — **PASS** |

---

## P0 — trust / broken honesty

| # | Symptom | Evidence | Suggested fix |
|---|---|---|---|
| P0-1 | ✅ **SHIPPED** Mixture → Night says “No Mac online.” while a Mac is online | Live network: `providers_online:1`, only `gemma3-27b`. `fleetEmpty('mixture')` is true (27B ∉ SUB24). `showNightEmpty` H1 is hard-coded **No Mac online.** Topbar can still show `1 · gemma3-27b`. User sees contradiction. | Split Night copy: `No Mixture Mac.` / `No chat Mac online.` vs true zero fleet `No Mac online.` Or dim+disable Mixture when no SUB24 capacity and keep Community as the live path. |
| P0-2 | ✅ **SHIPPED** Status / skill under-disclose prepaid Hosted extend | `/compute/api/status` + USE skill: “3 requests / 10 minutes”. Server past free floor auto-`spendHostedAskCredits` ($0.05) then 402 `top up credits` — not a hard stop. UI Answer nudge for `rate` rarely fires on Hosted now; Credits/Top up does. | Status: `3 free / 10 min · then credits`. Skill + Ask quiet line match. Keep fail-closed spend. |

No ship-now one-liner: P0-1 needs product copy choice; P0-2 is copy + status JSON.

---

## P1 — product / UX consistency (smells bad in a usertest)

| # | Symptom | Evidence | Suggested fix |
|---|---|---|---|
| P1-1 | ✅ **SHIPPED** Duplicate login surfaces + wording | Gate quiet **Sign in** (`#gate-signin` → `/login?return=/compute`). Ask primary **Log in** (`#login`). Same destination, different verbs. Guest always sees both if they Open Ask after gate. | One verb everywhere: **Log in**. Gate quiet can stay; Ask primary stays. Or hide gate Sign in once user enters Ask (optional). |
| P1-2 | ✅ **SHIPPED** Sponsor → Provide name with no sponsor explain | `#pay-sponsor` → `showTf('provide-name')` H1 **Name this Mac.** Title only: “Keep a Mac warm.” No Sponsor step, no “you’re joining as capacity,” Back on provide-name is `data-back="ask"` (skips Pay). PARK-pay-credits-steps documents intentional empty > fake. | Either: (a) one-line fine under Sponsor / on Name: `Join with a Mac · keeps capacity warm.` + Back → `pay`; or (b) drop Sponsor until real sponsors sheet; keep Top up only. |
| P1-3 | ✅ **SHIPPED** Marketplace · Host · Provide overlap | Ask quiet doors: Provide · Marketplace · Host. Market peek: Open + Host → `/compute/ocm` / `…/provider`. Provide = community coordinator kit. OCM hosts=2 vs community providers_online=1 — two networks, one chrome. | One-line door titles / peeks: Provide = “Join Macs”; Host = “OCM host”; Marketplace = “OCM catalog.” Or fold Host under Marketplace peek only (already partly true). |
| P1-4 | ✅ **SHIPPED** Progress dots: Pay 5-step vs Credits 1-step vs You 1-step | `paintProgress`: pay path `pay→amount→method→send→done` (5 dots); credits=`['credits']`; you=`['you']`. Typeform progress on a single-step hub feels theatrical / empty. | Hide progress on credits/you (like gate), **or** Credits progress = `credits · ask` when Use credits; Pay stays 5 until X2 compresses. |
| P1-5 | **Guest vs logged-in money paths are good — Ask meter asymmetry** | Credits/Pay method: guest = Log in only (no $0). Ask `#ask-credits` only when logged-in + known balance. You hub only when logged-in. **But** Pay/Credits still look equal to Ask on gate before auth. | Optional: gate Pay/Credits secondary stay; first paint fine under Start. already quiet. Prefer soft auth on first money click (already on method). Leave; document as intentional. |
| P1-6 | ✅ **SHIPPED** Provide-name Back always → Ask | From gate Provide, Pay→Sponsor, Ask→Provide, You→Macs empty — all land Name with Back=`ask`. From gate Provide, Back to Ask is wrong (should be gate). From Sponsor, should be pay. | Stack `cameFrom` / intent: `provide`→gate, `pay`→pay, else ask. |
| P1-7 | **Tests soft-gate live asserts (edge lag fingerprint)** | `dasha-compute-ask-first-regression.test.mjs`: live only hard-requires core; `gate-signin` / `ask-credits` / starters / pay-method-login asserted **if present**; comments `pre-deploy lag`. PARK-ask-credits-meter previously documented concurrent deploy + edge sticky. Today markers are live — soft gates remain. | Keep soft gates for CF lag, but fail CI if www lacks markers for >N min after deploy; or assert worker version header. |

---

## P2 — janky / polish / technical leftovers

| # | Symptom | Evidence | Suggested fix |
|---|---|---|---|
| P2-1 | ✅ **SHIPPED** Trailing slash dual URL | Was: `/compute` and `/compute/` both **200**. Casefold titlecase OK. | 308 `/compute/` (+ `/compute/index.html`) → `/compute` GET/HEAD; API slash untouched. |
| P2-2 | **Lobby titlecase API → www** | `lobby…/Compute/api/network` **308** Location `https://www.getdasha.com/compute/api/network`. Lowercase lobby stays on lobby. | Casefold stay on same host (`lobby…/compute/api/network`). |
| P2-3 | ✅ **SHIPPED** Community How dim title @ 0 | `is-dim` when `providers_online===0`; click still → Night. Honest enough; dim implies disabled to some users. | Keep clickable (Night is the point) or `aria-disabled` + title `No Mac · opens Night`. |
| P2-4 | **PARK discount copy drift** | PARK-credits-solana said USDC 5% / $dasha 10%; live `CREDIT_DISCOUNTS={usdc:0.03,dasha:0.05}` + labels `$4.85` / `$4.75`. API discounts match live. | Fix PARK note; don’t change prices in this review. |
| P2-5 | **Mobile / a11y gaps** | `@media(max-width:560px)` shrinks choices; skip + `:focus-visible` + Esc/1–4 + `aria-live` present. Gaps: no axe in CI; dual primary Ask when logged out (Log in + disabled Run) still busy; progress `aria-valuetext` on 1-step hubs; Provide Setup `<pre>` hard on small screens. | Mobile: stack Ask doors; axe smoke on gate/ask/pay; wrap setup pre. |
| P2-6 | **Spend Origin CSRF** | No Origin → **403** `origin required`; with Origin unauth → **401**. Correct; curl-only clients need Origin. | Document in USE skill / API notes. |

---

## Missing — obvious next (not bugs yet)

| # | Gap | Why it matters | Notes |
|---|---|---|---|
| M1 | **X2 Pay one-sheet** | Inspire backlog: Fill/Sponsor one sheet vs 5 Typeform steps. Current Pay is correct but long for crypto tip. | Compress Amount+Method+Send; keep Phantom copy/open. Stripe still deferred (Potter). |
| M2 | **Stripe / card** | Explicitly deferred in PARK + skills (“No card yet”). | Stay deferred until asked. |
| M3 | **Community / Mixture spend** | Hosted-only debit (`HOSTED_ASK_PRICE_CENTS=5`). PARK-credits-spend-hosted NEXT. | After sticky SUB24 Mac + Hosted meter proven. |
| M4 | **You prefs beyond Macs / Credits / API** | `#step-you` = Macs · Credits · API · Log out. No engine default, notify, spend cap. | Add only after real prefs store — don’t fake. |
| M5 | **Free credits faucet for first token** | Fireworks/Nosana pattern in inspire; Hosted already has 3 free/10min — not a credits balance faucet. Guest still needs Log in before any token. | Optional: post-login `$0.25` credit grant once, **or** clearer “3 free Hosted” chip on Ask. Prefer copy before inventing faucet ledger. |
| M6 | **Rate-limit copy honesty** | See P0-2. Answer rate nudge mostly for community 429 now. | Align status + Ask + Answer. |
| M7 | **Real Sponsor product** | Sponsors API exists (`sponsor:` rate limit in network); UI routes to Provide. | Warm-badge + tip path per ROADMAP §5 — after Provide Online sticky. |
| M8 | **Logged-in Run → first token E2E in CI** | Audit gap: needs session cookie. Soft-gated. | Puppeteer with fixture session later. |

---

## Top 5 ship-next (ranked)

| Rank | Item | Why first | Effort |
|---|---|---|---|
| 1 | ✅ **P0-1 Mixture / Night honesty** when Mac online but wrong class | Trust killer vs live `1 · gemma3-27b` | S |
| 2 | ✅ **P1-2 + P1-6 Sponsor / Provide Back stack** | Pay→Sponsor feels broken; one fine + Back→pay | S |
| 3 | ✅ **P1-3 Marketplace vs Host vs Provide labels** | Cold user can’t tell which door is Dasha Macs vs OCM | S |
| 4 | ✅ **P0-2 free-floor / credits copy** (M5 faucet still open) | Status still “3 / 10 min”; prepaid already ships | S |
| 5 | **M1 X2 Pay one-sheet** (Stripe still out) | 5-step Pay is the longest Typeform branch | M |

Honorable: unify **Log in** wording (P1-1); hide progress on Credits/You (P1-4); trailing-slash 308 (P2-1).

---

## Already solid (brief)

- **Gate-first Start.** with Ask / Provide / Pay / Credits; Marketplace quiet on Ask (no · N boast); Hosted Ask gravity after Ask / Use credits / Top-up-to-Ask.
- **Honesty floor:** no fake Macs; Night only after empty/wrong fleet; guest Credits/Pay never invent `$0`; `#ask-credits` guest-hidden.
- **Money spine:** Solana USDC/$dasha orders + confirm; Hosted spend past free floor; Answer quiet Top up / Credits only on fail; API key quiet after first Answer.
- **Provide:** tto + Online pulse; kit + Copy AI skill; doctor path.
- **Keyboard Typeform:** 1–4 · Esc Back · Enter Run; focus-first; reduced-motion.
- **Routes:** casefold `/Compute*` 308; tab leftovers `/compute/use|provide|sponsor` 308 → `/compute`; www↔lobby API JSON parity on lowercase paths.
- **Markers live** (`gate-signin`, `gate-you`, `ask-credits`, `answer-api`, `answer-credits`, `provide-tto`, `ask-starters`) — earlier edge-lag PARK is cleared on this curl.
- **Regression locks green** on disk/embed/worker.fetch + soft live.

---

## Stay off (honored this review)

Designer · plugin.jup.ag · Graham #44/#76 · Stripe invent · fake prefs · deploy without Potter ask · leftover CSS hunting.

## Executive paste (for Potter)

See parent relay — short summary below in agent final message.
