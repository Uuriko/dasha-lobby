# Compute less-is-more — research memo + P1 backlog

**Product:** getdasha.com/compute (Typeform gate)  
**Date:** 2026-09-03 ~10:28–10:50 PM PT  
**Inputs:** Typeform 2025 lead-capture / Survey School logic tips · SaaS onboarding 2026 (Linear-style activation) · Nielsen + WCAG / axe / Playwright QA · live QC `/workspace/dasha-compute/COMPUTE-QC-USERTEST.md`  
**Stay off:** Designer · plugin.jup.ag · Graham #44/#76 rewrite · fake Macs

---

## Principles (cite briefly)

### Typeform / conversational forms (2025)
- **≤6 questions** the taker *sees*; longer forms tank completion (Typeform: >6 Q → &lt;50% completion; 10-Q forms ~28% worse than 3-Q).
- **&lt;1–2 min** target; ideally under a minute for lead-style flows.
- **Progress** was Typeform’s top 2024 feature — reassure without fake % theaters (we use dots).
- **Conditional logic** so people only see relevant branches (Hosted vs Community vs Provide).
- **Welcome shouldn’t dump questions** — gate is one intent (Use / Provide / Marketplace), not a lab.

### SaaS onboarding (2026)
- **Magic moment = first Answer token** (activation), not “finished the tour.”
- **One CTA** at a time; Hosted is gravity for cold Use.
- **Progressive disclosure** — How / model are side doors, not mandatory preface.
- **Opinionated defaults (Linear)** — Use ⇒ Hosted Ask without a tour.
- **Kill tours**; **empty state IS onboarding** — example chip + Copy AI skill replace essays.

### QA bar (Nielsen + WCAG)
- Visibility of status · user control (Back / Esc) · consistency · error prevention (login-gated Run).
- **axe after dynamic steps**; keyboard **Tab / Enter / Escape** (+ digit shortcuts for choices).
- Playwright asserts **real UI responses**, not sleeps.
- **3–5 users ≈ 80%** of issues — QC already found progress / Enter / honesty / Run gate.

### Live QC lock (COMPUTE-QC-USERTEST.md)
- Typeform shape correct; P0 Copy AI skill + progress shipped.
- Next that compounds with skills: **Hosted shortcut**, **keyboard 1–4 + Esc**, **Ask starters** ≤3 useful verbs (Welcome note / Summarize this / Draft a curl; curl examples use `hello`).

---

## Encoded product rules

1. **Shortest path to first token wins** — Gate Use → Ask (Hosted).
2. **How is optional** — quiet **Change engine** for Community / Mixture / model.
3. **Progress matches path** — Hosted = Ask → Answer (How not in dots unless user visits via side door; hosted path stays `ask/answer`).
4. **Back respects engine** — Hosted Ask → Gate; Night/empty fleet preserved; Community still → model.
5. **Keyboard parity** — digits fire visible `.tf-choice` in current step; Esc → visible Back; never steal keys while typing prompt/name.
6. **Example chip = skill curl** — one quiet fill, no essay.
7. **Honesty** — no fake Macs; Night only after no-Mac; login-gated Run.

---

## Ranked backlog

### P1 — shipping this memo (done in ship tree)

| # | Item | Why |
|---|---|---|
| A | **Hosted shortcut** Use → Ask + Change engine | Compresses How for default; matches USE.md; progress shrinks |
| B | **Keyboard Typeform** 1/2/3 + Esc | QC C+→B keyboard; Typeform choice shortcuts |
| C | **Ask starters** ≤3 useful verbs · curl `hello` | Empty state = onboarding; no novelty phrase |

### P1 — next (still compound with skill)

| # | Item |
|---|---|
| 8 | Model skip @ 0 Macs already shipped — keep honest Night |
| 11 | Provide Setup ↔ PROVIDE.md lockstep — **shipping** |
| 12 | Focus first choice on How/Model after `showTf` — **shipping** |
| — | Cancel on Answer + Thinking elapsed — **shipping** |
| — | Model capability one-liners — **shipping** |

### P2

| # | Item |
|---|---|
| 13 | Progress `2 / 4` text beside dots |
| 14 | Marketplace preview without leaving Typeform — **shipping** (Typeform `market` peek; no iframe / ocm-peek clutter) |
| 15 | Provide live heartbeat chip |
| 16 | Soften dual Ask heading vs placeholder | ✅ 2026-09-04 Worker 51cdbdb7 |
| 17 | Host door in-flow peek (Ask Host no hard leave) | ✅ peek shipped; Host CTA Open · N honesty |

---

## Ship checklist (this pass)

- Memo: this file  
- Page: `/workspace/dasha-ship-src/dasha-compute-page.mjs` (+ `dasha-compute.html`)  
- Skills: `dasha-compute/skills/USE.md` · `dasha-ship-src/dasha-compute-skills/USE.md` · `dasha-compute-skills.mjs`  
- Tests: typeform first-paint locks gate→Ask · Ask starters (Welcome/Summarize/curl) · Change engine · keyboard  
- Deploy: `DASHA_SHIP_SKIP_CLAIMS=1 wrangler deploy --keep-vars -c dasha-lobby-wrangler.deploy.jsonc`  
- Prove: www `/compute` 200 `edge=compute` · Use→Ask · Change engine · example chip · keyboard present

---

## Addendum — word/design diet (ship 2026-09-04)

**Show, don’t tell.** Status lives in UI state (dim, count badge, primary/secondary), not prose.

### Core only
1. **Ask → Run → Answer** (Hosted default).
2. **Provide** door · **Marketplace** door.
3. **Login** is a control swap (Run ↔ Log in), not a lecture.
4. **Empty fleet** = Night H1 `No Mac online.` + **Hosted** / **Queue** (or **Log in**) — **no paragraph**.

### Labels (chrome)
| Surface | Old honesty | New |
|---|---|---|
| Engine | `Hosted · always on` / `Community · no Mac` / `Mixture · sub-24GB` | `Hosted` / `Community` (+ ` · N` when ≥1) / `Mixture` |
| Empty fleet engines | prose | dim Community + Mixture (`is-dim`) |
| Night buttons | `Use Hosted now` / `Queue for when a Mac is up` / `Log in to queue` | `Hosted` / `Queue` / `Log in` |
| Queued status | essays | `Queued` / `Running` |
| Topbar `#top-state` | `hosted · gpt-oss-20b` / `community · no Mac` / `hosted idle` | `N` or `N · model`; else empty / `·` while checking |
| Ask hint | `Enter · Esc` | hidden; Enter stays; title on textarea |
| Provide beat | `Waiting for heartbeat…` / `Mac online · N` | quiet pulse / `Online` or `N online` |
| Marketplace | `Marketplace · N hosts` + aria essay | Quiet Ask + gate: `Marketplace` only · peek `Open · N` holds count |
| Ask engine (`#change-engine`) | `Change engine` (engine hidden) | Selected engine label: `Hosted` / `Community` (+ ` · N`) / `Mixture`; tap → How; aria `Change engine` |
| Login errors | longer | `Log in.` |

Capability detail stays on **model** step labels only. Functional behavior unchanged (Hosted shortcut, Night path, cancel, skills, keyboard).

Locks: no Designer · plugin.jup.ag · Graham · fake Macs/Raptor.
