#!/usr/bin/env python3
"""Dasha Compute v0.3 provider: outbound polling and Ollama inference."""

import argparse
import re
import json
import os
import platform
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

COORDINATOR = os.getenv("DASHA_COORDINATOR_URL", "http://127.0.0.1:8787").rstrip("/")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
KEYCHAIN_SERVICE = "com.getdasha.compute.provider"


def load_key_file():
    path = os.getenv("DASHA_PROVIDER_KEY_FILE") or ".dasha-provider-key"
    try:
        with open(path, encoding="utf-8") as source:
            value = "".join(source.read().split())
        if value:
            return value
    except OSError:
        pass
    return ""


def load_keychain():
    if platform.system() != "Darwin":
        return ""
    account = os.getenv("DASHA_PROVIDER_ID")
    if not account:
        return ""
    try:
        result = subprocess.run(
            ["/usr/bin/security", "find-generic-password", "-a", account, "-s", KEYCHAIN_SERVICE, "-w"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except OSError:
        return ""
    if result.returncode != 0:
        return ""
    return "".join(result.stdout.split())


def load_provider_key():
    file_key = load_key_file()
    if file_key:
        return file_key
    keychain = load_keychain()
    if keychain:
        return keychain
    # Live queue: never take the token from process env (`ps e`). Local coordinator still allows it.
    if not COORDINATOR.endswith("/compute/api"):
        env = os.getenv("DASHA_PROVIDER_KEY")
        if env is not None and env.strip():
            return env.strip()
        return "dasha-local-provider"
    return ""


PROVIDER_KEY = load_provider_key()
PROVIDER_ID = os.getenv("DASHA_PROVIDER_ID", f"mac-{uuid.uuid5(uuid.NAMESPACE_DNS, socket.gethostname()).hex[:12]}")
PROVIDER_NAME = os.getenv("DASHA_PROVIDER_NAME", socket.gethostname())
RUNNING = True


def coordinator_path(local_path, public_path):
    return f"{COORDINATOR}{public_path if COORDINATOR.endswith('/compute/api') else local_path}"


def model_map():
    raw = os.getenv("DASHA_MODEL_MAP", "qwen3-8b=qwen3:8b,gemma3-12b=gemma3:12b")
    result = {}
    for pair in raw.split(","):
        public, separator, local = pair.partition("=")
        if separator and public.strip() and local.strip():
            result[public.strip()] = local.strip()
    return result


MODELS = model_map()


def make_request(url, method="GET", payload=None, token=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": "dasha-compute-provider/0.3"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return urllib.request.Request(url, data=data, headers=headers, method=method)


def request_json(url, method="GET", payload=None, token=None, timeout=90):
    request = make_request(url, method, payload, token)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status == 204:
                return None
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {error.code}: {detail[:300]}") from error


def hardware(include_benchmarks=True):
    result = {"system": platform.system(), "machine": platform.machine(), "release": platform.release(), "python": platform.python_version()}
    try:
        result["memory_gb"] = round(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1024 ** 3, 1)
    except (ValueError, OSError, AttributeError):
        pass
    benchmark_path = os.getenv("DASHA_BENCHMARK_PATH")
    if include_benchmarks and benchmark_path:
        try:
            with open(benchmark_path, encoding="utf-8") as source:
                saved = json.load(source)
            result["benchmarked_at"] = saved["measured_at"]
            result["benchmarks"] = saved["results"]
        except (OSError, ValueError, KeyError):
            pass
    return result


def usage_from(result):
    prompt = int(result.get("prompt_eval_count") or 0)
    completion = int(result.get("eval_count") or 0)
    return {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": prompt + completion}


def installed_models():
    tags = request_json(f"{OLLAMA_URL}/api/tags", timeout=5)
    return {item.get("name") for item in tags.get("models", [])}


def run_ollama(job):
    result = request_json(
        f"{OLLAMA_URL}/api/chat",
        method="POST",
        payload={"model": MODELS[job["model"]], "messages": job["messages"], "stream": False, "options": {"temperature": job.get("temperature", 0.7), "num_predict": job.get("max_tokens", 1024)}},
        timeout=600,
    )
    message = result.get("message") or {}
    content = str(message.get("content") or "") or str(message.get("thinking") or message.get("reasoning") or "")
    if not content.strip():
        raise RuntimeError("empty completion")
    return {"content": content, "finish_reason": "stop", "usage": usage_from(result)}


def report(job_id, result):
    return request_json(coordinator_path(f"/v1/providers/jobs/{job_id}/result", f"/providers/jobs/{job_id}/result"), method="POST", payload={"provider_id": PROVIDER_ID, **result}, token=PROVIDER_KEY)


def renew_lease(job_id):
    return request_json(coordinator_path("", f"/providers/jobs/{job_id}/heartbeat"), method="POST", payload={"provider_id": PROVIDER_ID}, token=PROVIDER_KEY, timeout=10)


def keep_lease(job_id, lease_seconds, stop, cancelled):
    while not stop.wait(min(30, max(5, lease_seconds // 3))):
        try:
            response = renew_lease(job_id)
            if response.get("cancelled"):
                cancelled.set()
                return
        except Exception as error:
            print(f"heartbeat failed {job_id}: {error}", file=sys.stderr)


def report_chunk(job_id, **chunk):
    return request_json(coordinator_path(f"/v1/providers/jobs/{job_id}/chunk", f"/providers/jobs/{job_id}/chunk"), method="POST", payload={"provider_id": PROVIDER_ID, **chunk}, token=PROVIDER_KEY)


def stream_ollama(job, cancelled):
    if cancelled.is_set():
        return False
    request = make_request(
        f"{OLLAMA_URL}/api/chat",
        method="POST",
        payload={"model": MODELS[job["model"]], "messages": job["messages"], "stream": True, "options": {"temperature": job.get("temperature", 0.7), "num_predict": job.get("max_tokens", 1024)}},
    )
    final = {}
    sent = False
    with urllib.request.urlopen(request, timeout=600) as response:
        for raw_line in response:
            if cancelled.is_set():
                return False
            if not raw_line.strip():
                continue
            event = json.loads(raw_line.decode("utf-8"))
            if event.get("error"):
                raise RuntimeError(str(event["error"]))
            final = event
            message = event.get("message") or {}
            # Prefer assistant content; if a thinking/reasoning-only chunk arrives, forward it so Ask is not blank.
            content = str(message.get("content") or "")
            if not content:
                content = str(message.get("thinking") or message.get("reasoning") or "")
            if content:
                report_chunk(job["id"], delta=content)
                sent = True
    if cancelled.is_set():
        return False
    if final.get("done") is not True:
        raise RuntimeError("Ollama stream ended before completion")
    if not sent:
        # Fail closed — coordinator rejects empty stream done; do not mark success with blank answer.
        raise RuntimeError("empty completion")
    report_chunk(job["id"], done=True, finish_reason="stop", usage=usage_from(final))
    return True


OLLAMA_MLX_MIN = (0, 33, 1)


def model_billions(name):
    """Best-effort parameter billions from tags like gemma3:27b / qwen3:8b / 12b-mlx. Never invents."""
    found = [float(part) for part in re.findall(r"(\d+(?:\.\d+)?)[bB]", str(name or ""))]
    return max(found) if found else None


def size_soft_report():
    """Soft warn when mapped models look ≥27B. Never fails doctor."""
    large = []
    for public, local in MODELS.items():
        billions = model_billions(local)
        if billions is None:
            billions = model_billions(public)
        if billions is not None and billions >= 27:
            label = int(billions) if billions == int(billions) else billions
            large.append(f"{public}→{local} (~{label}B)")
    if not large:
        return
    print("size     soft · " + ", ".join(large) + " · prefer sub-24GB chat (8B/12B) for interactive · never fails doctor")
    mem = hardware(False).get("memory_gb")
    if isinstance(mem, (int, float)) and mem <= 24:
        print(f"size     soft · host ~{mem}GB RAM · large mapped models risk swap/slow · Prefer 8B/12B")


def keepalive_soft_report(ready_locals):
    """Soft Prefer keep-alive when mapped models are cold in Ollama /api/ps. Never fails doctor."""
    if not ready_locals:
        return
    try:
        ps = request_json(f"{OLLAMA_URL}/api/ps", timeout=3)
    except Exception:
        print("keepalive soft · could not read Ollama /api/ps · set OLLAMA_KEEP_ALIVE=-1 on the Ollama service so chat stays hot")
        return
    loaded = set()
    rows = ps.get("models") if isinstance(ps, dict) else None
    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict):
                continue
            name = row.get("name") or row.get("model")
            if isinstance(name, str) and name.strip():
                loaded.add(name.strip())
    cold = [local for local in ready_locals if local not in loaded]
    if not cold:
        print("keepalive ok · mapped model(s) loaded in Ollama")
        return
    print(
        "keepalive soft · mapped model not loaded ("
        + ", ".join(cold[:4])
        + ") · set OLLAMA_KEEP_ALIVE=-1 on the Ollama launch agent/service — a shell export alone is not enough on macOS"
    )


def parse_ollama_version(raw):

    match = re.search(r"(\d+)\.(\d+)\.(\d+)", str(raw or ""))
    if not match:
        return None
    return tuple(int(part) for part in match.groups())


def ollama_version_info():
    """Best-effort Ollama version from /api/version, then `ollama -v`. Never invents env flags."""
    raw = ""
    try:
        data = request_json(f"{OLLAMA_URL}/api/version", timeout=3)
        if isinstance(data, dict):
            raw = str(data.get("version") or "")
    except Exception:
        pass
    if not raw:
        try:
            probe = subprocess.run(["ollama", "-v"], capture_output=True, text=True, timeout=5, check=False)
            raw = ((probe.stdout or "") + " " + (probe.stderr or "")).strip()
        except (OSError, subprocess.TimeoutExpired):
            pass
    return parse_ollama_version(raw), (raw.strip()[:48] if raw else "")


def prefer_mlx_report():
    """Soft Prefer MLX probe for Apple Silicon. Never fails doctor; never invents env flags."""
    from pathlib import Path as PathLib

    bits = []
    apple = platform.system() == "Darwin" and platform.machine() == "arm64"
    if apple:
        bits.append("Apple Silicon")
    mlx_lm = False
    try:
        which = subprocess.run(["sh", "-c", "command -v mlx_lm"], capture_output=True, text=True, timeout=3, check=False)
        if which.returncode == 0 and which.stdout.strip():
            mlx_lm = True
            bits.append("mlx_lm on PATH")
    except (OSError, subprocess.TimeoutExpired):
        pass
    if not mlx_lm:
        try:
            probe = subprocess.run(
                [sys.executable, "-c", "import mlx_lm"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if probe.returncode == 0:
                mlx_lm = True
                bits.append("mlx_lm importable")
        except (OSError, subprocess.TimeoutExpired):
            pass
    if PathLib("/Applications/LM Studio.app").exists():
        bits.append("LM Studio installed")
    mlx_tags = []
    try:
        installed = installed_models()
        mlx_tags = sorted(name for name in installed if isinstance(name, str) and "mlx" in name.lower())
        if mlx_tags:
            bits.append("ollama mlx tags: " + ", ".join(mlx_tags[:4]))
    except Exception:
        pass

    ver, ver_raw = ollama_version_info()
    if ver:
        bits.append(f"ollama {ver[0]}.{ver[1]}.{ver[2]}")
    elif ver_raw:
        bits.append(f"ollama version unparsed ({ver_raw})")

    detail = " · ".join(bits) if bits else "not detected"
    print(f"mlx       hint · Prefer MLX when you can · {detail} · Ollama still works")
    print("prefer    For speed on Apple Silicon: Ollama *-mlx models (Ollama ≥0.33.1), LM Studio MLX server, or mlx_lm — no kit env flag required")

    # Version soft-warn is for Mac providers; still print on any host so doctor/tests can see parse.
    if ver is None:
        print("ollama    soft · could not parse version · recommend Ollama ≥0.33.1 on Mac providers")
    elif ver < OLLAMA_MLX_MIN:
        print(f"ollama    soft · {ver[0]}.{ver[1]}.{ver[2]} older than 0.33.1 · upgrade for MLX + structured output + slow-storage Metal fix")
    else:
        print(f"ollama    ok · {ver[0]}.{ver[1]}.{ver[2]} ≥0.33.1")
    print("storage   Keep models on internal SSD — slow/external storage risks Metal timeouts (Ollama 0.33.1 notes)")
    capable = (ver is not None and ver >= OLLAMA_MLX_MIN) or bool(mlx_tags) or mlx_lm
    if capable:
        print("engine    MLX / structured-output capable build detected — Prefer MLX when you can")
    elif apple:
        print("engine    soft · MLX / structured-output badge waits on Ollama ≥0.33.1 or *-mlx tags")


def doctor():
    failures = 0
    print("Dasha Compute provider doctor")
    print(f"hardware  {platform.system()} {platform.machine()} · Python {platform.python_version()}")
    if COORDINATOR.endswith("/compute/api") and not PROVIDER_KEY:
        failures += 1
        print("token     failed · write the one-time token to .dasha-provider-key (chmod 0600).", file=sys.stderr)
    else:
        try:
            if COORDINATOR.endswith('/compute/api'):
                health = request_json(coordinator_path("/healthz", "/providers/verify"), method="POST", payload={"provider_id": PROVIDER_ID}, token=PROVIDER_KEY, timeout=5)
                detail = health.get("name", PROVIDER_ID)
            else:
                health = request_json(coordinator_path("/healthz", "/providers/verify"), timeout=5)
                detail = f"v{health.get('version', 'unknown')}"
            print(f"gateway   ok · {detail} · {COORDINATOR}")
        except Exception as error:
            failures += 1
            print(f"gateway   failed · {error}", file=sys.stderr)
    ready_locals = []
    try:
        installed = installed_models()
        ready_locals = [local for local in MODELS.values() if local in installed]
        ready = [f"{public}→{local}" for public, local in MODELS.items() if local in installed]
        missing = [local for local in MODELS.values() if local not in installed]
        print("ollama    ok" + (f" · ready: {', '.join(ready)}" if ready else " · no mapped model installed"))
        if missing:
            failures += 1
            print("models    failed · missing: " + ", ".join(missing), file=sys.stderr)
            print("pull      " + " or ".join(f"ollama pull {model}" for model in missing), file=sys.stderr)
    except Exception as error:
        failures += 1
        print(f"ollama    failed · {error}", file=sys.stderr)
    prefer_mlx_report()
    size_soft_report()
    keepalive_soft_report(ready_locals)
    benchmark_path = os.getenv("DASHA_BENCHMARK_PATH")
    has_bench = False
    if benchmark_path:
        try:
            with open(benchmark_path, encoding="utf-8") as source:
                saved = json.load(source)
            rows = saved.get("results") if isinstance(saved, dict) else None
            if isinstance(rows, list):
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    try:
                        tps = float(row.get("tokens_per_second"))
                    except (TypeError, ValueError):
                        continue
                    if tps > 0:
                        has_bench = True
                        break
        except Exception:
            has_bench = False
    if has_bench:
        print("benchmark ok · measured tok/s will post on heartbeat")
    else:
        print("benchmark soft · run dasha-compute benchmark so measured tok/s can show on Ask")
    return failures


def benchmark():
    installed = installed_models()
    rows = []
    tokens = max(16, min(256, int(os.getenv("DASHA_BENCHMARK_TOKENS", "64"))))
    for public, local in MODELS.items():
        if local not in installed:
            continue
        started = time.monotonic()
        result = request_json(f"{OLLAMA_URL}/api/chat", method="POST", payload={"model": local, "messages": [{"role": "user", "content": "In one paragraph, explain why local AI compute is useful."}], "stream": False, "options": {"temperature": 0, "num_predict": tokens}}, timeout=600)
        elapsed = time.monotonic() - started
        generated = int(result.get("eval_count") or 0)
        duration = int(result.get("eval_duration") or 0) / 1_000_000_000
        rows.append({"model": public, "ollama_model": local, "tokens": generated, "seconds": round(elapsed, 3), "tokens_per_second": round(generated / (duration or elapsed), 2)})
    report = {"measured_at": int(time.time() * 1000), "hardware": hardware(False), "results": rows}
    benchmark_path = os.getenv("DASHA_BENCHMARK_PATH")
    if benchmark_path:
        with open(benchmark_path, "w", encoding="utf-8") as output:
            json.dump(report, output)
    print(json.dumps(report, indent=2))
    return 0 if rows else 1


def stop(_signum, _frame):
    global RUNNING
    RUNNING = False


def main():
    parser = argparse.ArgumentParser(description="Run or inspect a Dasha Compute Ollama provider")
    parser.add_argument("--doctor", action="store_true", help="check the coordinator, Ollama and mapped models")
    parser.add_argument("--benchmark", action="store_true", help="measure configured Ollama model throughput")
    parser.add_argument("--once", action="store_true", help="poll once and exit")
    args = parser.parse_args()
    if not MODELS:
        raise SystemExit("DASHA_MODEL_MAP contains no valid public=ollama mappings")
    if args.doctor:
        raise SystemExit(doctor())
    if args.benchmark:
        raise SystemExit(benchmark())
    try:
        available = {public: local for public, local in MODELS.items() if local in installed_models()}
    except Exception as error:
        raise SystemExit(f"Ollama unavailable: {error}") from error
    if not available:
        raise SystemExit("No configured Ollama model is installed. Run with --doctor for pull commands.")
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    print(f"dasha-compute provider {PROVIDER_NAME} ({PROVIDER_ID})")
    print("models: " + ", ".join(f"{public} → {local}" for public, local in available.items()))
    backoff = 1
    while RUNNING:
        try:
            response = request_json(
                coordinator_path("/v1/providers/poll", "/providers/poll"),
                method="POST",
                payload={"provider_id": PROVIDER_ID, "name": PROVIDER_NAME, "models": list(available), "hardware": hardware()},
                token=PROVIDER_KEY,
                timeout=35,
            )
            backoff = 1
            if not response:
                if args.once:
                    break
                time.sleep(1)
                continue
            job = response["job"]
            print(f"job {job['id']} · {job['model']} · {'stream' if job.get('stream') else 'complete'}")
            stop_heartbeat, cancelled = threading.Event(), threading.Event()
            heartbeat = threading.Thread(target=keep_lease, args=(job["id"], response.get("lease_seconds", 300), stop_heartbeat, cancelled), daemon=True)
            try:
                if COORDINATOR.endswith('/compute/api'):
                    heartbeat.start()
                if job.get("stream"):
                    if stream_ollama(job, cancelled):
                        print(f"completed {job['id']}")
                    else:
                        print(f"cancelled {job['id']}")
                else:
                    result = run_ollama(job)
                    stop_heartbeat.set()
                    if heartbeat.is_alive():
                        heartbeat.join(10)
                    if COORDINATOR.endswith('/compute/api') and renew_lease(job["id"]).get("cancelled"):
                        cancelled.set()
                    if cancelled.is_set():
                        print(f"cancelled {job['id']}")
                    else:
                        report(job["id"], result)
                        print(f"completed {job['id']}")
            except Exception as error:
                print(f"failed {job['id']}: {error}", file=sys.stderr)
                try:
                    if job.get("stream"):
                        report_chunk(job["id"], error=f"provider inference failed: {type(error).__name__}")
                    else:
                        report(job["id"], {"error": f"provider inference failed: {type(error).__name__}"})
                except Exception:
                    pass
            finally:
                stop_heartbeat.set()
                if heartbeat.is_alive():
                    heartbeat.join(10)
            if args.once:
                break
        except Exception as error:
            print(f"coordinator unavailable: {error}; retrying in {backoff}s", file=sys.stderr)
            if args.once:
                break
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)
    print("provider stopped")


if __name__ == "__main__":
    main()
