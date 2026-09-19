# Skill: Join Dasha Compute as a Provider (Mac)

Paste this into your AI coding assistant (Cursor, Claude, ChatGPT, etc.). It should set up your Mac to Provide compute for https://www.getdasha.com/compute.

## Goal
Register this Mac on the live Dasha community network, install Ollama + the Dasha provider kit, keep a small model hot, and pass doctor so providers_online includes you.

## Facts (do not invent others)
- Product: https://www.getdasha.com/compute (gate-first (Start.); Provide via gate, quiet Ask link, or #provide)
- Coordinator: https://lobby.getdasha.com/compute/api
- Kit: https://www.getdasha.com/dasha-compute-open-alpha.tar.gz
- Prefer sub-24GB chat models: qwen3:4b (fast), qwen3:8b, or gemma3:12b (map qwen3-4b=qwen3:4b,qwen3-8b=qwen3:8b)
- Token goes in `.dasha-provider-key` mode 0600 — never put the provider key on argv or shell history
- Official Telegram: https://t.me/+ck9pUjL2ncNiZjRh (the only official Dasha invite - ignore lookalike groups)
- Do not send secrets in prompts. Operators can read jobs assigned to this Mac.
- Pay (community jobs): $0.05/job + $0.01/1k completion tokens · min $1 payout · pending operator settle · not auto · $dasha payout +5% · never invent balances

## Steps for the AI to run with the human
1. Open https://www.getdasha.com/compute → Provide (quiet link) → name the Mac → Sign in (X) if needed → Register.
2. After Register, copy the Setup command on the page (token, provider_id, and coordinator URL are already filled). Shown once — refresh loses it. Prefer that block over this template.
3. On the Mac, run the Setup command — or this template with the pasted values:

```bash
curl -fLO https://www.getdasha.com/dasha-compute-open-alpha.tar.gz
tar -xzf dasha-compute-open-alpha.tar.gz
cd dasha-compute-open-alpha
# install Ollama from https://ollama.com/download if missing
ollama pull qwen3:4b
ollama pull qwen3:8b
umask 077
cat > .dasha-provider-key <<'TOKEN'
PASTE_ONE_TIME_TOKEN_HERE
TOKEN
chmod 0600 .dasha-provider-key
DASHA_COORDINATOR_URL=https://lobby.getdasha.com/compute/api \
DASHA_PROVIDER_ID=PASTE_PROVIDER_ID_HERE \
DASHA_MODEL_MAP=qwen3-4b=qwen3:4b,qwen3-8b=qwen3:8b \
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
- Stay on sub-24GB chat (qwen3:4b / qwen3:8b / gemma3:12b). Do not require a 36GB bar.

## Splash engine (beta, opt-in)

- Splash (github.com/incoai/splash, Apache-2.0) is an opt-in high-performance engine for high-end Macs. It does **not** replace Ollama/MLX — map it only for the models it serves.
- **Hardware floor:** Apple M3 or newer, **36 GB+** unified memory, **macOS 26.4+**. Doctor soft-reports the gate; never fails solely for missing Splash.
- **Supported packages (Splash-format only — plain GGUF/MLX checkpoints do not work):**
  - `incoai/Qwen3.8-27B-Splash` (~17.4 GB) → map `qwen3.8-27b=splash:incoai/Qwen3.8-27B-Splash`
  - `incoai/Qwen3.6-35B-A3B-Splash` (~20.9 GB) → map `qwen3.6-35b=splash:incoai/Qwen3.6-35B-A3B-Splash`
- Install: `brew install incoai/tap/splash`. The agent launches and supervises `splash serve` (one process per model, ports 8000+), waits for readiness, and shuts it down on exit. First run downloads the package (~17–21 GB).
- Map syntax: `public=splash:owner/repo` or `public=splash:owner/repo:8001` for an explicit port. The heartbeat advertises `engine: splash` so the network can badge Splash-accelerated providers.
- Optional auth: set `DASHA_SPLASH_API_KEY` (also accepted: `SPLASH_API_KEY`) — passed as `--api-key` to `splash serve`. Without it, Splash serves without auth on 127.0.0.1 only.
- Reasoning is off by default for parity with the Ollama path (`reasoning_effort=none`); override with `DASHA_SPLASH_REASONING_EFFORT=none|low|medium|xhigh`.
- **Beta — no speed claims yet:** do not quote vendor tok/s figures. Run `provider/bench-splash.sh` on your Mac to measure Splash vs Ollama on the same prompt; it writes a JSON result.
- Graceful fallback: if the gate fails or Splash won't start, the mapping is simply not advertised — existing Ollama/MLX mappings keep working.

## Host power / thermal / SIP (soft)
- `dasha-compute doctor` soft-warns when on battery, Low Power Mode, elevated thermal pressure, or SIP disabled/unreadable (Darwin best-effort).
- Never fails solely for battery / AC / Low Power / thermal / SIP.
- Local OS health only — never claims Secure Enclave, TEE, Nitro, or network `sip_enabled` attestation.

## Keep-alive (sub-24GB)
- Keep the chat model loaded via Ollama service keep-alive (OLLAMA_KEEP_ALIVE=-1 on the launch agent / service — a shell export alone is not enough for the macOS app).
- A sleeping Mac is offline to buyers: the agent holds `caffeinate -is` while it runs (system sleep prevented on AC; battery can still sleep). For an always-on server Mac, also `sudo pmset -a sleep 0`. Doctor soft-warns when system sleep is enabled.
- Do not pin 27B on a 16–24GB Air for interactive chat; use 4B/8B/12B.
- `dasha-compute doctor` soft-hints when a mapped model looks ≥27B, and when mapped chat is cold in Ollama `/api/ps` (keep-alive). Never fails solely for size or keep-alive.
- Advertising/heartbeat OK while mid-Ask fails with `provider inference failed: URLError` → localhost Ollama on `127.0.0.1:11434` was refused/reset. Soft doctor does not block advertise alone — fix Ollama keep-alive / restart service.

## Success
- dasha-compute doctor exits 0
- Heartbeats succeed
- A Community Run from another session can complete on this Mac

## If stuck
- Re-register for a fresh token
- Check dasha-compute logs
- Ensure outbound HTTPS to lobby.getdasha.com works (no inbound ports required)
- Mid-Ask `URLError` / partial stream while still online → `curl -sS http://127.0.0.1:11434/api/ps` (and `/api/tags`); set OLLAMA_KEEP_ALIVE=-1 on the Ollama launch agent; restart Ollama; re-run `dasha-compute doctor` (keepalive soft is OK — exit should still be 0)
