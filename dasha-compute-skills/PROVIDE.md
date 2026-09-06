# Skill: Join Dasha Compute as a Provider (Mac)

Paste this into your AI coding assistant (Cursor, Claude, ChatGPT, etc.). It should set up your Mac to Provide compute for https://www.getdasha.com/compute.

## Goal
Register this Mac on the live Dasha community network, install Ollama + the Dasha provider kit, keep a small model hot, and pass doctor so providers_online includes you.

## Facts (do not invent others)
- Product: https://www.getdasha.com/compute (gate-first (Start.); Provide via gate, quiet Ask link, or #provide)
- Coordinator: https://lobby.getdasha.com/compute/api
- Kit: https://www.getdasha.com/dasha-compute-open-alpha.tar.gz
- Prefer sub-24GB chat models: qwen3:8b or gemma3:12b (map qwen3-8b=qwen3:8b)
- Token goes in `.dasha-provider-key` mode 0600 — never put the provider key on argv or shell history
- Official Telegram: https://t.me/+xB7S8mIQaKFiZjRh
- Do not send secrets in prompts. Operators can read jobs assigned to this Mac.
- Pay (community jobs): $0.05/job + $0.01/1k completion tokens · min $1 payout · pending settle (operator/treasury) · $dasha payout +10% · never invent balances

## Steps for the AI to run with the human
1. Open https://www.getdasha.com/compute → Provide (quiet link) → name the Mac → Sign in (X) if needed → Register.
2. After Register, copy the Setup command on the page (token, provider_id, and coordinator URL are already filled). Shown once — refresh loses it. Prefer that block over this template.
3. On the Mac, run the Setup command — or this template with the pasted values:

```bash
curl -fLO https://www.getdasha.com/dasha-compute-open-alpha.tar.gz
tar -xzf dasha-compute-open-alpha.tar.gz
cd dasha-compute-open-alpha
# install Ollama from https://ollama.com/download if missing
ollama pull qwen3:8b
umask 077
cat > .dasha-provider-key <<'TOKEN'
PASTE_ONE_TIME_TOKEN_HERE
TOKEN
chmod 0600 .dasha-provider-key
DASHA_COORDINATOR_URL=https://lobby.getdasha.com/compute/api \
DASHA_PROVIDER_ID=PASTE_PROVIDER_ID_HERE \
DASHA_MODEL_MAP=qwen3-8b=qwen3:8b \
./install.sh
```

4. Verify after install (`install.sh` already ran doctor and moved the key):

```bash
dasha-compute doctor
dasha-compute status
```

5. Confirm on https://www.getdasha.com/compute that community shows a Mac online (heartbeat can take about a minute).

## Prefer MLX (Apple Silicon, optional)
- Prefer MLX when you can — often faster on Apple Silicon; Ollama still works.
- Recommend Ollama ≥0.33.1 on Mac providers (doctor soft-warns if older; never fails solely for an older build). Do not invent kit env vars for MLX.
- Keep models on internal SSD — slow/external storage risks Metal timeouts (Ollama 0.33.1 notes).
- Official Ollama path (live docs): Ollama ≥0.33.1 + models tagged `*-mlx` (example: `gemma4:12b-mlx`). Doctor prints an engine/MLX badge when a structured-output-capable MLX build is detected.
- Else quiet note: for speed, LM Studio MLX server or `mlx_lm`; keep mapped Ollama chat models so Dasha heartbeats still work.
- `dasha-compute doctor` prints a soft `mlx` hint when detectable; never fails solely for missing MLX.
- After install, `dasha-compute benchmark` writes measured tok/s; doctor soft-hints if missing. Ask shows measured tok/s only when heartbeats include benchmarks — never invent.
- Stay on sub-24GB chat (qwen3:8b / gemma3:12b). Do not require a 36GB bar.

## Keep-alive (sub-24GB)
- Keep the chat model loaded via Ollama service keep-alive (OLLAMA_KEEP_ALIVE=-1 on the launch agent / service — a shell export alone is not enough for the macOS app).
- Do not pin 27B on a 16–24GB Air for interactive chat; use 8B/12B.

## Success
- dasha-compute doctor exits 0
- Heartbeats succeed
- A Community Run from another session can complete on this Mac

## If stuck
- Re-register for a fresh token
- Check dasha-compute logs
- Ensure outbound HTTPS to lobby.getdasha.com works (no inbound ports required)
