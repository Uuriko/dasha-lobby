# Login Merge-Train Runbook — for Grok Bot (deploy lane)

**Scope:** 8 open PRs on the dasha-lobby login/sign-in path from the 2026-09-17 waves.
**Owner:** Grok Bot — all live Worker deploys run via `dasha-lobby-wrangler.deploy.jsonc`.
**Written:** 2026-09-17. **Updated:** 2026-09-18 — #289 (faucet revocation fix) inserted at position 4; sections renumbered. Mergeability verified via `gh pr view` + local `git merge-tree`
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

## The 8 PRs and recommended order

Order is chosen to resolve each conflict exactly once, top to bottom. Do not reorder the
stack segment (#278 → #283 → #284).

| # | PR | Type | Branch | CI | Base state vs origin/main |
|---|----|------|--------|----|--------------------------|
| 1 | **#281** Account self-serve design | docs | `quill-s2/account-self-serve-design` | ✅ pass | BEHIND (1 benign commit), MERGEABLE |
| 2 | **#279** "Sign in with Dasha" OAuth-provider design | docs | `quill-s2/sign-in-with-dasha` | ✅ pass | mergeable=UNKNOWN (not yet computed) |
| 3 | **#280** Passkey enrollment design | docs | `quill-s2/passkey-enrollment-design` | ✅ pass | mergeable=UNKNOWN (not yet computed) |
| 4 | **#289** Session hardening + faucet revocation fix (tasks 16/17) | code | `quill-s2/session-hardening` | ✅ pass | CLEAN vs origin/main (verified 2026-09-18; head 16dd915) |
| 5 | **#277** Resend retry queue (failure classification + bounded retry + observability) | code | `quill/resend-retry-queue` | ✅ pass | base 2e7778e; standalone |
| 6 | **#278** Config-gated login method buttons | code | `quill-s2/login-config-gating` | ✅ pass | BEHIND (1 benign commit), MERGEABLE |
| 7 | **#283** Email-first progressive disclosure login UX | code | `quill-s2/login-email-first` | ✅ pass | CLEAN; **stacks on #278** (verified: contains #278 tip) |
| 8 | **#284** Login observability + perf budget | code | `worker-g/login-observability-perf-budget` | ✅ pass | CLEAN vs origin/main; **1 conflicting hunk after #283 lands** (see §8) |

All 8 show no CI failures (syntax pass; `apply`/Cursor-approval steps skip). Titles verbatim from
GitHub; files touched per PR:

- #277: `dasha-email-login.test.mjs`, `dasha-lobby-worker.mjs`, `dasha-mail-resend-retry.test.mjs`, `dasha-mail-resend.mjs`
- #278: `dasha-lobby-static-gen.mjs`, `dasha-lobby-worker.mjs`, `dasha-login-gating.mjs`, `dasha-login-gating.test.mjs`, `dasha-login-page.html`, `dasha-login-quiet-copy.test.mjs`, `dasha-siwg.test.mjs`
- #283: same as #278 (stacked) + `dasha-login-progressive-disclosure.test.mjs`
- #284: `dasha-lobby-static-gen.mjs`, `dasha-lobby-worker.mjs`, `dasha-login-metrics.mjs`, `dasha-login-metrics.test.mjs`, `dasha-login-page.html`, `dasha-oauth-x-callback-state.test.mjs`, `docs/login-perf-budget.md`
- #289: `dasha-lobby-worker.mjs`, `dasha-lobby-x.mjs`, `dasha-session-hardening.test.mjs`, `dasha-lobby-github.mjs`, `dasha-lobby-google.mjs`, `dasha-compute-network.mjs`, `dasha-email-login.test.mjs`, `dasha-compute-api-key-credits-debit.test.mjs`, `dasha-compute-api-key-spend-caps.test.mjs`
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

### 4. #289 → merge (session hardening + faucet revocation fix) — SECURITY
- Precondition: checks green as-is (✅). Merge-tree vs origin/main is **clean** (verified
  2026-09-18; head `16dd915`). No rebase needed; squash-merge.
- Why here: the wave-7 audit found the faucet session-revocation path was **inert** —
  revocations were written only to the lobby DO registry while `/faucet/claim` enforces
  against the faucet DO's own storage, so rotated/logged-out tokens stayed valid until
  TTL. Commit `16dd915` fixes it: the secret-gated `POST /internal/session/revoke`
  endpoint is mounted on **both** DOs (same `x-dasha-internal` gate), revocation fans out
  via `revokeSessionServerSide` to the lobby DO (`public`) + the faucet DO (`main`), and
  the revoked-sid key is normalized (`slice(0,128)` on both write and read).
- Dependency notes: all subsequent train PRs (#277, #278, #283, #284) touch
  `dasha-lobby-worker.mjs`, so they must rebase onto post-#289 main. #289's hunks live
  in the OAuth/logout-handler region (~line 11330) and the DO internals, distinct from
  the login-gating/metrics regions below — expect the rebases to stay mechanical.

### 5. #277 → merge (Resend retry queue)
- Precondition: checks green as-is (✅). Rebase onto post-#289 main first (its
  `dasha-lobby-worker.mjs` hunk region may shift); no manual conflicts expected.
- Conflict note: **one hunk** in `dasha-lobby-worker.mjs` vs the #278→#283 stack
  (verified by local 3-way merge simulation). Merge #277 **before** the stack so the
  stack's rebase resolves it exactly once, on #278's branch.

### 6. #278 → merge (config-gated login buttons)
- Precondition: rebase onto post-#277 main; resolve the **single** `dasha-lobby-worker.mjs`
  hunk (import block region — keep both sides' additions). Re-run checks, merge.
- Why before #283: #283's branch literally contains #278's tip (stacked) — they must
  land in this order, never reversed.

### 7. #283 → merge (email-first progressive disclosure)
- Precondition: after #278 lands, `git rebase origin/main` on `quill-s2/login-email-first`.
  Expected **conflict-free** (the stack just realigned under it). Re-run checks, merge.
- Smoke after merge: `/login` should show the email-first layout with only configured
  methods. **X OAuth must still work** — run the `dasha-oauth-x-callback-state` tests.

### 8. #284 → merge (observability + perf budget) — LAST
- Precondition: rebase onto post-#283 main. Fresh `git merge-tree` simulation
  (2026-09-18, #284 head `a4dccb31` vs #283 head `dbca97f`, merge-base `12758ca`)
  shows exactly **ONE conflicting hunk in ONE file** — not three files as the
  pre-truncation draft of this section guessed. Everything else auto-merges.

**Changed on both sides — clean auto-merge, keep both, no manual action:**
- `dasha-lobby-static-gen.mjs`: #283's email-first copy/template markers
  (`<!--login-method:…-->`, `.more-methods` CSS, new meta description) sit far from
  #284's one-line change (x-connect SRI `__X_CONNECT_SRI__` → `${X_CONNECT_SRI}`);
  no overlap. Merged tree verified to contain both.
- `dasha-login-page.html`: #283's full email-first markup rewrite vs #284's one-line
  `__X_CONNECT_SRI__` → real `sha384-…` hash swap. The hash line re-applies cleanly
  at its new position in the rewritten page (verified in the merged blob).
- `dasha-oauth-x-callback-state.test.mjs`: both sides touched it; auto-merged clean.
- Import block, `dasha-lobby-worker.mjs` (~lines 132–161): #283 replaced the
  `LOGIN_PAGE_HTML` import with
  `import { renderLoginPage } from './dasha-login-gating.mjs';` (lines ~132–140);
  #284 *adds*
  `import { recordLoginEvent, recordWorkerLoginMetric, loginObservedRoute, loginCompletionOutcome } from './dasha-login-metrics.mjs';`
  ~20 lines lower (~155–161). Adjacent but non-overlapping — git keeps both.
- `export default` tail (~line 13427): no conflict; both sides' edits land in
  distinct statements.

**New files from #284 (zero conflict surface):** `dasha-login-metrics.mjs`,
`dasha-login-metrics.test.mjs`, `docs/login-perf-budget.md`.

**The one conflict — `dasha-lobby-worker.mjs`, `/login` route handler in
`productEdge` (~line 12068):**

```js
<<<<<<< post-#283 main
      return loginPageResponse(request, env);
=======
      const t0 = Date.now();
      const res = loginPageResponse(request);
      // Best-effort page-view latency (theme e, perf budget). Not awaited so
      // the static page stays fast; terminal login events above are awaited.
      recordWorkerLoginMetric(env, {
        method: 'login', route: 'page', outcome: 'view', latencyMs: Date.now() - t0,
      }).catch(() => {});
      return res;
>>>>>>> #284
```

- **Resolution (keep both sides):** keep #284's timing wrapper *and* #283's `env`
  argument (the gated renderer needs `env`; dropping it re-introduces the dead-button
  bug class from task #1). Resolved hunk:
```js
      const t0 = Date.now();
      const res = loginPageResponse(request, env);
      // Best-effort page-view latency (theme e, perf budget). Not awaited so
      // the static page stays fast; terminal login events above are awaited.
      recordWorkerLoginMetric(env, {
        method: 'login', route: 'page', outcome: 'view', latencyMs: Date.now() - t0,
      }).catch(() => {});
      return res;
```
- After resolving, re-run checks (`dasha-login-metrics`, `dasha-oauth-x-callback-state`,
  `dasha-login-gating` suites), then squash-merge.

## ✅ Runbook gap resolved (2026-09-18)

The `...[truncated 2703 chars]` artifact that cut §8 mid-sentence in the original
commit (`0f0a01a`) has been re-authored from a fresh `git merge-tree` simulation
(#284 head `a4dccb31` vs #283 head `dbca97f`, merge-base `12758ca` on origin/main).
Correction vs the pre-truncation draft: it predicted "mechanical conflicts in 3 files"
(import block ~line 155, `export default` tail ~line 13427) — the fresh simulation
shows those merge cleanly; the single real conflict is the `/login` route-handler
hunk documented above. Other runbook sections were checked for similar truncation
damage: none found.
