# Graham OCM integrate — 2026-09-04

**Locks:** Ask-first · no #44+#76 merge · no CloudAgent rewrite of `ocm/` · no Designer / plugin.jup.ag / honesty lectures · no fake Macs.

## What Graham shipped (live / PRs)

- **#44** @mlgraham — OCM full stack (separate lane; do **not** merge with #76).
- Last Graham commits ~2026-09-01 on the OCM surface:
  - Provider guide as a **sequence** (install / verify / doctor / rotate).
  - Mobile table wrap + `html{-webkit-text-size-adjust:100%}` (text inflate fix).
  - Header-only tokens on console.
  - Stdin token rotate (`printf … | ocm-agent-token`) — never argv.
- Live **`ocm.getdasha.com`**: `GET /healthz` → `{ok:true,service:ocm-gateway,hosts:2}`.
- Polished **`/provider`** (~13KB) sequence guide, also reachable on-domain via proxy:
  - `https://www.getdasha.com/compute/ocm/provider`
- Installer remains on **`api.ocm.getdasha.com/install.sh`** (+ `.sha256`); proxy also serves `/compute/ocm/install.sh` when linked.

## What we took live NOW (ship tree `/workspace/dasha-ship-src`)

| Piece | Where | Notes |
|---|---|---|
| Quiet **Host** door | Ask `.ask-doors` | Provide · Marketplace · Host → `/compute/ocm/provider`. One word. No essays. |
| OCM path proxy | `dasha-compute-ocm-proxy.mjs` | Already rewrites HTML href/src/action, Location, Set-Cookie Path=`/compute/ocm`. Proved `/`, `/provider`, `/healthz`, `install.sh`. |
| CSS borrow | `/compute` page | `html{-webkit-text-size-adjust:100%;text-size-adjust:100%}` |
| Pasteable skill | `/compute/skill/ocm-host.md` | Short Dasha-tone skill from Graham’s “Setting this up with an AI agent” paste. Copy button stays on Graham’s provider page; Ask only links Host. |
| Docs | this file + ASK-FIRST.md | Quiet doors = three links max. |

## What stays on the #76 merge lane

- **#76** stabilization (merge target) + **#131** token-off-argv on the #76 stack.
- Do **not** merge #44 and #76 both into desk / lobby worker as competing OCM trees.
- Do **not** rewrite Graham’s `ocm/` repo via CloudAgent.
- Deeper console / gateway / agent changes land when #76 (and follow-ons) are ready — not via compute Ask chrome.

## Prove checklist

- [ ] Ask doors: Provide · Marketplace · Host
- [ ] `GET /compute/ocm` 200 · `GET /compute/ocm/provider` 200 · `GET /compute/ocm/healthz` 200 hosts≥1
- [ ] `GET /compute/skill/ocm-host.md` 200 markdown
- [ ] Canary + `DASHA_SHIP_SKIP_CLAIMS=1 wrangler deploy --keep-vars -c dasha-lobby-wrangler.deploy.jsonc`

## Shipped this turn

- **Worker version:** `4be38fa6-c483-4f25-bf38-0694cf88bf24` (was Ask-first ~`5dfa9dd2` / later `69e1c3a5`…; this deploy 2026-09-04 ~06:49 PT)
- **Doors live:** Provide · Marketplace · Host
- **Proxy prove:** `/compute/ocm` 200 · `/compute/ocm/provider` 200 (~13KB) · `/compute/ocm/healthz` 200 hosts:2 · `/compute/ocm/install.sh` 200
- **Skill:** `/compute/skill/ocm-host.md` 200
- **CSS:** `-webkit-text-size-adjust:100%` on `/compute`
- **Tests:** typeform-first-paint · ocm-proxy · skills · less-is-more · unified-first-paint · canary-contract
- **Blockers:** none. #44+#76 still unmerged by design; Graham `ocm/` untouched.
