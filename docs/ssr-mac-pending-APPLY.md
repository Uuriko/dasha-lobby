# SSR Mac pending honesty — apply remaining files

Branch: `grok/ssr-mac-pending-honesty-20260917`

## Root cause
SSR + JS first paint claimed **No Mac online** while `providers_online` was still unknown (init `0`, paint before `/compute/api/network`). Live can show offline copy with `providers_online=1` until hydrate.

## Fix (local proven)
- SSR placeholders → `…` + `data-ssr-mac="pending"`
- `providersOnline=null` until network stamps an integer
- paintBuyerLiveLine / presence / honesty-macs / nightH1 respect pending
- auth: failed network fetch leaves null (no false offline)
- Tests: honesty-panel, buyer-live-models, presence-act-tape **PASS** locally

## Apply (Contents:write / CloudAgent)
Box paths (Wave1 executor):
- `/workspace/ssr-pr-prep/args-ssr-mac-pending-page.json` → `dasha-compute-page.mjs` (sha was `0919646…` on branch tip before page update)
- `/workspace/ssr-pr-prep/args-ssr-mac-pending-html.json` → `dasha-compute.html`
- `/workspace/ssr-pr-prep/args-buyer.json` + honesty test on disk under `/tmp/dasha-lobby-audit/`
- Patch: `/workspace/ssr-pr-prep/ssr-mac-pending.patch`

Or copy from local commit `d47421f` on the box clone `/tmp/dasha-lobby-audit`.

## Stay-outs
No wrangler · no Quill · no Muse IA · no Phase 0 · no plugin.jup.ag
