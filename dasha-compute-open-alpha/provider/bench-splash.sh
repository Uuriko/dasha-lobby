#!/bin/sh
# bench-splash.sh — one-command Splash vs Ollama decode benchmark for a provider Mac.
#
# Serves the same prompt through the Splash engine and the Ollama path on this
# Mac, reports tokens/sec for each, and writes a JSON result file.
#
# Usage:
#   ./bench-splash.sh [--package incoai/Qwen3.8-27B-Splash] [--port 8000]
#                     [--ollama-model qwen3:8b] [--tokens 256]
#                     [--prompt "text"] [--out result.json] [--no-cleanup]
#
# Requirements: macOS on Apple Silicon M3+, 36 GB+ unified memory, macOS 26.4+,
# `splash` on PATH (brew install incoai/tap/splash), Ollama on 127.0.0.1:11434.
# If Splash is already serving the package on --port, it is reused (no relaunch).
#
# Notes on fairness: the two engines serve different models (Splash only ships
# its own packages), so this compares engine paths, not identical weights.
# Splash runs with reasoning_effort=none so the number is pure decode speed.
set -eu

PACKAGE="incoai/Qwen3.8-27B-Splash"
PORT="8000"
OLLAMA_MODEL="qwen3:8b"
TOKENS="256"
PROMPT="In one paragraph, explain why local AI compute is useful for developers."
OUT=""
NO_CLEANUP="0"
SPLASH_STARTED="0"
SPLASH_PID=""

usage() {
  sed -n '2,20p' "$0"
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --package) PACKAGE="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --ollama-model) OLLAMA_MODEL="$2"; shift 2;;
    --tokens) TOKENS="$2"; shift 2;;
    --prompt) PROMPT="$2"; shift 2;;
    --out) OUT="$2"; shift 2;;
    --no-cleanup) NO_CLEANUP="1"; shift;;
    -h|--help) usage 0;;
    *) echo "unknown flag: $1" >&2; usage 2;;
  esac
done

fail() { echo "bench-splash: $*" >&2; exit 1; }

command -v curl >/dev/null || fail "curl is required"
command -v python3 >/dev/null || fail "python3 is required"

# --- capability gate -------------------------------------------------------
[ "$(uname -s)" = "Darwin" ] || fail "macOS required (this host: $(uname -s))"
BRAND="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || true)"
MNUM="$(printf '%s' "$BRAND" | sed -n 's/.*M\([0-9][0-9]*\).*/\1/p' | head -1)"
[ -n "$MNUM" ] && [ "$MNUM" -ge 3 ] || fail "Apple M3 or newer required (detected: ${BRAND:-unknown})"
MEMGB="$(python3 -c 'import os; print(round(os.sysconf("SC_PAGE_SIZE")*os.sysconf("SC_PHYS_PAGES")/1024**3,1))')"
python3 -c "import sys; sys.exit(0 if float('$MEMGB') >= 36 else 1)" || fail "36 GB+ unified memory required (detected: ${MEMGB} GB)"
MACOS_VER="$(sw_vers -productVersion 2>/dev/null || true)"
python3 -c "
import sys, re
m = re.search(r'(\d+)\.(\d+)', '$MACOS_VER')
sys.exit(0 if m and (int(m.group(1)), int(m.group(2))) >= (26, 4) else 1)" || fail "macOS 26.4+ required (detected: ${MACOS_VER:-unknown})"
command -v splash >/dev/null || fail "\`splash\` not on PATH — install: brew install incoai/tap/splash"
curl -sf -m 5 "http://127.0.0.1:11434/api/version" >/dev/null || fail "Ollama is not answering on 127.0.0.1:11434 — start Ollama first"

echo "bench-splash · $BRAND · ${MEMGB} GB · macOS $MACOS_VER"
echo "bench-splash · splash package: $PACKAGE (port $PORT) · ollama model: $OLLAMA_MODEL · $TOKENS tokens"

BASE="http://127.0.0.1:$PORT"
if curl -sf -m 5 "$BASE/v1/models" >/dev/null 2>&1; then
  echo "bench-splash · Splash already serving on port $PORT — reusing"
else
  LOG="/tmp/bench-splash-$PORT.log"
  echo "bench-splash · starting \`splash serve\` (first run downloads ~17-21 GB; log: $LOG)"
  if [ -n "${SPLASH_API_KEY:-}" ]; then
    splash serve --model "$PACKAGE" --port "$PORT" --no-webui --api-key "$SPLASH_API_KEY" >"$LOG" 2>&1 &
  else
    splash serve --model "$PACKAGE" --port "$PORT" --no-webui >"$LOG" 2>&1 &
  fi
  SPLASH_PID="$!"
  SPLASH_STARTED="1"
  echo "bench-splash · waiting for readiness"
  READY="0"
  for _ in $(seq 1 180); do
    if curl -sf -m 5 "$BASE/v1/models" >/dev/null 2>&1; then READY="1"; break; fi
    if ! kill -0 "$SPLASH_PID" 2>/dev/null; then fail "splash serve exited during startup — see $LOG"; fi
    sleep 10
    printf '.'; 
  done
  echo ""
  [ "$READY" = "1" ] || fail "Splash not ready after 30 min — see $LOG"
fi

cleanup() {
  if [ "$SPLASH_STARTED" = "1" ] && [ "$NO_CLEANUP" = "0" ] && [ -n "$SPLASH_PID" ]; then
    echo "bench-splash · stopping splash (pid $SPLASH_PID)"
    kill "$SPLASH_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

AUTH_HEADER="${SPLASH_API_KEY:+Authorization: Bearer $SPLASH_API_KEY}"

# One timed non-streaming run through an OpenAI-compatible /v1/chat/completions.
run_splash() {
  AUTH="$AUTH_HEADER" python3 - "$BASE" "$PACKAGE" "$PROMPT" "$TOKENS" <<'EOF'
import json, os, sys, time, urllib.request
base, package, prompt, tokens = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
body = {"model": package,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": tokens, "stream": False, "temperature": 0,
        "reasoning_effort": "none"}
headers = {"Content-Type": "application/json"}
if os.environ.get("AUTH"):
    headers["Authorization"] = os.environ["AUTH"]
req = urllib.request.Request(base + "/v1/chat/completions", data=json.dumps(body).encode(), headers=headers, method="POST")
start = time.monotonic()
with urllib.request.urlopen(req, timeout=900) as r:
    data = json.loads(r.read().decode())
elapsed = time.monotonic() - start
comp = int((data.get("usage") or {}).get("completion_tokens") or 0)
print(json.dumps({"completion_tokens": comp, "seconds": round(elapsed, 3),
                  "tokens_per_second": round(comp / elapsed, 2) if elapsed > 0 else 0}))
EOF
}

# One timed non-streaming run through Ollama /api/chat.
run_ollama() {
  python3 - "$OLLAMA_MODEL" "$PROMPT" "$TOKENS" <<'EOF'
import json, sys, time, urllib.request
model, prompt, tokens = sys.argv[1], sys.argv[2], int(sys.argv[3])
body = {"model": model, "messages": [{"role": "user", "content": prompt}], "stream": False,
        "options": {"num_predict": tokens, "temperature": 0}}
req = urllib.request.Request("http://127.0.0.1:11434/api/chat", data=json.dumps(body).encode(),
                             headers={"Content-Type": "application/json"}, method="POST")
start = time.monotonic()
with urllib.request.urlopen(req, timeout=900) as r:
    data = json.loads(r.read().decode())
elapsed = time.monotonic() - start
comp = int(data.get("eval_count") or 0)
dur = int(data.get("eval_duration") or 0) / 1e9
div = dur if dur > 0 else elapsed
print(json.dumps({"completion_tokens": comp, "seconds": round(elapsed, 3),
                  "tokens_per_second": round(comp / div, 2) if div > 0 else 0}))
EOF
}

echo "bench-splash · warmup run (untimed)…"
run_splash >/dev/null || fail "Splash warmup request failed"
run_ollama >/dev/null || fail "Ollama warmup request failed (is $OLLAMA_MODEL pulled?)"

echo "bench-splash · measured run: splash…"
SPLASH_JSON="$(run_splash)" || fail "Splash measured request failed"
echo "bench-splash · measured run: ollama ($OLLAMA_MODEL)…"
OLLAMA_JSON="$(run_ollama)" || fail "Ollama measured request failed"

STAMP="$(date +%Y%m%d-%H%M%S)"
[ -n "$OUT" ] || OUT="bench-splash-$STAMP.json"
python3 - "$OUT" "$STAMP" "$BRAND" "$MEMGB" "$MACOS_VER" "$PACKAGE" "$PORT" "$OLLAMA_MODEL" "$PROMPT" "$TOKENS" "$SPLASH_JSON" "$OLLAMA_JSON" <<'EOF'
import json, sys
out, stamp, brand, memgb, macos, package, port, ollama_model, prompt, tokens, splash_json, ollama_json = sys.argv[1:]
splash = json.loads(splash_json); ollama = json.loads(ollama_json)
report = {
    "measured_at": stamp,
    "hardware": {"chip": brand, "memory_gb": float(memgb), "macos": macos},
    "prompt": prompt, "max_tokens": int(tokens),
    "notes": "splash ran with reasoning_effort=none; one untimed warmup per engine before the measured run",
    "results": [
        {"engine": "splash", "package": package, "port": int(port),
         "completion_tokens": splash["completion_tokens"], "seconds": splash["seconds"],
         "tokens_per_second": splash["tokens_per_second"]},
        {"engine": "ollama", "model": ollama_model,
         "completion_tokens": ollama["completion_tokens"], "seconds": ollama["seconds"],
         "tokens_per_second": ollama["tokens_per_second"]},
    ],
}
with open(out, "w") as f:
    json.dump(report, f, indent=2)
s, o = splash["tokens_per_second"], ollama["tokens_per_second"]
print(f"engine   model/package                    tok/s")
print(f"splash   {package[:32]:<32} {s}")
print(f"ollama   {ollama_model:<32} {o}")
if o > 0:
    print(f"splash vs ollama: {s / o:.2f}x")
print(f"wrote {out}")
EOF
