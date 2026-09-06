# Skill: Use Dasha Compute (ask the network)

Paste this into your AI assistant so it can help you ask https://www.getdasha.com/compute — Hosted demo or community Macs — without becoming a provider.

## Goal
Get a working answer from Dasha Compute: Hosted (Cloudflare Workers AI) or Community/Mixture (Macs), including queue-when-no-Mac.

## Facts
- URL: https://www.getdasha.com/compute
- Flow is Typeform-style: cold boot → Start. (Ask / Provide / Pay / Credits). Ask → Hosted Ask · quiet Provide / Marketplace / Host · Change engine for Community/Mixture · model if community → Run. Pay → Top up (USDC / $dasha) / Sponsor (tip USDC / $dasha). Credits → balance + Use credits / Top up. No card yet.
- Login with X is required to Run or queue
- Hosted model: gpt-oss-20b · 3 free / 10 min · then credits
- API base (power users): https://lobby.getdasha.com/compute/api/v1
- Marketplace: https://www.getdasha.com/compute/ocm
- Do not paste secrets into prompts. Community Mac operators can read assigned prompts.
- Community Macs: Prefer MLX when you can (providers) · Ollama ≥0.33.1 · models on internal SSD; Ollama still works.
- Ask top-state shows measured tok/s only when network capacity has benchmarks — never invent speed.

## Steps for the AI to guide
1. Open https://www.getdasha.com/compute
2. Cold boot shows Start. — Ask → Hosted Ask. Pay → Pay. (Top up → Buy (amount+method) → Send · Sponsor → Amount → Send). Credits → Credits. (Use credits → Ask · Top up → Buy). Optional on Ask: quiet starter chips (Welcome note / Summarize this / Draft a curl) fill the prompt; Change engine for Community or Mixture; quiet Provide / Marketplace / Host links
3. If Community/Mixture: pick a model that matches what is online (prefer qwen3-8b / gemma3-12b for Mixture)
4. Sign in if prompted
5. Type a prompt → Run (Enter). Keyboard: 1–4 choices · Esc Back
6. If no Mac is online on Community/Mixture: Hosted or Queue

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

## If stuck
- Hard-refresh, confirm login, switch to Hosted if community shows 0 Macs
- Telegram: https://t.me/+xB7S8mIQaKFiZjRh
