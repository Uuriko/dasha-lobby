# SSR Mac pending honesty — applied

Branch: `grok/ssr-mac-pending-honesty-20260917`

## Root cause
SSR + JS first paint claimed **No Mac online** while `providers_online` was still unknown (init `0`, paint before `/compute/api/network`). Live can show offline copy with `providers_online=1` until hydrate.

## Fix
- SSR placeholders → `…` + `data-ssr-mac="pending"`
- `providersOnline=null` until network stamps an integer
- paintBuyerLiveLine / presence / honesty-macs / nightH1 respect pending
- auth: failed network fetch leaves null (no false offline)

## On this branch
- `dasha-compute-page.mjs` ↔ `dasha-compute.html` embed sync
- Tests: `dasha-compute-honesty-panel.test.mjs`, `dasha-compute-buyer-live-models.test.mjs`, `dasha-compute-presence-act-tape.test.mjs`

```bash
node dasha-compute-honesty-panel.test.mjs
node dasha-compute-buyer-live-models.test.mjs
node dasha-compute-presence-act-tape.test.mjs
```

## Stay-outs
No wrangler · no Quill · no Muse IA · no Phase 0 · no plugin.jup.ag
