# Dasha Compute — competitor + adjacent inspiration backlog

**Product:** [getdasha.com/compute](https://www.getdasha.com/compute)  
**Date:** 2026-09-04 ~9:35 AM PT  
**Scope:** Features + design/onboarding of GPU/LLM marketplaces, Mac local AI, Typeform-style intent, credits/pay UX, provider supply UX  
**Method:** Web research (Exa MCP rate-limited → WebSearch/WebFetch). No Worker changes in this task.  
**Locks:** Apple-elegant · Dasha tone · no disclaimer lectures · less-is-more · honesty when `providers_online:0` · OpenAI-compatible · Ollama on Macs · sub-24GB models  

**Potter now:** intent form first paint (**Ask / Provide / Pay / Credits**) + remove “say something strange”.

---

## 1. Competitor snapshot table

| Product | Core loop | Onboarding | Credits / pay | Provider path | Design notes | URL |
|---|---|---|---|---|---|---|
| **OpenRouter** | One OpenAI-compatible key → 500+ models / 80+ providers; chat + API | Signup → **Buy credits** → API key (3-step home) | Prepaid USD credits; deduct per token; auto top-up; 5.5% fee on purchase; free models w/ low RPD | N/A (router, not host supply) | Clean unified interface; model cards with live $/M; chat room as first product surface | https://openrouter.ai/ · https://openrouter.ai/pricing · https://openrouter.ai/docs/faq |
| **Fireworks** | Playground → serverless → on-demand GPUs | Docs: model library → playground → API key → serverless → scale | $1 free credits; postpaid per-token serverless; GPU-hour on-demand | Own infra (not community hosts) | Playground-first; copy-paste code from playground; progressive disclosure | https://fireworks.ai/ · https://docs.fireworks.ai/getting-started/onboarding · https://fireworks.ai/pricing |
| **Together AI** | Hosted open models, fine-tune, inference API | Account → playground/API | Per-token; trial credits common | Own / partner clusters | Dev-cloud chrome; model catalog heavy | https://www.together.ai/ |
| **Groq Cloud** | Ultra-fast LPU inference | “Start building” → console | Per-token; free tier / credits | Proprietary silicon | Marketing-forward; speed as brand; less community | https://groq.com/ |
| **RunPod** | Rent pods / serverless endpoints | Sign up → deploy template / endpoint | Credits + prepaid; $25 trial common | Community Cloud = vetted 3P supply (not one-click home PC) | Dashboard-heavy; templates reduce blank-page | https://www.runpod.io/ |
| **Vast.ai** | GPU rental marketplace (client rents host offers) | Client: search → rent. Host: separate account + hosting agreement | Client prepaid / card; host earns on rental contracts | **Hard:** Ubuntu, NVIDIA, ports, daemon, verification stages; marketing claims “minutes,” docs = Linux ops | Marketplace chrome; interruptible/on-demand/reserved; honesty gap between marketing vs setup docs | https://vast.ai/hosting · https://docs.vast.ai/host/hosting-overview |
| **Salad** | Two-sided: **Chefs** earn on idle PCs; **SaladCloud** deploys containers | Chef: Download app → email OTP → machine setup (WSL) → **Chop Now**. Cloud: org + credits + deploy group | Chef: Salad Balance → gift cards/PayPal. Cloud: prepaid credits, per-second instances | **Best consumer host UX:** Windows desktop app, guided WSL, AFK earn; short onboarding | Friendly “Kitchen/Chef” tone; consumer simplicity on supply side; business portal is separate chrome | https://salad.com/ · https://salad.com/download · https://docs.salad.com/ |
| **Akash** | Decentralized cloud leases (CPU/GPU) | Wallet / Provider Console (~15–30 min managed) or Ansible playbook (~1h) | AKT / escrow leases | Provider Console = easiest; still K8s under the hood; Web3 wallet wall for many | Crypto-infra aesthetic; Provider Earn Calculator; explorer for honesty of supply | https://akash.network/docs/providers/getting-started/should-i-run-a-provider/ |
| **io.net** | Aggregated GPU clusters for AI train/infer | Free trial credits (~$100 claimed) → deploy | Per-second GPU billing | Aggregates supply; crypto-native | Speed/price marketing; cluster dashboard | https://io.net/ |
| **Nosana** | Solana GPU marketplace; templates + custom containers | Connect wallet **or** email; claim free credits | Credit balance (assigned/reserved/settled) | Node operators on Solana grid | Dashboard + Explorer; “Get Free GPU Credits” CTAs; OpenGPU task market | https://nosana.com/ · https://nosana.com/gpu-workloads/ |
| **Hyperbolic** | Inference-first GPU / model access | Account → GPU / inference | On-demand GPU pricing | Marketplace-style sourcing | AI-builder oriented; lighter than full cloud | https://www.hyperbolic.ai/ (fetch timed out; secondary reviews) |
| **Render Network** | Decentralized GPU for render / some AI | Creator + node operator flows | RNDR / credits historically | Node operators (render-first DNA) | Creative/render heritage; not chat-first | https://rendernetwork.com/ (via comparison articles) |
| **Venice.ai** | Private / uncensored chat + API | Chat-first; privacy positioning | Credits / subscription patterns common in class | N/A (consumer chat) | Chat empty-state + privacy brand; adjacent to Dasha “room” feel | https://venice.ai/ |
| **Infermatic** | Uncensored / community model hosting | API + chat style | Credits | Hosted models | Niche model access; less elegant | (search: Infermatic.ai) |
| **Ollama** | Local models via CLI + daemon `:11434` | Install → `ollama run` / pull | Free local | User’s machine | Minimal CLI elegance; OpenAI-compatible; Dasha Provide already depends on it | https://ollama.com/ |
| **LM Studio** | GUI chat + local server | Install → browse model → Download → chat; toggle server | Free | User’s Mac (MLX default on Apple Silicon) | ChatGPT-shaped GUI; model browser; best Mac beginner path | https://lmstudio.ai/ |
| **Apple MLX apps** | Native Apple Silicon inference | App-dependent | Free | Local | Memory-efficient; MLX as speed story for Provide kits | (ecosystem; LM Studio MLX path) |
| **MacWhisper-class** | One job, one elegant Mac app | Download → pick file → transcribe | Paid app | Local | **Steal:** single verb, no dashboard, Apple polish | (category pattern) |
| **TypingMind** | Best frontend for LLMs (BYO keys) | Buy license → paste keys → chat | License; user’s API spend | N/A | Frontend purity; chat chrome without infra lectures | https://typingmind.com/ |
| **LibreChat** | Self-host multi-provider chat | Deploy stack → config | Depends | N/A | Feature-rich; anti-pattern for Dasha chrome weight | https://www.librechat.ai/ |
| **Typeform** | One question at a time conversational forms | Welcome → ≤6 Q · progress · logic | N/A | N/A | **Primary shape for Dasha gate**; completion collapses >6 Q | https://www.typeform.com/ (research norms in COMPUTE-LESS-IS-MORE) |
| **Linear / Arc / Cursor / Claude / ChatGPT** | Empty state = onboarding | First paint = verb + starters, not tour | Sub / usage | N/A | Kill tours; starters; starting verb beats “ask anything” | (pattern catalog; see §2–3) |

---

## 2. Patterns worth stealing (specific)

### Intent / first paint
1. **OpenRouter 3-step spine:** Signup → Buy credits → Get API key — each step is a noun users already want. Map to Dasha: **Ask · Provide · Pay · Credits** as equal intent doors (Potter), not a lab of engines.
2. **Typeform ≤6 visible questions, <1–2 min, progress dots, conditional branches** — already Dasha DNA; keep gate as *intent*, not *How/Community/Mixture* dump.
3. **Empty state = onboarding (Linear / Claude / ChatGPT / Cursor class):** 3–5 specific starter chips that demonstrate capability — not a blank cursor, not a tour. Replace novelty prompts with **useful verbs** (“Rewrite this,” “Explain like I’m 12,” “Draft a curl”).
4. **Starting verb over “ask anything”** (DesignersForest / Linear): Prefer **Ask.** as H1 with Run as the verb; Pay/Credits as clear money intents; Provide as join-network verb.
5. **Fireworks playground → code export:** After first Answer, one quiet **API** / **Copy curl** that reuses the same prompt — activation handoff Ask → Build.
6. **Salad “Chop Now”:** One primary action after setup. Dasha Provide equivalent: after doctor green → **Online** (not an essay).

### Honesty / capacity
7. **Salad / Akash explorer honesty:** Show real supply counts where they matter (peek `Open · N`), never invent Macs. Night only when fleet empty — already Dasha rule.
8. **OpenRouter model pages:** Price and limits visible at point of choice; Dasha model step already has size one-liners — keep, don’t lecture.
9. **Hosted floor like Fireworks serverless:** Always-on path so cold start never feels dead when community is 0.

### Credits / pay
10. **OpenRouter prepaid meter:** Balance → spend on any model; auto top-up optional; per-key spend caps. Dasha: **Credits** = prepaid jar; **Pay** = buy / tip / sponsor now.
11. **Fireworks $1 free credits:** Tiny faucet to first token without card theater — align with Dasha faucet/Fill patterns, not Web3 wall.
12. **Clarity: “use credits” vs “pay now”** — two doors, two outcomes. Credits = balance check + Run; Pay = top-up / sponsor / USDC path with one confirm.

### Provider supply
13. **Salad Chef path (steal hard):** Download → login → guided machine setup → start. Few steps, consumer tone, AFK-first. Closest peer to Mac Provide.
14. **Vast marketing 3-step (steal framing, not ops):** List → Set terms → We bring customers. Dasha: Name → Register → Kit/doctor → Online.
15. **Akash Provider Console timebox:** “15–30 min” honest estimate beats “minutes” false hope. Dasha Provide kit should show **time-to-online** quietly (doctor steps).
16. **GPU.ai / GPUnex agent pattern:** Install agent → auto verify → appear in catalog. Dasha already: register + heartbeat; double-down on doctor green = listed.

### Mac / local elegance
17. **LM Studio:** Browse → Download → Chat; MLX on Apple Silicon; server toggle for API. Provide kit UX should feel this simple, not Vast-server.
18. **Ollama one-liner + OpenAI compat:** Keep as Provide substrate; don’t make users learn another runtime.
19. **MacWhisper-class:** One screen, one job, Apple quiet. Gate and Ask should feel like this, not a console.

---

## 3. Anti-patterns to avoid

| Anti-pattern | Who does it | Why it hurts Dasha |
|---|---|---|
| **Dashboard chrome / nav sprawl** | RunPod, Vast console, LibreChat, Akash explorer | Breaks Apple-elegant, Typeform calm; pushes “admin” not “room” |
| **Web3 wallet wall before first token** | Nosana (wallet path), Akash leases, many crypto GPU nets | Blocks cold Ask; Dasha already has Hosted floor + login |
| **Marketing “setup in minutes” vs Linux hell** | Vast hosting page vs docs | Trust killer — Dasha must never claim online Macs that aren’t heartbeating |
| **Fake / inflated supply** | Any marketplace with ghost nodes | Fleet often `providers_online:0` — honesty is brand |
| **Disclaimer lectures / tours** | Enterprise onboarding guides, long SaladCloud sales FAQ walls on first paint | Violates less-is-more; kill tours (Linear rule) |
| **Novelty empty prompt** (“say something strange”) | Current Ask chip / curl parity | Causes empty-prompt paralysis + unserious first Answer; Potter: remove |
| **Equal weight for rare paths** | Showing How/Community/Mixture before Ask | Delays first token; Hosted is gravity |
| **Separate client vs host accounts as dark rule** | Vast | Confusing; Dasha: one identity, Ask vs Provide as intent |
| **Crypto jargon on money doors** | AKT escrow, RNDR, NOS price widgets | Pay/Credits should read as money, not a thesis |
| **Feature-max chat UIs** | LibreChat defaults | Opposes Dasha tone |

---

## 4. Ranked backlog — NOW / NEXT / LATER

Effort: **S** hours · **M** day · **L** multi-day. Risk: product/trust risk if wrong.

### NOW (ship with intent-form first paint)

| # | Item | Inspiration | Why it fits Dasha | Effort | Risk |
|---|---|---|---|---|---|
| N1 | **Gate first paint = Ask / Provide / Pay / Credits** (four intents; Use→Ask gravity optional deep-link) | OpenRouter 3-step nouns + Typeform welcome + Potter ask | Matches money + supply + ask without engine lab | S–M | Low if Hosted Ask remains shortest path after Ask |
| N2 | **Remove “say something strange”** everywhere (chip, placeholder, curl, skills, API examples) | Claude/ChatGPT starters; empty-prompt research | First Answer should feel useful; curl parity stays but with adult prompt | S | Low — update tests/skills lockstep |
| N3 | **Replace with 1 quiet useful chip** (or 3 max under Ask) — verb-led | Linear verb; Claude starters (3–5 max) | Beats blank + novelty; still less-is-more | S | Low if ≤3 chips |
| N4 | **Pay vs Credits copy split** on gate: Pay = top-up/sponsor now; Credits = use prepaid meter | OpenRouter buy credits vs spend; faucet Fill | Intent clarity before billing chrome | S | Med — don’t invent fake balances |
| N5 | **Honesty lock on gate:** when `providers_online:0`, no Community boast; Provide still invited | Salad real nodes; Akash explorer | Trust when fleet empty | S | Low |
| N6 | **Wire copy pass** (see §5) for gate H1 + four doors | Typeform one-question; MacWhisper quiet | Tone without lectures | S | Low |

### NEXT

| # | Item | Inspiration | Why it fits | Effort | Risk |
|---|---|---|---|---|---|
| X1 | **Credits meter chip** (quiet balance on Ask when logged in) | OpenRouter remaining credits API | “Use credits” becomes visible without dashboard | M | **Shipped** — `#ask-credits` + `paintAskCredits`; edge caught up with later Worker versions |
| X2 | **Pay flow = Fill / Sponsor compress** (USDC/$dasha), not wallet wall | Faucet Fill; OpenRouter buy credits | Money without Web3 lecture | M | **Shipped** — `pay` → `pay-buy` (amount+method) → `pay-send` → `pay-done`; guest Log in only; Stripe still deferred |
| X3 | **Provide path Salad-simple:** Name → Register → kit → doctor → **Online** pulse | Salad Chop Now; LM Studio | Mac supply is Dasha moat | M | **Shipped pulse** — `#provide-beat` Online/N online acid pulse + aria; hide `#provide-tto` when online; waiting stays honest |
| X4 | **Time-to-online estimate** on Provide Setup (honest minutes) | Akash “15–30 min” | Beats Vast false “minutes” | S | **Shipped** — `#provide-tto` on Setup only: `About 15–30 min to online.` |
| X5 | **After Answer: one Pay/Credits nudge** only if rate-limited | Fireworks free→paid | Monetize after magic moment | S | **Shipped** — `#answer-credits` + `paintAnswerMoney` only for `rate`/`credits` fail; Top up → Pay amount; clear on success / Ask again |
| X6 | **Starter chips rotate useful work** (rewrite, summarize, code) not personality | ChatGPT/Claude empty state | Activation quality | S | **Shipped** — `#ask-starters` Welcome note / Summarize this / Draft a curl |
| X7 | **API key create after first token** (progressive) | OpenRouter step 3; Fireworks key after playground | Build without forcing developers first | M | **Shipped** — `#answer-api` after first Answer → Build / Log in; quiet if keys exist |

### LATER

| # | Item | Inspiration | Why it fits | Effort | Risk |
|---|---|---|---|---|---|
| L1 | **Provider earnings board** (real only; scenario labeled) | Salad Balance; Vast earnings | Supply incentive when payouts exist | L | **Shipped tracking** — accrue on community `complete`; You → Earnings; USDC / $dasha +10%; payouts **pending** (auto-chain later) |
| L2 | **Auto top-up credits** | OpenRouter | Power users | M | Med |
| L3 | **Per-key credit caps** | OpenRouter | API abuse control | M | Low |
| L4 | **Linux/NVIDIA Provide class** | Vast/RunPod/SaladCloud | Burst GPU ladder from ROADMAP | L | High ops |
| L5 | **Marketplace host peek = SaladCloud lite** | OCM / Graham lane | Separate from Typeform calm | L | Collide Graham — stay off rewrite |
| L6 | **MLX-fast path in Provide kit** | LM Studio MLX | Mac tok/s story | L | **Shipped Prefer MLX** — skill/doctor/UI soft path; Ollama *-mlx / LM Studio / mlx_lm; no invented env flags; never fail doctor for missing MLX |

---

## 5. Concrete UX wire copy — gate Ask / Provide / Pay / Credits

Tone: short, Apple-quiet, no lectures. Beat peers by being clearer and calmer than OpenRouter’s “Buy credits” dashboard and Salad’s joke-heavy Kitchen.

### Gate (first paint)

```
H1: What do you want?

[ Ask ]        — run a prompt
[ Provide ]    — join with a Mac
[ Pay ]        — top up or sponsor
[ Credits ]    — use what you have

(progress: ···· or none — single screen)
```

**Choice sublabels (optional, one line max — prefer none if labels are clear):**
- Ask → _(empty — H1 is enough)_
- Provide → `Mac · Ollama`
- Pay → `Buy · Sponsor`
- Credits → `Balance`

**Anti-copy (do not ship):** “Decentralized GPU marketplace,” “Earn passive income,” “Connect wallet to continue,” “Say something strange,” “Always-on community of Macs” when N=0.

### Ask (after Ask intent)

```
H1: Ask.

[textarea placeholder: Write a short welcome for a new teammate.]
Chip: Welcome note
(optional 2nd/3rd: Explain this error · Draft a curl)

[ Run ]  [ Log in ]     ← login swaps primary; no essay

Hosted                    ← #change-engine quiet label
Provide · Marketplace · Host   ← quiet text doors
```

**Replace all instances of** `say something strange` **with** e.g. `Write a short welcome for a new teammate.` (chip label: `Welcome note`).

### Provide

```
H1: Name this Mac.
… Register → Setup …

Setup primary after doctor:
Online
(secondary: Download kit · Get Ollama)
```

### Pay

```
H1: Pay.

[ Top up ]     — add credits
[ Sponsor ]    — keep a Mac warm

Back → gate
```

One confirm line max if needed: `Goes to credits.` — not a legal lecture.

### Credits

```
H1: Credits.

Balance  $X.XX     ← or · if unknown / logged out
[ Use on Ask ]     → hosted Ask
[ Top up ]         → Pay

Logged out:
Log in to see balance.
```

**Honesty:** If balance API missing, show `Log in` / `·` — never invent `$12.00`.

### Empty fleet (Night) — keep word diet

```
H1: No Mac online.
[ Hosted ] [ Queue ] [ Log in ]
```

### Why this beats peers
- **vs OpenRouter:** Intent before account chrome; Ask works before Buy.
- **vs Vast/RunPod:** No machine table on first paint.
- **vs Salad Kitchen jokes:** Dasha tone stays adult/quiet.
- **vs Nosana/Akash:** No wallet wall to see Ask.
- **vs Claude/ChatGPT starters:** Fewer chips, useful verbs, Hosted default — community honesty intact.

---

## 6. Sources

### Dasha live / internal
- https://getdasha.com/compute
- `/workspace/dasha-compute/COMPUTE-LESS-IS-MORE.md`
- `/workspace/dasha-compute/ASK-FIRST.md`
- `/workspace/dasha-compute/ROADMAP.md`
- `/workspace/dasha-compute/COMPUTE-AUDIT.md`

### Marketplaces / inference
- https://openrouter.ai/ · https://openrouter.ai/pricing · https://openrouter.ai/docs/faq · https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits
- https://fireworks.ai/ · https://fireworks.ai/pricing · https://docs.fireworks.ai/getting-started/onboarding · https://fireworks.ai/blog/inference-providers-vs-api-routers
- https://groq.com/
- https://www.runpod.io/
- https://vast.ai/hosting · https://docs.vast.ai/host/hosting-overview · https://docs.vast.ai/host/verification-stages
- https://salad.com/ · https://salad.com/download · https://docs.salad.com/container-engine/tutorials/quickstart · https://support.salad.com/ (Chef earn FAQ) · Salad Kitchen docs index (GitHub salad-kitchen-docs)
- https://akash.network/docs/providers/getting-started/should-i-run-a-provider/ · https://akash.network/docs/providers/setup-and-installation/provider-playbook/
- https://io.net/ · https://io.net/blog/io-net-vs-akash-network-comparing-gpu-cloud-pricing-and-features
- https://nosana.com/ · https://nosana.com/gpu-workloads/
- https://startupik.com/ionet-vs-akash-vs-render-vs-hyperbolic/ · https://startupik.com/hyperbolic-vs-ionet-vs-akash/
- https://hostfleet.net/openrouter-vs-together-vs-groq-vs-fireworks/
- https://www.theneuron.ai/explainer-articles/one-api-key-to-rule-them-all-how-openrouter-lets-you-use-every-ai-model-without-the-headache/

### Local / Mac AI
- https://ollama.com/
- https://lmstudio.ai/
- https://metawhisp.com/blog/lm-studio-vs-ollama-mac/
- https://www.morphllm.com/comparisons/ollama-vs-lm-studio
- https://www.xda-developers.com/i-tested-5-local-ai-tools-and-one-clearly-stands-out-for-beginners/
- https://typingmind.com/

### Onboarding / empty state / credits UX
- https://www.72technologies.com/blog/empty-states-as-onboarding-surface
- https://aiproduct.cards/blog/how-to-fix-empty-prompt-paralysis-in-ai-onboarding
- https://designpixil.com/blog/ai-chatbot-interface-design
- https://www.designersforest.com/the-death-of-the-empty-state-in-ai-products/
- https://auditbuffet.com/patterns/ab-000153
- https://usertourkit.com/blog/onboarding-developer-tools-cli-dashboard-api
- Typeform completion norms cited in COMPUTE-LESS-IS-MORE (≤6 Q, progress, conditional logic)

### Provider-adjacent
- https://gpu.ai/docs/guides/community-supplier
- https://www.gpunex.com/provide/

---

## Appendix — research notes

- **Exa MCP** hit free rate limit mid-task; completed via WebSearch + WebFetch (same URL set).
- Hyperbolic / Venice / Together / Ollama homepage fetches timed out or 500; used secondary reviews + known positioning.
- Dasha live page still showed gate `Use Provide Marketplace` and Ask chip `say something strange` at fetch time — backlog N1–N2 supersede that paint per Potter.
- Stay off: Worker ships, Designer, plugin.jup.ag, Graham OCM rewrite, fake Macs.

---

## L1 follow-up — provider settle (2026-09-04 ~3:30 PM PT)

Shipped first **USDC provider settle path** (fail-closed):
- Operator secret routes list pending + mark paid with Solana tx sig
- Auto-send **off** unless `COMPUTE_PAYOUT_KEYPAIR` (never faucet tip key by default)
- `$dasha` mark-paid only in v1
- Earnings UI quiet Solscan when paid
- Docs: `scripts/compute-provider-settle.md` · PARK-compute-provider-payout-settle.md

Steal still open from Salad Chef cash-out clarity: one status verb (Pending → Paid) + explorer link — done quietly without dashboard chrome.
