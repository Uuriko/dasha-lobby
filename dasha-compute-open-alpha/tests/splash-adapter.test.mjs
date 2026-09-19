import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const kit = join(root, "..");

function probe(code) {
  const preamble = `
import importlib.util, os, sys
spec = importlib.util.spec_from_file_location("dasha_compute_agent", "provider/agent.py")
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
`;
  return execFileSync("python3", ["-B", "-c", preamble + code], { cwd: kit, encoding: "utf8", timeout: 60000 });
}

test("backend_spec parses splash: mappings (default + explicit port, rejects malformed)", () => {
  const out = probe(`
s = agent.backend_spec("splash:incoai/Qwen3.8-27B-Splash")
assert s["kind"] == "splash", s
assert s["package"] == "incoai/Qwen3.8-27B-Splash", s
assert s["port"] == 8000, s
assert s["base"] == "http://127.0.0.1:8000", s
assert s["model"] == "incoai/Qwen3.8-27B-Splash", s
s = agent.backend_spec("splash:incoai/Qwen3.6-35B-A3B-Splash:8001")
assert s["kind"] == "splash" and s["port"] == 8001, s
assert s["base"] == "http://127.0.0.1:8001", s
assert agent.backend_spec("splash:notapackage") is None
assert agent.backend_spec("splash:owner/repo:notaport") is None
assert agent.backend_spec("splash:owner/repo:99999") is None
# existing kinds untouched
assert agent.backend_spec("qwen3:8b") == {"kind": "ollama", "model": "qwen3:8b"}
o = agent.backend_spec("openai:http://127.0.0.1:1234:lmstudio-model")
assert o["kind"] == "openai" and o["base"] == "http://127.0.0.1:1234", o
print("spec-ok")
`);
  assert.match(out, /spec-ok/);
});

test("splash_gate enforces the M3+/36GB/macOS 26.4+ floor", () => {
  const out = probe(`
ok, reasons = agent.splash_gate("incoai/Qwen3.8-27B-Splash", darwin=True, brand="Apple M4", mem_gb=48, macos="26.4", on_path=True)
assert ok is True and reasons == [], (ok, reasons)
ok, reasons = agent.splash_gate("incoai/Qwen3.8-27B-Splash", darwin=True, brand="Apple M2", mem_gb=48, macos="26.4", on_path=True)
assert ok is False and any("M3" in r for r in reasons), reasons
ok, reasons = agent.splash_gate("incoai/Qwen3.8-27B-Splash", darwin=True, brand="Apple M4", mem_gb=16, macos="26.4", on_path=True)
assert ok is False and any("36" in r for r in reasons), reasons
ok, reasons = agent.splash_gate("incoai/Qwen3.8-27B-Splash", darwin=True, brand="Apple M4", mem_gb=48, macos="15.6", on_path=True)
assert ok is False and any("26.4" in r for r in reasons), reasons
ok, reasons = agent.splash_gate("incoai/Qwen3.8-27B-Splash", darwin=True, brand="Apple M4", mem_gb=48, macos="26.4", on_path=False)
assert ok is False and any("brew install" in r for r in reasons), reasons
ok, reasons = agent.splash_gate("incoai/Qwen3.8-27B-Splash", darwin=False)
assert ok is False, (ok, reasons)
ok, reasons = agent.splash_gate("notapackage", darwin=True, brand="Apple M4", mem_gb=48, macos="26.4", on_path=True)
assert ok is False, (ok, reasons)
print("gate-ok")
`);
  assert.match(out, /gate-ok/);
});

test("chip / macos parsing helpers", () => {
  const out = probe(`
assert agent.splash_chip_m(brand="Apple M3") == 3
assert agent.splash_chip_m(brand="Apple M1 Pro") == 1
assert agent.splash_chip_m(brand="Apple M5 Max") == 5
assert agent.splash_chip_m(brand="Intel(R) Core(TM)") is None
assert agent.splash_chip_m(brand="") is None
assert agent.splash_macos(release="26.4") == (26, 4)
assert agent.splash_macos(release="15.6.1") == (15, 6)
assert agent.splash_macos(release="") is None
assert (26, 4) >= (26, 4) and (26, 3) < (26, 4)
print("parse-ok")
`);
  assert.match(out, /parse-ok/);
});

test("splash_mapped auto-assigns successive ports", () => {
  const out = probe(`
agent.MODELS = {
  "qwen3.8-27b": "splash:incoai/Qwen3.8-27B-Splash",
  "qwen3.6-35b": "splash:incoai/Qwen3.6-35B-A3B-Splash",
  "qwen3-8b": "qwen3:8b",
}
rows = agent.splash_mapped()
assert [p for p, _ in rows] == ["qwen3.6-35b", "qwen3.8-27b"], rows
assert [spec["port"] for _, spec in rows] == [8000, 8001], rows
agent.MODELS = {"a": "splash:owner/repo", "b": "splash:owner/repo:8010", "c": "splash:owner/repo"}
rows = {p: spec["port"] for p, spec in agent.splash_mapped()}
assert rows == {"a": 8000, "b": 8010, "c": 8001}, rows
print("ports-ok")
`);
  assert.match(out, /ports-ok/);
});

test("run_inference / stream_inference route splash through the OpenAI path", () => {
  const out = probe(`
agent.MODELS = {"qwen3.8-27b": "splash:incoai/Qwen3.8-27B-Splash"}
calls = []
agent.run_openai = lambda job, spec: calls.append(("run", spec["kind"], spec["base"])) or {"content": "x", "finish_reason": "stop", "usage": {}}
job = {"id": "j1", "model": "qwen3.8-27b", "messages": [{"role": "user", "content": "hi"}], "stream": False}
agent.run_inference(job)
assert calls == [("run", "splash", "http://127.0.0.1:8000")], calls
agent.stream_openai = lambda job, spec, cancelled: calls.append(("stream", spec["kind"])) or True
import threading
agent.stream_inference(job, threading.Event())
assert calls[-1] == ("stream", "splash"), calls
# ollama routing untouched
agent.MODELS = {"qwen3-8b": "qwen3:8b"}
agent.run_ollama = lambda job: calls.append(("ollama",)) or {}
agent.run_inference({**job, "model": "qwen3-8b"})
assert calls[-1] == ("ollama",), calls
print("route-ok")
`);
  assert.match(out, /route-ok/);
});

test("splash payload disables reasoning by default; scoped API key is threaded", () => {
  const out = probe(`
agent.MODELS = {"qwen3.8-27b": "splash:incoai/Qwen3.8-27B-Splash"}
spec = agent.backend_spec(agent.MODELS["qwen3.8-27b"])
job = {"id": "j1", "model": "qwen3.8-27b", "messages": [{"role": "user", "content": "hi"}]}
os.environ.pop("DASHA_SPLASH_REASONING_EFFORT", None)
payload = agent.openai_chat_payload(job, False, spec)
assert payload["reasoning_effort"] == "none", payload
assert payload["model"] == "incoai/Qwen3.8-27B-Splash", payload
os.environ["DASHA_SPLASH_REASONING_EFFORT"] = "low"
assert agent.openai_chat_payload(job, False, spec)["reasoning_effort"] == "low"
os.environ["DASHA_SPLASH_REASONING_EFFORT"] = "bogus"
assert agent.openai_chat_payload(job, False, spec)["reasoning_effort"] == "none"
del os.environ["DASHA_SPLASH_REASONING_EFFORT"]
# ollama/openai payloads do not gain the field
plain = agent.openai_chat_payload(job, False, {"kind": "openai", "base": "http://x", "model": "m"})
assert "reasoning_effort" not in plain, plain

# token threading: run_openai must pass the splash key as bearer
seen = {}
def fake_request_json(url, method="GET", payload=None, token=None, timeout=90):
    seen["token"] = token
    return {"choices": [{"message": {"content": "hello"}}], "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3}}
agent.request_json = fake_request_json
os.environ["DASHA_SPLASH_API_KEY"] = "splash-secret"
spec = agent.backend_spec(agent.MODELS["qwen3.8-27b"])
assert spec["token"] == "splash-secret", spec
agent.run_openai(job, spec)
assert seen["token"] == "splash-secret", seen
del os.environ["DASHA_SPLASH_API_KEY"]
print("payload-ok")
`);
  assert.match(out, /payload-ok/);
});

test("collect_available advertises splash only when ready; engine report shape", () => {
  const out = probe(`
agent.MODELS = {
  "qwen3.8-27b": "splash:incoai/Qwen3.8-27B-Splash",
  "qwen3-8b": "qwen3:8b",
}
agent.splash_ready = lambda spec, timeout=5: True
agent.installed_models = lambda: {"qwen3:8b"}
available = agent.collect_available()
assert available == {"qwen3.8-27b": "splash:incoai/Qwen3.8-27B-Splash", "qwen3-8b": "qwen3:8b"}, available
report = agent.splash_engine_report(available)
assert report == {"qwen3.8-27b": {"engine": "splash", "package": "incoai/Qwen3.8-27B-Splash", "port": 8000}}, report
# graceful fallback: splash not ready -> excluded, ollama mapping unaffected
agent.splash_ready = lambda spec, timeout=5: False
available = agent.collect_available()
assert available == {"qwen3-8b": "qwen3:8b"}, available
assert agent.splash_engine_report(available) == {}
print("advertise-ok")
`);
  assert.match(out, /advertise-ok/);
});

test("splash_soft_report never fails and never quotes vendor speed claims", () => {
  const out = probe(`
import io
agent.MODELS = {"qwen3.8-27b": "splash:incoai/Qwen3.8-27B-Splash"}
buf = io.StringIO(); old = __import__("sys").stdout; __import__("sys").stdout = buf
try:
    agent.splash_soft_report()
finally:
    __import__("sys").stdout = old
text = buf.getvalue()
assert "splash" in text, text
for banned in ("144 tok/s", "3x", "3×", "2x", "2×", "4x", "4×"):
    assert banned not in text, text
agent.MODELS = {}
buf = io.StringIO(); __import__("sys").stdout = buf
try:
    agent.splash_soft_report()
finally:
    __import__("sys").stdout = old
assert "opt-in" in buf.getvalue(), buf.getvalue()
print("doctor-ok")
`);
  assert.match(out, /doctor-ok/);
});

test("bench-splash.sh: --help works, capability gate fails cleanly off-macOS", async () => {
  const run = (args) =>
    new Promise((resolve) => {
      execFile(join(kit, "provider/bench-splash.sh"), args, { timeout: 30000 }, (error, stdout, stderr) => {
        resolve({ code: error ? error.code : 0, stdout, stderr });
      });
    });
  const help = await run(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /--package/);
  const bad = await run(["--bogus"]);
  assert.equal(bad.code, 2);
  const gate = await run([]);
  assert.equal(gate.code, 1);
  assert.match(gate.stderr, /macOS required/);
});
