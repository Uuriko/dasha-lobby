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

KIT_TAR_URL = "https://www.getdasha.com/dasha-compute-open-alpha.tar.gz"
KIT_JSON_URL = "https://www.getdasha.com/compute/kit.json"
KIT_VERSION_FALLBACK = "0.3.0"


def kit_version():
    env = os.getenv("DASHA_KIT_VERSION")
    if env and env.strip():
        return env.strip()
    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (os.path.join(here, "VERSION"), os.path.join(os.path.dirname(here), "VERSION")):
        try:
            with open(candidate, encoding="utf-8") as source:
                value = source.read().strip()
            if value:
                return value
        except OSError:
            pass
    return KIT_VERSION_FALLBACK


KIT_VERSION = kit_version()


def parse_version(value):
    parts = []
    for piece in str(value or "").strip().split("."):
        try:
            parts.append(int(piece))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def check_kit_version(timeout=2):
    """Soft-fail version check against the kit manifest. Returns (state, info)."""
    try:
        request = urllib.request.Request(KIT_JSON_URL, headers={"User-Agent": f"dasha-compute-provider/{KIT_VERSION}"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            info = json.loads(response.read().decode("utf-8"))
    except Exception:
        return "unknown", None
    current = parse_version(KIT_VERSION)
    minimum = parse_version(info.get("min_version"))
    latest = parse_version(info.get("version"))
    if minimum and current < minimum:
        return "obsolete", info
    if latest and current < latest:
        return "update", info
    return "current", info


def kit_upgrade_line(info=None):
    url = (info or {}).get("url") or KIT_TAR_URL
    return f"re-download the kit: curl -fLO {url} && tar -xzf dasha-compute-open-alpha.tar.gz && cd dasha-compute-open-alpha && ./install.sh"


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

BONSAI_PUBLIC_ID = "ternary-bonsai-2-27b"
BONSAI_RESIDUAL_SITES = 129


def backend_spec(local):
    """Parse DASHA_MODEL_MAP locals. Ollama tag, openai:<base>:<model>, or splash:<package>[:port]."""
    raw = str(local or "").strip()
    if raw.startswith("openai:"):
        rest = raw[len("openai:"):]
        if "://" not in rest:
            return None
        if rest.count(":") < 1:
            return None
        base, model = rest.rsplit(":", 1)
        if not base.strip() or not model.strip():
            return None
        if not (base.startswith("http://") or base.startswith("https://")):
            return None
        return {"kind": "openai", "base": base.rstrip("/"), "model": model.strip()}
    if raw.startswith("splash:"):
        rest = raw[len("splash:"):]
        package, colon, port_raw = rest.partition(":")
        package = package.strip()
        if not package or "/" not in package:
            return None
        port = SPLASH_DEFAULT_PORT
        if colon:
            try:
                port = int(port_raw.strip())
            except (TypeError, ValueError):
                return None
            if not 1 <= port <= 65535:
                return None
        return {
            "kind": "splash",
            "package": package,
            "port": port,
            "base": f"http://127.0.0.1:{port}",
            "model": package,
            "token": splash_api_key(),
        }
    return {"kind": "ollama", "model": raw}


def is_bonsai_id(*parts):
    return any("bonsai" in str(part or "").lower() for part in parts)


def residual_alpha():
    """DASHA_RESIDUAL_ALPHA. Default 0 = stock (no residual intervention)."""
    raw = os.getenv("DASHA_RESIDUAL_ALPHA", "0")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return 0.0
    if not (float("-inf") < value < float("inf")):
        return 0.0
    return value


def openai_chat_extras(public, local):
    """Chat extras for an openai: Bonsai backend. Empty unless bonsai + openai map."""
    spec = backend_spec(local)
    if not spec or spec.get("kind") != "openai":
        return {}
    if not is_bonsai_id(public, spec.get("model"), local):
        return {}
    alpha = residual_alpha()
    return {"residual_alpha": alpha, "alpha": alpha}


def result_residual_fields(job):
    local = MODELS.get(job.get("model"), "")
    extras = openai_chat_extras(job.get("model"), local)
    if not extras:
        return {}
    return {"residual_alpha": extras["residual_alpha"], "residual_site_count": BONSAI_RESIDUAL_SITES}


# ---------------------------------------------------------------------------
# Splash engine (beta, opt-in). Inco's macOS inference server, OpenAI-compatible.
# Map syntax:  qwen3.8-27b=splash:incoai/Qwen3.8-27B-Splash
# Optional explicit port: splash:incoai/Qwen3.8-27B-Splash:8001
# Floor: Apple M3+, 36 GB unified memory, macOS 26.4+. Never fails doctor.
# No vendor speed claims in copy — the engine is "beta" until our own
# benchmark confirms the vendor numbers.
# ---------------------------------------------------------------------------

SPLASH_DEFAULT_PORT = 8000
_SPLASH_PROCS = {}
_SPLASH_READY_ONCE = set()
_SPLASH_FAILED = {}


def splash_api_key():
    for name in ("DASHA_SPLASH_API_KEY", "SPLASH_API_KEY"):
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return None


def splash_chip_m(brand=None):
    """Apple Silicon M-number from a brand string like 'Apple M4'. None when unknown."""
    if brand is None:
        if platform.system() != "Darwin":
            return None
        try:
            probe = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True, timeout=5, check=False)
            brand = (probe.stdout or "").strip()
        except (OSError, subprocess.TimeoutExpired):
            return None
    match = re.search(r"\bM(\d+)\b", str(brand or ""))
    return int(match.group(1)) if match else None


def splash_mem_gb(mem_gb=None):
    if mem_gb is not None:
        try:
            return float(mem_gb)
        except (TypeError, ValueError):
            return None
    try:
        return round(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1024 ** 3, 1)
    except (ValueError, OSError, AttributeError):
        return None


def splash_macos(release=None):
    """(major, minor) macOS version. None when unknown or not Darwin."""
    if release is None:
        if platform.system() != "Darwin":
            return None
        release = platform.mac_ver()[0]
    match = re.search(r"(\d+)\.(\d+)", str(release or ""))
    return (int(match.group(1)), int(match.group(2))) if match else None


def splash_on_path(found=None):
    if found is not None:
        return bool(found)
    try:
        probe = subprocess.run(["sh", "-c", "command -v splash"], capture_output=True, text=True, timeout=5, check=False)
        return probe.returncode == 0 and bool(probe.stdout.strip())
    except (OSError, subprocess.TimeoutExpired):
        return False


def splash_gate(package, *, darwin=None, brand=None, mem_gb=None, macos=None, on_path=None):
    """Capability gate for serving `package` via Splash. Returns (ok, [reasons]). Never raises."""
    if darwin is None:
        darwin = platform.system() == "Darwin" and platform.machine() == "arm64"
    if not darwin:
        return False, ["host is not macOS on Apple Silicon"]
    ok, reasons = True, []
    chip = splash_chip_m(brand=brand)
    if chip is None:
        ok = False
        reasons.append("could not detect Apple Silicon chip (Splash needs M3 or newer)")
    elif chip < 3:
        ok = False
        reasons.append(f"Apple M{chip} detected — Splash needs M3 or newer")
    mem = splash_mem_gb(mem_gb=mem_gb)
    if mem is None:
        ok = False
        reasons.append("could not detect unified memory (Splash needs 36 GB+)")
    elif mem < 36:
        ok = False
        reasons.append(f"{mem:g} GB unified memory — Splash needs 36 GB+")
    ver = splash_macos(release=macos)
    if ver is None:
        ok = False
        reasons.append("could not detect macOS version (Splash needs 26.4+)")
    elif ver < (26, 4):
        ok = False
        reasons.append(f"macOS {ver[0]}.{ver[1]} — Splash needs macOS 26.4+")
    if not splash_on_path(found=on_path):
        ok = False
        reasons.append("`splash` not on PATH — install: brew install incoai/tap/splash")
    if "/" not in str(package or ""):
        ok = False
        reasons.append(f"'{package}' is not a Splash package id (owner/repo, e.g. incoai/Qwen3.8-27B-Splash)")
    return ok, reasons


def _splash_port_explicit(local):
    rest = str(local or "").strip()[len("splash:"):]
    return rest.count(":") >= 1


def splash_mapped():
    """[(public, spec)] for splash-kind mappings; auto-assigns successive ports."""
    rows, used = [], set()
    for public in sorted(MODELS):
        spec = backend_spec(MODELS[public])
        if not spec or spec.get("kind") != "splash":
            continue
        if spec["port"] == SPLASH_DEFAULT_PORT and not _splash_port_explicit(MODELS[public]):
            port = SPLASH_DEFAULT_PORT
            while port in used:
                port += 1
            spec = {**spec, "port": port, "base": f"http://127.0.0.1:{port}"}
        used.add(spec["port"])
        rows.append((public, spec))
    return rows


def splash_ready(spec, timeout=5):
    """True when the Splash server answers /v1/models. Never raises."""
    try:
        data = request_json(f"{spec['base']}/v1/models", timeout=timeout, token=spec.get("token"))
    except Exception:
        return False
    rows = data.get("data") if isinstance(data, dict) else None
    return isinstance(rows, list)


def splash_ensure(public, spec, timeout=None):
    """Launch `splash serve` for one mapping and wait for readiness. Returns (ok, detail)."""
    proc = _SPLASH_PROCS.get(public)
    if proc is not None and proc.poll() is None and splash_ready(spec, timeout=5):
        return True, f"already serving on {spec['base']}"
    ok, reasons = splash_gate(spec["package"])
    if not ok:
        return False, "; ".join(reasons)
    argv = ["splash", "serve", "--model", spec["package"], "--port", str(spec["port"]), "--no-webui"]
    key = splash_api_key()
    if key:
        argv += ["--api-key", key]
    try:
        proc = subprocess.Popen(argv, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as error:
        return False, f"could not launch `splash serve`: {error}"
    _SPLASH_PROCS[public] = proc
    try:
        ready_timeout = int(os.getenv("DASHA_SPLASH_READY_TIMEOUT", "900") or 900)
    except ValueError:
        ready_timeout = 900
    if timeout is not None:
        ready_timeout = timeout
    deadline = time.monotonic() + max(5, ready_timeout)
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            _SPLASH_PROCS.pop(public, None)
            return False, "splash serve exited during startup — first run downloads the ~17-21 GB package; try `splash serve` manually"
        if splash_ready(spec, timeout=5):
            _SPLASH_READY_ONCE.add(public)
            return True, f"ready on {spec['base']}"
        time.sleep(2)
    try:
        proc.terminate()
    except OSError:
        pass
    _SPLASH_PROCS.pop(public, None)
    return False, f"not ready after {ready_timeout}s — first run downloads the package; re-run to resume"


def splash_ensure_all():
    for public, spec in splash_mapped():
        thread = threading.Thread(target=_splash_supervise, args=(public, spec), daemon=True, name=f"splash-{public}")
        thread.start()


def _splash_supervise(public, spec):
    ok, detail = splash_ensure(public, spec)
    if ok:
        print(f"splash    ready · {public}→{spec['package']} on {spec['base']}")
    else:
        _SPLASH_FAILED[public] = detail
        print(f"splash    unavailable · {public}: {detail}", file=sys.stderr)


def splash_watchdog(stop):
    """Restart Splash servers that die after having served once. Daemon thread."""
    while not stop.wait(60):
        for public, spec in splash_mapped():
            if public not in _SPLASH_READY_ONCE or public in _SPLASH_FAILED:
                continue
            proc = _SPLASH_PROCS.get(public)
            if proc is None or proc.poll() is not None:
                print(f"splash    restarting · {public} died — relaunching", file=sys.stderr)
                ok, detail = splash_ensure(public, spec, timeout=300)
                if not ok:
                    print(f"splash    restart failed · {public}: {detail}", file=sys.stderr)


def splash_shutdown():
    for public, proc in list(_SPLASH_PROCS.items()):
        try:
            if proc.poll() is None:
                proc.terminate()
        except OSError:
            pass
    _SPLASH_PROCS.clear()


def splash_teardown(stop):
    try:
        stop.set()
    except Exception:
        pass
    splash_shutdown()


def splash_engine_report(available):
    """Heartbeat advertise: public -> engine capability. Additive; unknown fields ignored downstream."""
    report = {}
    for public, spec in splash_mapped():
        if public in available:
            report[public] = {"engine": "splash", "package": spec["package"], "port": spec["port"]}
    return report


def splash_soft_report():
    """Doctor lines for Splash. Never fails doctor; no speed claims (beta)."""
    rows = splash_mapped()
    if not rows:
        print("splash    hint · Splash engine (beta) is opt-in for M3+ / 36GB+ / macOS 26.4+ — map e.g. qwen3.8-27b=splash:incoai/Qwen3.8-27B-Splash")
        return
    for public, spec in rows:
        ok, reasons = splash_gate(spec["package"])
        if ok:
            state = "running" if splash_ready(spec, timeout=3) else "not running"
            print(f"splash    ok · {public}→{spec['package']} · beta · {state} · port {spec['port']}")
        else:
            print("splash    soft · " + public + ": " + "; ".join(reasons) + " · never fails doctor")
    if not splash_api_key():
        print("splash    hint · no DASHA_SPLASH_API_KEY set — Splash serves without auth on 127.0.0.1 only")


def openai_installed_ids(base):
    data = request_json(f"{base}/models", timeout=5)
    rows = data.get("data") if isinstance(data, dict) else None
    ids = set()
    if isinstance(rows, list):
        for row in rows:
            if isinstance(row, dict) and row.get("id"):
                ids.add(str(row["id"]))
    return ids


def openai_usage(result):
    usage = result.get("usage") or {}
    prompt = int(usage.get("prompt_tokens") or 0)
    completion = int(usage.get("completion_tokens") or 0)
    return {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": prompt + completion}


def openai_chat_payload(job, stream, spec):
    payload = {
        "model": spec["model"],
        "messages": job["messages"],
        "stream": stream,
        "temperature": job.get("temperature", 0.7),
        "max_tokens": job.get("max_tokens", 1024),
    }
    if spec.get("kind") == "splash":
        # Splash reasons by default; the kit defaults think off (parity with Ollama path).
        effort = os.getenv("DASHA_SPLASH_REASONING_EFFORT", "none").strip().lower() or "none"
        payload["reasoning_effort"] = effort if effort in ("none", "low", "medium", "xhigh") else "none"
    payload.update(openai_chat_extras(job["model"], MODELS[job["model"]]))
    return payload


def residual_soft_report():
    """Soft residual-control line for mapped Bonsai. Never fails doctor."""
    rows = []
    for public, local in MODELS.items():
        if not is_bonsai_id(public, local):
            continue
        spec = backend_spec(local) or {"kind": "ollama"}
        alpha = residual_alpha()
        stock = "stock" if alpha == 0 else "adjusted"
        rows.append(f"{public} · {spec.get('kind')} · α={alpha:g} {stock}")
    if not rows:
        return
    print(
        "residual  ok · "
        + "; ".join(rows)
        + f" · {BONSAI_RESIDUAL_SITES} residual writers expected · bit-identical pack · Apple Silicon local · never fails doctor"
    )
    if residual_alpha() == 0:
        print("residual  hint · DASHA_RESIDUAL_ALPHA default 0 = stock behavior · same pack, optional residual control")


def no_think_tokens():
    raw = os.getenv("DASHA_NO_THINK", "qwen")
    return [token.strip().lower() for token in raw.split(",") if token.strip()]


NO_THINK = no_think_tokens()


def truthy_flag(value):
    if value is True:
        return True
    if value is False or value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "on", "yes")


def think_opted_in(job=None):
    """Explicit think mode: job.think or DASHA_OLLAMA_THINK=1/true/on."""
    job = job or {}
    if truthy_flag(job.get("think")):
        return True
    return truthy_flag(os.getenv("DASHA_OLLAMA_THINK"))


def think_disabled(local_model, job=None):
    """Community Ask / Ollama stream defaults think off so content arrives promptly.

    Opt in with job.think or DASHA_OLLAMA_THINK=1. DASHA_NO_THINK (default qwen)
    still force-disables matching models unless job.think is set explicitly.
    """
    job = job or {}
    name = str(local_model or "").lower()
    force_off = any(token in name for token in NO_THINK)
    if truthy_flag(job.get("think")):
        return False
    if force_off:
        return True
    return not think_opted_in(job)


def chat_payload(job, stream):
    local = MODELS[job["model"]]
    payload = {
        "model": local,
        "messages": job["messages"],
        "stream": stream,
        "options": {"temperature": job.get("temperature", 0.7), "num_predict": job.get("max_tokens", 1024)},
        "think": not think_disabled(local, job),
    }
    return payload


def answer_content(message, local, job=None):
    content = str(message.get("content") or "")
    if not content and not think_disabled(local, job):
        content = str(message.get("thinking") or message.get("reasoning") or "")
    return content


def final_assistant_content(reply):
    """Final assistant content only. Never thinking/reasoning."""
    if reply is None:
        return ""
    if isinstance(reply, str):
        return reply
    if not isinstance(reply, dict):
        return ""
    message = reply.get("message")
    if isinstance(message, dict):
        return str(message.get("content") or "")
    if any(key in reply for key in ("content", "thinking", "reasoning")):
        return str(reply.get("content") or "")
    nested = reply.get("reply")
    if nested is not None and nested is not reply:
        return final_assistant_content(nested)
    return ""


def score_warm_ok(reply):
    """True only if final assistant content equals or starts with WARM_OK.

    Thinking/reasoning text that merely mentions WARM_OK is never success.
    A bare string is treated as content and must start with WARM_OK — substring is not enough.
    """
    text = final_assistant_content(reply).lstrip()
    return text == "WARM_OK" or text.startswith("WARM_OK")


def make_request(url, method="GET", payload=None, token=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": f"dasha-compute-provider/{KIT_VERSION}"}
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
        payload=chat_payload(job, False),
        timeout=600,
    )
    message = result.get("message") or {}
    content = answer_content(message, MODELS[job["model"]], job)
    if not content.strip():
        raise RuntimeError("empty completion")
    return {"content": content, "finish_reason": "stop", "usage": usage_from(result), **result_residual_fields(job)}


def run_openai(job, spec):
    result = request_json(
        f"{spec['base']}/chat/completions",
        method="POST",
        payload=openai_chat_payload(job, False, spec),
        timeout=600,
        token=spec.get("token"),
    )
    choice = (result.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = str(message.get("content") or "")
    if not content.strip():
        raise RuntimeError("empty completion")
    return {"content": content, "finish_reason": "stop", "usage": openai_usage(result), **result_residual_fields(job)}


def run_inference(job):
    spec = backend_spec(MODELS[job["model"]])
    if spec and spec.get("kind") in ("openai", "splash"):
        return run_openai(job, spec)
    return run_ollama(job)


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
        payload=chat_payload(job, True),
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
            # Prefer assistant content. Thinking/reasoning-only chunks are forwarded only when the model
            # is allowed to think; Community Ask defaults think:false so content arrives without CoT.
            content = answer_content(message, MODELS[job["model"]], job)
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
    report_chunk(job["id"], done=True, finish_reason="stop", usage=usage_from(final), **result_residual_fields(job))
    return True


def stream_openai(job, spec, cancelled):
    if cancelled.is_set():
        return False
    request = make_request(
        f"{spec['base']}/chat/completions",
        method="POST",
        payload=openai_chat_payload(job, True, spec),
        token=spec.get("token"),
    )
    sent = False
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    with urllib.request.urlopen(request, timeout=600) as response:
        for raw_line in response:
            if cancelled.is_set():
                return False
            line = raw_line.decode("utf-8").strip()
            if not line or line.startswith(":"):
                continue
            if line.startswith("data:"):
                line = line[5:].strip()
            if line == "[DONE]":
                break
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get("error"):
                raise RuntimeError(str(event["error"]))
            if event.get("usage"):
                usage = openai_usage(event)
            choices = event.get("choices") or []
            delta = (choices[0].get("delta") or {}) if choices else {}
            content = str(delta.get("content") or "")
            if content:
                report_chunk(job["id"], delta=content)
                sent = True
    if cancelled.is_set():
        return False
    if not sent:
        raise RuntimeError("empty completion")
    report_chunk(job["id"], done=True, finish_reason="stop", usage=usage, **result_residual_fields(job))
    return True


def stream_inference(job, cancelled):
    spec = backend_spec(MODELS[job["model"]])
    if spec and spec.get("kind") in ("openai", "splash"):
        return stream_openai(job, spec, cancelled)
    return stream_ollama(job, cancelled)


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


def hold_sleep_assertions():
    """Hold caffeinate -is for this process's lifetime on macOS. -i idle sleep, -s system sleep
    (AC power only; on battery the Mac can still sleep, which is honest). The -w flag ties the
    assertions to this pid, so caffeinate exits with the agent - no orphaned assertions, and
    launchd keeps signaling the agent process directly."""
    if platform.system() != "Darwin":
        return None
    try:
        return subprocess.Popen(
            ["/usr/bin/caffeinate", "-is", "-w", str(os.getpid())],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        return None


def sleep_soft_report(*, pm_text=None, force_darwin=None):
    """Soft warn when system sleep is enabled - a sleeping Mac is offline to buyers. Never fails doctor."""
    darwin = platform.system() == "Darwin" if force_darwin is None else bool(force_darwin)
    if not darwin:
        return
    if pm_text is None:
        pm_text = _darwin_probe(["pmset", "-g"])
    if not pm_text:
        return
    for line in pm_text.splitlines():
        parts = line.split()
        if parts and parts[0] == "sleep" and len(parts) > 1:
            try:
                minutes = int(parts[1])
            except ValueError:
                return
            if minutes > 0:
                print(
                    f"sleep     soft · system sleep after {minutes} min - a sleeping Mac is offline to buyers"
                    " · the agent holds caffeinate while it runs (AC only), or: sudo pmset -a sleep 0"
                )
            else:
                print("sleep     ok · system sleep disabled")
            return


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



def _darwin_probe(argv, timeout=5):
    """Best-effort Darwin subprocess probe. Returns combined text or None. Never invents."""
    if platform.system() != "Darwin":
        return None
    try:
        probe = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return ((probe.stdout or "") + "\n" + (probe.stderr or "")).strip()


def power_soft_lines(batt_text, low_power=False):
    """Pure power soft lines from pmset batt text. Never fails doctor."""
    lines = []
    raw = (batt_text or "").strip()
    if not raw:
        lines.append("power    soft · could not read AC/battery · plug in for Show HN / wake canary")
        return lines
    lower = raw.lower()
    on_batt = ("battery power" in lower) or ("drawing from 'battery" in lower) or ("now drawing from \"battery" in lower)
    on_ac = ("ac power" in lower) or ("drawing from 'ac" in lower) or ("now drawing from \"ac" in lower) or ("charged" in lower and "ac" in lower)
    if on_batt and not on_ac:
        lines.append(
            "power    soft · on battery · Prefer AC for stable Community advertise · pause-on-battery may skip leases · never fails doctor"
        )
    elif not on_ac and not on_batt:
        lines.append("power    soft · could not read AC/battery · plug in for Show HN / wake canary")
    if low_power:
        lines.append("power    soft · Low Power Mode on · Ollama / Metal may throttle · Prefer plug-in for canary")
    return lines


def thermal_soft_lines(therm_text):
    """Pure thermal soft lines from pmset -g therm. Skip silently when empty/nominal."""
    raw = (therm_text or "").strip()
    if not raw:
        return []
    lower = raw.lower()
    # Nominal / empty-ish — no warn
    if "no thermal warning" in lower or "thermal pressure: nominal" in lower:
        return []
    elevated_markers = (
        "cpu_speed_limit",
        "thermal pressure: heavy",
        "thermal pressure: serious",
        "thermal pressure: critical",
        "thermal pressure: elevated",
        "scheduler limit",
    )
    # Only warn on known elevated markers — never invent "CPU too hot" from empty/unknown dumps.
    if any(marker in lower for marker in elevated_markers):
        return [
            "thermal  soft · thermal pressure elevated · expect throttle / slower tok/s · Prefer cool + AC · never fails doctor"
        ]
    return []


def sip_soft_lines(sip_text):
    """Pure SIP soft lines from csrutil status. Local health only — never attestation."""
    raw = (sip_text or "").strip()
    if not raw:
        return [
            "sip      soft · SIP disabled or unreadable · local policy may affect Ollama/Metal installs · fix on-device · never fails doctor"
        ]
    lower = raw.lower()
    if "disabled" in lower:
        return [
            "sip      soft · SIP disabled or unreadable · local policy may affect Ollama/Metal installs · fix on-device · never fails doctor"
        ]
    if "enabled" in lower:
        return ["sip      ok · SIP enabled · local OS health only — not network attestation"]
    return [
        "sip      soft · SIP disabled or unreadable · local policy may affect Ollama/Metal installs · fix on-device · never fails doctor"
    ]


def power_soft_report(*, batt_text=None, low_power=None, force_darwin=None):
    """Soft warn battery / AC / Low Power. Darwin-first. Never fails doctor."""
    darwin = platform.system() == "Darwin" if force_darwin is None else bool(force_darwin)
    if not darwin:
        return
    if batt_text is None:
        batt_text = _darwin_probe(["pmset", "-g", "batt"])
    if low_power is None:
        low_power = False
        pm = _darwin_probe(["pmset", "-g"])
        if pm:
            for line in pm.splitlines():
                if "lowpowermode" in line.lower().replace(" ", ""):
                    parts = line.split()
                    if parts and parts[-1] in ("1", "true", "on"):
                        low_power = True
                    break
    for line in power_soft_lines(batt_text, low_power=bool(low_power)):
        print(line)


def thermal_soft_report(*, therm_text=None, force_darwin=None):
    """Soft warn thermal pressure. Darwin-first. Never fails doctor; skip when unavailable."""
    darwin = platform.system() == "Darwin" if force_darwin is None else bool(force_darwin)
    if not darwin:
        return
    if therm_text is None:
        therm_text = _darwin_probe(["pmset", "-g", "therm"])
        if therm_text is None:
            return  # probe unavailable — skip silently
    for line in thermal_soft_lines(therm_text):
        print(line)


def sip_soft_report(*, sip_text=None, force_darwin=None):
    """Soft SIP / Hardened Runtime friction. Local only — never network attestation / enclave."""
    darwin = platform.system() == "Darwin" if force_darwin is None else bool(force_darwin)
    if not darwin:
        return
    if sip_text is None:
        sip_text = _darwin_probe(["csrutil", "status"])
    for line in sip_soft_lines(sip_text):
        print(line)


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
    ollama_map = {}
    openai_map = {}
    for public, local in MODELS.items():
        spec = backend_spec(local)
        if spec and spec.get("kind") == "openai":
            openai_map[public] = spec
        else:
            ollama_map[public] = local
    try:
        if ollama_map:
            installed = installed_models()
            ready_locals = [local for local in ollama_map.values() if local in installed]
            ready = [f"{public}→{local}" for public, local in ollama_map.items() if local in installed]
            missing = [local for local in ollama_map.values() if local not in installed]
            print("ollama    ok" + (f" · ready: {', '.join(ready)}" if ready else " · no mapped model installed"))
            if missing:
                failures += 1
                print("models    failed · missing: " + ", ".join(missing), file=sys.stderr)
                print("pull      " + " or ".join(f"ollama pull {model}" for model in missing), file=sys.stderr)
        else:
            print("ollama    ok · no Ollama maps")
    except Exception as error:
        if ollama_map:
            failures += 1
            print(f"ollama    failed · {error}", file=sys.stderr)
        else:
            print(f"ollama    soft · {error}")
    for public, spec in openai_map.items():
        try:
            ids = openai_installed_ids(spec["base"])
            if spec["model"] in ids:
                print(f"openai    ok · {public}→{spec['model']} @ {spec['base']}")
            else:
                failures += 1
                print(f"openai    failed · missing {spec['model']} at {spec['base']}/models", file=sys.stderr)
        except Exception as error:
            failures += 1
            print(f"openai    failed · {error}", file=sys.stderr)
    residual_soft_report()
    prefer_mlx_report()
    splash_soft_report()
    size_soft_report()
    keepalive_soft_report(ready_locals)
    power_soft_report()
    sleep_soft_report()
    thermal_soft_report()
    sip_soft_report()
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
    kit_state, kit_info = check_kit_version()
    if kit_state == "obsolete":
        print(f"kit       HARD WARN · v{KIT_VERSION} is obsolete (minimum v{kit_info.get('min_version')}) - {kit_upgrade_line(kit_info)}", file=sys.stderr)
    elif kit_state == "update":
        print(f"kit       soft · v{KIT_VERSION} installed, v{kit_info.get('version')} available - {kit_upgrade_line(kit_info)}")
    elif kit_state == "current":
        print(f"kit       ok · v{KIT_VERSION}")
    else:
        print("kit       soft · version check skipped (offline)")
    return failures


def collect_available():
    """public→local for backends that are actually up. Ollama throw stays loud."""
    available = {}
    ollama_names = None
    for public, local in MODELS.items():
        spec = backend_spec(local)
        if spec and spec.get("kind") == "openai":
            try:
                if spec["model"] in openai_installed_ids(spec["base"]):
                    available[public] = local
            except Exception:
                continue
            continue
        if spec and spec.get("kind") == "splash":
            # Splash servers are supervised by splash_ensure_all; advertise only when ready.
            if splash_ready(spec):
                available[public] = local
            continue
        if ollama_names is None:
            ollama_names = installed_models()
        if local in ollama_names:
            available[public] = local
    return available


def benchmark():
    rows = []
    tokens = max(16, min(256, int(os.getenv("DASHA_BENCHMARK_TOKENS", "64"))))
    ollama_names = None
    for public, local in MODELS.items():
        spec = backend_spec(local)
        if spec and spec.get("kind") in ("openai", "splash"):
            started = time.monotonic()
            bench_payload = {
                "model": spec["model"],
                "messages": [{"role": "user", "content": "In one paragraph, explain why local AI compute is useful."}],
                "stream": False,
                "temperature": 0,
                "max_tokens": tokens,
                **openai_chat_extras(public, local),
            }
            if spec["kind"] == "splash":
                bench_payload["reasoning_effort"] = "none"
            result = request_json(
                f"{spec['base']}/chat/completions",
                method="POST",
                payload=bench_payload,
                timeout=600,
                token=spec.get("token"),
            )
            elapsed = time.monotonic() - started
            generated = openai_usage(result)["completion_tokens"]
            row = {"model": public, "engine": spec["kind"], "openai_model": spec["model"], "tokens": generated, "seconds": round(elapsed, 3), "tokens_per_second": round(generated / elapsed, 2) if elapsed else 0}
            if spec["kind"] == "splash":
                row["splash_package"] = spec["package"]
            rows.append(row)
            continue
        if ollama_names is None:
            ollama_names = installed_models()
        if local not in ollama_names:
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



class TokenRejected(Exception):
    pass


def earnings_cache_path():
    return os.path.join(os.path.expanduser("~/Library/Application Support/Dasha Compute"), "earnings-cache.json")


def fetch_earnings():
    if not COORDINATOR.endswith("/compute/api"):
        raise RuntimeError("earnings needs the live coordinator (https://lobby.getdasha.com/compute/api)")
    if not PROVIDER_KEY:
        raise TokenRejected("no provider token found - re-enroll from the Provide page: https://www.getdasha.com/compute")
    url = f"{COORDINATOR}/provider/earnings?provider_id={PROVIDER_ID}"
    try:
        data = request_json(url, token=PROVIDER_KEY, timeout=10)
    except RuntimeError as error:
        if "HTTP 401" in str(error) or "HTTP 403" in str(error):
            raise TokenRejected("provider token rejected - re-enroll from the Provide page: https://www.getdasha.com/compute") from error
        raise
    try:
        os.makedirs(os.path.dirname(earnings_cache_path()), exist_ok=True)
        with open(earnings_cache_path(), "w", encoding="utf-8") as sink:
            json.dump({"fetched_at": int(time.time()), "data": data}, sink)
    except OSError:
        pass
    return data


def load_earnings_cache():
    try:
        with open(earnings_cache_path(), encoding="utf-8") as source:
            saved = json.load(source)
        if isinstance(saved, dict) and isinstance(saved.get("data"), dict):
            return saved
    except (OSError, ValueError):
        pass
    return None


def money(cents):
    return f"${int(cents or 0) / 100:.2f}"


def print_earnings(data, cached_at=None):
    providers = data.get("providers") or []
    mine = providers[0] if providers else {}
    pending_rows = data.get("pending") or []
    paid = [row for row in pending_rows if row.get("status") == "paid"]
    settled_cents = sum(int(row.get("payout_cents") or row.get("usdc_cents") or 0) for row in paid)
    last_paid = max((int(row.get("paid_at") or 0) for row in paid), default=0)
    pref = data.get("pref") or {}
    print(f"provider   {mine.get('name') or PROVIDER_NAME} ({mine.get('id') or PROVIDER_ID})")
    print(f"pending    {money(mine.get('usdc_cents'))} USDC (~{int(mine.get('dasha_cents') or 0):,} $dasha cents)")
    print(f"settled    {money(settled_cents)} across {len(paid)} payout(s)" + (f" - last paid {time.strftime('%Y-%m-%d', time.gmtime(last_paid))}" if last_paid else ""))
    print(f"jobs       {int(mine.get('jobs') or 0)} served - {int(mine.get('completion_tokens') or 0):,} completion tokens")
    if pref.get("method"):
        print(f"payout     {pref['method']} -> {pref.get('wallet')}")
    else:
        print("payout     not set - choose USDC or $dasha on the Provide page")
    print("settlement operator-settled during alpha")
    if cached_at:
        print(f"(offline - last known copy from {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cached_at))})")


def earnings_cli(args):
    while True:
        data, cached_at = None, None
        try:
            data = fetch_earnings()
        except TokenRejected as error:
            print(str(error), file=sys.stderr)
            return 1
        except Exception as error:
            cached = load_earnings_cache()
            if not cached:
                print(f"coordinator unreachable ({error}) and no cached copy yet", file=sys.stderr)
                return 1
            data, cached_at = cached["data"], cached.get("fetched_at")
        if args.json:
            print(json.dumps({"cached": cached_at is not None, "fetched_at": cached_at, **data}, indent=2))
        else:
            print_earnings(data, cached_at)
        if not args.watch:
            return 0
        time.sleep(max(5, args.watch))


def stop(_signum, _frame):
    global RUNNING
    RUNNING = False


def main():
    parser = argparse.ArgumentParser(description="Run or inspect a Dasha Compute Ollama provider")
    parser.add_argument("--doctor", action="store_true", help="check the coordinator, Ollama and mapped models")
    parser.add_argument("--benchmark", action="store_true", help="measure configured Ollama model throughput")
    parser.add_argument("--once", action="store_true", help="poll once and exit")
    parser.add_argument("--earnings", action="store_true", help="show provider earnings from the live coordinator")
    parser.add_argument("--json", action="store_true", help="with --earnings: print raw JSON")
    parser.add_argument("--watch", type=float, default=0, metavar="SECONDS", help="with --earnings: refresh on an interval")
    args = parser.parse_args()
    if args.earnings:
        raise SystemExit(earnings_cli(args))
    if not MODELS:
        raise SystemExit("DASHA_MODEL_MAP contains no valid public=ollama mappings")
    if args.doctor:
        raise SystemExit(doctor())
    if args.benchmark:
        raise SystemExit(benchmark())
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    splash_stop = threading.Event()
    if splash_mapped():
        splash_ensure_all()
        watchdog = threading.Thread(target=splash_watchdog, args=(splash_stop,), daemon=True, name="splash-watchdog")
        watchdog.start()
    available = {}
    ollama_wait = 1
    while RUNNING and not available:
        try:
            available = collect_available()
            if not available:
                print("no configured model is installed yet - run with --doctor for pull commands; waiting", file=sys.stderr)
        except Exception as error:
            print(f"Ollama unavailable: {error}; retrying in {ollama_wait}s", file=sys.stderr)
        if available or args.once:
            break
        time.sleep(ollama_wait)
        ollama_wait = min(ollama_wait * 2, 60)
    if not available:
        splash_teardown(splash_stop)
        if args.once:
            raise SystemExit("no configured model ready. Run with --doctor for setup commands.")
        raise SystemExit("provider stopped before any backend became ready")
    hold_sleep_assertions()
    kit_state, kit_info = ("current", None) if not COORDINATOR.endswith("/compute/api") else check_kit_version()
    kit_checked_at = time.time()
    if kit_state == "obsolete":
        print(f"kit v{KIT_VERSION} is obsolete - {kit_upgrade_line(kit_info)}", file=sys.stderr)
    elif kit_state == "update":
        print(f"kit v{kit_info.get('version')} available - {kit_upgrade_line(kit_info)}", file=sys.stderr)
    print(f"dasha-compute provider {PROVIDER_NAME} ({PROVIDER_ID}) · kit v{KIT_VERSION}")
    print("models: " + ", ".join(f"{public} → {local}" for public, local in available.items()))
    backoff = 1
    while RUNNING:
        try:
            if COORDINATOR.endswith("/compute/api") and time.time() - kit_checked_at > 3600:
                kit_state, kit_info = check_kit_version()
                kit_checked_at = time.time()
            if kit_state == "obsolete":
                print(f"kit v{KIT_VERSION} is obsolete - {kit_upgrade_line(kit_info)}", file=sys.stderr)
            response = request_json(
                coordinator_path("/v1/providers/poll", "/providers/poll"),
                method="POST",
                payload={"provider_id": PROVIDER_ID, "name": PROVIDER_NAME, "models": list(available), "engines": splash_engine_report(available), "hardware": hardware(), "version": KIT_VERSION},
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
                    if stream_inference(job, cancelled):
                        print(f"completed {job['id']}")
                    else:
                        print(f"cancelled {job['id']}")
                else:
                    result = run_inference(job)
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
    splash_teardown(splash_stop)
    print("provider stopped")


if __name__ == "__main__":
    main()
