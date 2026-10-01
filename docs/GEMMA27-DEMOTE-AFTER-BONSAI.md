# Demote gemma3-27b after Bonsai live

> **merge after bonsai live**

**Gate:** only merge/ship once `ternary-bonsai-2-27b` appears on live `/compute/api/network` **and** Instinct has tipped #248 allowlist.

## Live check (2026-09-17 ~5:50 PM PT)
`providers_online=1` and `models_available` already includes `ternary-bonsai-2-27b` (~13.52 tok/s) **and** `gemma3-27b` (~6.64 tok/s). Network gate is green; wait Instinct tip before merging demote code.

## Why
Mac ~24GB RAM. gemma3-27b (~6.6 tok/s) fights Bonsai 2 27B (~13.5 tok/s local). Keep qwen3-4b/8b + gemma3-12b + bonsai as Quality.

## Change (follow-up commit after tip)
1. Ask `#ask-model` / MODELS picker: hide/demote `gemma3-27b` from default list.
2. Prefer online default: `ternary-bonsai-2-27b` over `gemma3-27b` when both advertised.
3. Keep MODELS allowlist entry if a provider still maps gemma3-27b.
4. Honesty copy: Speed=qwen4b · Mid=qwen8b/gemma12b · Quality=bonsai.
5. Tests: SUB24 unchanged; bonsai Community; gpt-oss-20b Hosted floor; skill copy no longer prefers gemma3-27b.

## Stay-outs
No Instinct Phase 0 · no Quill · no Muse UI · no direct wrangler · no plugin.jup.ag.
