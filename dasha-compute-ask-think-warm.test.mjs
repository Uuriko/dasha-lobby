#!/usr/bin/env node
/**
 * Community Ask / Mac Ollama stall (MAC-ASK-STALL-20260917-2233pt):
 * default think:false so content arrives without a reasoning-only stream;
 * WARM_OK scores final assistant content only — never thinking substring.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const agentSrc = readFileSync(join(root, 'dasha-compute-open-alpha/provider/agent.py'), 'utf8');

assert.match(agentSrc, /def score_warm_ok\(/, 'kit scores WARM_OK');
assert.match(agentSrc, /def final_assistant_content\(/, 'kit reads final assistant content');
assert.match(agentSrc, /def think_opted_in\(/, 'kit keeps explicit think opt-in');
assert.match(agentSrc, /"think": not think_disabled\(local, job\)/, 'payload always sets think');
assert.match(agentSrc, /DASHA_OLLAMA_THINK/, 'env opt-in for intentional think');
assert.match(agentSrc, /Community Ask \/ Ollama stream defaults think off/, 'default off for Ask');
assert.doesNotMatch(agentSrc, /'WARM_OK' in reply/, 'never substring-match WARM_OK');
assert.doesNotMatch(agentSrc, /plugin\.jup\.ag/);

const probe = `
import importlib.util, os, threading
spec = importlib.util.spec_from_file_location(
    "dasha_compute_agent",
    ${JSON.stringify(join(root, 'dasha-compute-open-alpha/provider/agent.py'))},
)
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
agent.MODELS = {"qwen3-4b": "qwen3:4b", "gemma3-12b": "gemma3:12b"}
os.environ.pop("DASHA_OLLAMA_THINK", None)

# Thinking-only / reasoning mention is never WARM_OK — the Mac-warm false-positive class.
thinking_only = {"message": {"content": "", "thinking": "So I need to output \\"WARM_OK Qwen3-4b\\" first"}}
assert agent.score_warm_ok(thinking_only) is False
assert agent.score_warm_ok({"content": "", "reasoning": "WARM_OK WARM_OK WARM_OK"}) is False
assert agent.score_warm_ok("So I need to output WARM_OK Qwen3-") is False
assert agent.score_warm_ok({"reply": {"content": "", "thinking": "WARM_OK mentioned"}}) is False
assert agent.score_warm_ok({"message": {"content": "WARM_OK qwen3-4b", "thinking": "I should say WARM_OK"}}) is True
assert agent.score_warm_ok("WARM_OK") is True
assert agent.score_warm_ok("WARM_OK qwen3-4b") is True

# think:false is the Community Ask default — content is used, thinking is not required.
job = {"id": "job_ask", "model": "qwen3-4b", "messages": [{"role": "user", "content": "hi"}]}
payload = agent.chat_payload(job, True)
assert payload["think"] is False, payload
assert agent.answer_content({"content": "", "thinking": "secret CoT"}, "qwen3:4b", job) == ""
assert agent.answer_content({"content": "hello from the Mac"}, "qwen3:4b", job) == "hello from the Mac"
assert agent.chat_payload({**job, "model": "gemma3-12b"}, False)["think"] is False

# Explicit think flag still works.
assert agent.chat_payload({**job, "think": True}, True)["think"] is True
assert agent.answer_content({"content": "", "thinking": "allowed CoT"}, "qwen3:4b", {"think": True}) == "allowed CoT"

# Stream: thinking-only chunks are dropped; content arrives without requiring thinking.
chunks = []
agent.report_chunk = lambda _job_id, **chunk: chunks.append(chunk)
class ContentAfterThink:
    def __enter__(self): return self
    def __exit__(self, *_args): return False
    def __iter__(self):
        return iter([
            b'{"message":{"content":"","thinking":"I should output WARM_OK qwen3-4b first"}}\\n',
            b'{"message":{"content":"WARM_OK qwen3-4b","thinking":""},"done":true}\\n',
        ])
agent.urllib.request.urlopen = lambda *_args, **_kwargs: ContentAfterThink()
ok = agent.stream_ollama({"id": "job_warm", "model": "qwen3-4b", "messages": []}, threading.Event())
assert ok is True
assert chunks[0]["delta"] == "WARM_OK qwen3-4b", chunks
assert chunks[1]["done"] is True
assert all("I should output" not in str(chunk) for chunk in chunks), chunks
assert agent.score_warm_ok({"message": {"content": chunks[0]["delta"]}}) is True
print("ask-think-warm-probe: PASS")
`;

const out = execFileSync('python3', ['-B', '-c', probe], { encoding: 'utf8' });
assert.match(out, /ask-think-warm-probe: PASS/);

console.log('dasha-compute-ask-think-warm: PASS');
