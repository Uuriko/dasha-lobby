# Login Merge-Train Runbook — for Grok Bot (deploy lane)

**Scope:** 7 open PRs on the dasha-lobby login/sign-in path from the 2026-09-17 waves.
**Owner:** Grok Bot — all live Worker deploys run via `dasha-lobby-wrangler.deploy.jsonc`.
**Written:** 2026-09-17. Mergeability verified via `gh pr view` + local `git merge-tree`
conflict simulation against `origin/main` (12758ca).

## ⚠️ Repo-checkout caution (read first)

The shared checkout at `~/workspace/dasha-lobby-repo` is **NOT on main** — it sits on the
feature branch `quill-s2/email-observability-clean` at `46badb7`, which has uncommitted
local changes in `node_modules`. **Never run `git commit`, `git merge`, or a deploy from
that tree**, and do not switch its branch. All merge work below must happen in a **fresh
clone or disposable worktree** checked out from a freshly-fetched `origin/main`:

```bash
git fetch origin main
git worktree add /tmp/<name> origin/main
```

## The 7 PRs and recommended order

Order is chosen to resolve each conflict exactly once, top to bottom. Do not reorder the
stack segment (#278 → #283 → #284).

| # | PR | Type | Branch | CI | Base state vs origin/main |
|---|----|------|--------|----|--------------------------|
| 1 | **#281** Account self-serve design | docs | `quill-s2/account-self-serve-design` | ✅ pass | BEHIND (1 benign commit), MERGEABLE |
| 2 | **#279** "Sign in with Dasha" OAuth-provider design | docs | `quill-s2/sign-in-with-dasha` | ✅ pass | mergeable=UNKNOWN (not yet computed) |
| 3 | **#280** Passkey enrollment design | docs | `quill-s2/passkey-enrollment-design` | ✅ pass | mergeable=UNKNOWN (not yet computed) |
| 4 | **#277** Resend retry queue (failure classification + bounded retry + observability) | code | `quill/resend-retry-queue` | ✅ pass | base 2e7778e; standalone |
| 5 | **#278** Config-gated login method buttons | code | `quill-s2/login-config-gating` | ✅ pass | BEHIND (1 benign commit), MERGEABLE |
| 6 | **#283** Email-first progressive disclosure login UX | code | `quill-s2/login-email-first` | ✅ pass | CLEAN; **stacks on #278** (verified: contains #278 tip) |
| 7 | **#284** Login observability + perf budget | code | `worker-g/login-observability-perf-budget` | ✅ pass | CLEAN now; **expect conflicts after #283 lands** |

All 7 show no CI failures (syntax pass; `apply`/Cursor-approval steps skip). Titles verbatim from
GitHub; files touched per PR:

- #277: `dasha-email-login.test.mjs`, `dasha-lobby-worker.mjs`, `dasha-mail-resend-retry.test.mjs`, `dasha-mail-resend.mjs`
- #278: `dasha-lobby-static-gen.mjs`, `dasha-lobby-worker.mjs`, `dasha-login-gating.mjs`, `dasha-login-gating.test.mjs`, `dasha-login-page.html`, `dasha-login-quiet-copy.test.mjs`, `dasha-siwg.test.mjs`
- #283: same as #278 (stacked) + `dasha-login-progressive-disclosure.test.mjs`
- #284: `dasha-lobby-static-gen.mjs`, `dasha-lobby-worker.mjs`, `dasha-login-metrics.mjs`, `dasha-login-metrics.test.mjs`, `dasha-login-page.html`, `dasha-oauth-x-callback-state.test.mjs`, `docs/login-perf-budget.md`
- #279/#280/#281: one new `docs/` file each (zero conflict surface)

## Merge preconditions & conflict notes (in order)

### 1. #281 → merge (docs, easiest win)
- Precondition: click **Update branch** (it's BEHIND by commit 12758ca `#282`, which only
  touched ask/compute files — a benign fast-forward; it still reports MERGEABLE, so this
  is belt-and-braces). Wait for checks green, squash-merge.

### 2. #279 → merge (docs)
- Precondition: refresh the mergeability check — GitHub had not computed it yet
  (`mergeable=UNKNOWN`). It adds a single new file (`docs/sign-in-with-dasha.md`), so
  once computed it should show clean. Merge on green.

### 3. #280 → merge (docs)
- Precondition: same as #279 (`docs/PASSKEY-ENROLLMENT-DESIGN.md`, new file). Merge on green.

### 4. #277 → merge (Resend retry queue)
- Precondition: checks green as-is (✅). No rebase needed.
- Conflict note: **one hunk** in `dasha-lobby-worker.mjs` vs the #278→#283 stack
  (verified by local 3-way merge simulation). Merge #277 **before** the stack so the
  stack's rebase resolves it exactly once, on #278's branch.

### 5. #278 → merge (config-gated login buttons)
- Precondition: rebase onto post-#277 main; resolve the **single** `dasha-lobby-worker.mjs`
  hunk (import block region — keep both sides' additions). Re-run checks, merge.
- Why before #283: #283's branch literally contains #278's tip (stacked) — they must
  land in this order, never reversed.

### 6. #283 → merge (email-first progressive disclosure)
- Precondition: after #278 lands, `git rebase origin/main` on `quill-s2/login-email-first`.
  Expected **conflict-free** (the stack just realigned under it). Re-run checks, merge.
- Smoke after merge: `/login` should show the email-first layout with only configured
  methods. **X OAuth must still work** — run the `dasha-oauth-x-callback-state` tests.

### 7. #284 → merge (observability + perf budget) — LAST
- Precondition: rebase onto post-#283 main. Expect **mechanical conflicts in 3 files**
  (verified by simulation): `dasha-lobby-worker.mjs` (import block ~line 155 and
  `export default` tail ~line 13427 — #283's stack edits the same region), 
...[truncated 2703 chars]
