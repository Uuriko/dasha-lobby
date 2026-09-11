# Skill: Use Dasha Compute (run a prompt)

Paste this into your AI assistant so it can help you run https://www.getdasha.com/compute — Hosted demo or community Macs — without becoming a provider.

## Goal
Get a working answer from Dasha Compute: Hosted (Cloudflare Workers AI) or Community/Mixture (Macs), including queue-when-no-Mac.

## Facts
- URL: https://www.getdasha.com/compute
- Flow is Typeform-style: cold boot → Start. (Do / Provide / Pay / Credits). Do → Community when a Mac is advertising · else Hosted · quiet Provide / Marketplace / Host · Change engine for Hosted/Community/Mixture · model if community → Run. Pay → Top up (USDC / $dasha) / Sponsor (tip USDC / $dasha; wallet OK without login · quiet named tip credits when signed in). Credits → balance + Use credits / Top up. No card yet.
- Login with X is required to Run or queue
- Hosted model: gpt-oss-20b · 3 free / 10 min · then credits
- API base (power users): https://lobby.getdasha.com/compute/api/v1
- API billing: non-self `v1/chat/completions` spends prepaid credits via USDC/$dasha ($0.05/job); self-route (own Mac) free; key spend cap is runaway protection — not a free allowance. Top up via Pay / Credits · no card.
- API usage: OpenAI-style `usage` on non-stream JSON and on the SSE final `finish_reason=stop` chunk (v1 chat/completions + Hosted Ask). `GET /compute/api/jobs/:id` returns stored `usage` (+ `route`) when present — never invent tokens. See `GET /compute/api/v1` → `usage`.
- Marketplace: https://www.getdasha.com/compute/ocm
- Which key / which base: Compute chat uses `dsk_` or guest `dgk_` on https://lobby.getdasha.com/compute/api/v1. OCM uses `ocm_live_` on https://www.getdasha.com/compute/ocm/v1. Never swap. Compute X login is not an OCM session.
- Do not paste secrets into prompts. Community Mac operators can read assigned prompts.
- Community Macs: Prefer MLX when you can (providers) · Ollama ≥0.33.1 · models on internal SSD; Ollama still works.
- Do top-state shows measured tok/s only when network capacity has benchmarks — never invent speed.
- When Macs are online, Do defaults to Community and the live advertised model (prefer gemma3-27b). Hosted stays a quieter door. Explicit Hosted click stays Hosted. Change engine still opens How.

## Steps for the AI to guide
1. Open https://www.getdasha.com/compute
2. Cold boot shows Start. — Do → Community when a Mac is up, else Hosted. Pay → Pay. (Top up → Buy (amount+method) → Send · Sponsor → Amount → Send). Credits → Credits. (Use credits → Do · Top up → Buy). Optional on Do: quiet starter chips (Write code / Fix a bug / Do the thing) fill the prompt; empty input is Message Dasha; after a reply the thread stays and Enter sends a follow-up; Change engine for Hosted, Community, or Mixture; quiet Provide / Marketplace / Host links
3. If Community/Mixture: pick a model that matches what is online (prefer qwen3-4b / qwen3-8b / gemma3-12b for Mixture)
4. Sign in if prompted
5. Type a prompt → Run (Enter). Keyboard: 1–4 choices · Esc Back
6. If no Mac is online on Community/Mixture: Hosted or Queue. If Mixture is empty but Community has Macs, Night offers Community · N (honest capacity) — Hosted stays available

## Optional API

```bash
export DASHA_API_KEY='your-key'
curl https://lobby.getdasha.com/compute/api/v1/chat/completions \
  -H "Authorization: Bearer $DASHA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3-8b","messages":[{"role":"user","content":"hello"}],"stream":true}'
```

## Success
- Streamed or complete answer appears, or the job is queued until a Mac heartbeats
- On stream, read `usage` from the final stop chunk (not earlier deltas)

## If stuck
- Hard-refresh, confirm login, switch to Hosted if community shows 0 Macs
- Telegram: https://t.me/+xB7S8mIQaKFiZjRh
