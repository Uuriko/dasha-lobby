#!/usr/bin/env node
/**
 * Orca residual-control steal: DASHA_RESIDUAL_ALPHA default 0 (stock),
 * openai: Bonsai extras, receipt residual_alpha when the provider reports it.
 * ternary-bonsai-2-27b stays on the catalog. Test-only. No wrangler.
 * No uncensored / jailbreak copy. No invented WARM_OK. No Phase 0 #8/#9.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComputeNetwork, COMPUTE_CATALOG_MODELS, growAllowedModels, publicPhase0Receipt } from './dasha-compute-network.mjs';
import { canAdvertiseModel } from './dasha-compute-model-license.mjs';
import {
  attachResidualControl,
  BONSAI_MODEL_ID,
  BONSAI_RESIDUAL_SITES,
  parseResidualAlpha,
  residualControlFields,
} from './dasha-compute-receipt-honesty.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const note = readFileSync(join(root, 'COMPUTE-ORCA-RESIDUAL-2026-09-18.md'), 'utf8');
const agentSrc = readFileSync(join(root, 'dasha-compute-open-alpha/provider/agent.py'), 'utf8');
const installSrc = readFileSync(join(root, 'dasha-compute-open-alpha/install.sh'), 'utf8');
const readme = readFileSync(join(root, 'dasha-compute-open-alpha/README.md'), 'utf8');
const envExample = readFileSync(join(root, 'dasha-compute-open-alpha/.env.example'), 'utf8');
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
const honestySrc = readFileSync(join(root, 'dasha-compute-receipt-honesty.mjs'), 'utf8');

const BANNED = /uncensored|jailbreak|abliterat|refusal-marketing|advbench|harmbench/i;
for (const [label, text] of [
  ['note', note],
  ['agent', agentSrc],
  ['readme', readme],
  ['env', envExample],
  ['network', networkSrc],
  ['honesty', honestySrc],
]) {
  assert.doesNotMatch(text, BANNED, `${label} stays technical`);
}
assert.doesNotMatch(note + readme + envExample + honestySrc, /plugin\.jup\.ag/, 'new copy no plugin');
assert.doesNotMatch(note + honestySrc + networkSrc, /WARM_OK/, 'residual hook does not invent a warm probe');

assert.match(note, /bit-identical/);
assert.match(note, /129 residual/);
assert.match(note, /Apple Silicon|local Mac/);
assert.match(note, /DASHA_RESIDUAL_ALPHA/);
assert.match(note, /α default \*\*0\*\*|default \*\*0\*\*|default `0`/);
assert.match(note, /Not live until Instinct/);
assert.match(note, /ternary-bonsai-2-27b/);

assert.match(agentSrc, /DASHA_RESIDUAL_ALPHA/);
assert.match(agentSrc, /def residual_alpha\(/);
assert.match(agentSrc, /def openai_chat_extras\(/);
assert.match(agentSrc, /def backend_spec\(/);
assert.match(agentSrc, /BONSAI_RESIDUAL_SITES = 129/);
assert.match(agentSrc, /Default 0 = stock/);
assert.match(installSrc, /A-Za-z0-9_\.\/:,=-\]/);
assert.match(installSrc, /DASHA_RESIDUAL_ALPHA/);
assert.match(readme, /DASHA_RESIDUAL_ALPHA/);
assert.match(envExample, /DASHA_RESIDUAL_ALPHA=0/);
assert.match(honestySrc, /residualControlFields/);
assert.match(networkSrc, /residualControlFields/);
assert.match(networkSrc, /['"]ternary-bonsai-2-27b['"]/);

assert.ok([...COMPUTE_CATALOG_MODELS].includes(BONSAI_MODEL_ID), 'catalog keeps Community bonsai');
assert.ok([...COMPUTE_CATALOG_MODELS].includes('gemma3-27b'), 'do not demote gemma3-27b');
assert.equal(canAdvertiseModel(BONSAI_MODEL_ID), true);
assert.deepEqual(growAllowedModels(['qwen3-8b'], [BONSAI_MODEL_ID]).sort(), ['qwen3-8b', BONSAI_MODEL_ID]);
assert.ok(!growAllowedModels(['qwen3-8b'], ['qwen3-8b']).includes(BONSAI_MODEL_ID), 'unpolled bonsai stays locked');

assert.equal(parseResidualAlpha(undefined), null);
assert.equal(parseResidualAlpha(''), null);
assert.equal(parseResidualAlpha('nope'), null);
assert.equal(parseResidualAlpha(99), null);
assert.equal(parseResidualAlpha(0), 0);
assert.equal(parseResidualAlpha('0'), 0);
assert.equal(parseResidualAlpha(1), 1);
assert.deepEqual(residualControlFields({ residual_alpha: 0 }, 'qwen3-8b'), {}, 'non-bonsai omit');
assert.deepEqual(residualControlFields({}, BONSAI_MODEL_ID), {}, 'never invent 0');
assert.deepEqual(residualControlFields({ residual_alpha: 0 }, BONSAI_MODEL_ID), { residual_alpha: 0 });
assert.deepEqual(
  residualControlFields({ residual_alpha: 0, residual_site_count: BONSAI_RESIDUAL_SITES }, BONSAI_MODEL_ID),
  { residual_alpha: 0, residual_site_count: 129 },
);

const stock = publicPhase0Receipt({
  id: 'job_bonsai_stock', model: BONSAI_MODEL_ID, route: 'community', status: 'complete',
  residual_alpha: 0, residual_site_count: 129,
});
assert.equal(stock.residual_alpha, 0);
assert.equal(stock.residual_site_count, 129);
assert.equal(stock.attestation, null);

const omitted = publicPhase0Receipt({
  id: 'job_bonsai_omit', model: BONSAI_MODEL_ID, route: 'community', status: 'complete',
});
assert.equal('residual_alpha' in omitted, false, 'Worker does not invent residual_alpha');

const qwen = publicPhase0Receipt({
  id: 'job_qwen', model: 'qwen3-8b', route: 'community', status: 'complete', residual_alpha: 1,
});
assert.equal('residual_alpha' in qwen, false, 'qwen cannot smuggle residual_alpha');
assert.deepEqual(attachResidualControl({ job_id: 'x' }, { model: 'qwen3-8b', residual_alpha: 1 }), { job_id: 'x' });

const probe = `
import importlib.util, os
spec = importlib.util.spec_from_file_location(
    "dasha_compute_agent",
    ${JSON.stringify(join(root, 'dasha-compute-open-alpha/provider/agent.py'))},
)
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
os.environ.pop("DASHA_RESIDUAL_ALPHA", None)
bonsai = "openai:http://127.0.0.1:8080/v1:Ternary-Bonsai-2-27B-PQ2_0"
spec_row = agent.backend_spec(bonsai)
assert spec_row["kind"] == "openai", spec_row
assert spec_row["base"] == "http://127.0.0.1:8080/v1", spec_row
assert spec_row["model"] == "Ternary-Bonsai-2-27B-PQ2_0", spec_row
assert agent.backend_spec("qwen3:8b")["kind"] == "ollama"
assert agent.residual_alpha() == 0.0
extras = agent.openai_chat_extras("ternary-bonsai-2-27b", bonsai)
assert extras["residual_alpha"] == 0.0, extras
assert extras["alpha"] == 0.0, extras
assert agent.openai_chat_extras("qwen3-8b", "qwen3:8b") == {}
os.environ["DASHA_RESIDUAL_ALPHA"] = "0.5"
assert agent.residual_alpha() == 0.5
assert agent.openai_chat_extras("ternary-bonsai-2-27b", bonsai)["residual_alpha"] == 0.5
os.environ["DASHA_RESIDUAL_ALPHA"] = "nope"
assert agent.residual_alpha() == 0.0
os.environ.pop("DASHA_RESIDUAL_ALPHA", None)
agent.MODELS = {"ternary-bonsai-2-27b": bonsai}
fields = agent.result_residual_fields({"model": "ternary-bonsai-2-27b"})
assert fields == {"residual_alpha": 0.0, "residual_site_count": 129}, fields
payload = agent.openai_chat_payload(
    {"model": "ternary-bonsai-2-27b", "messages": [{"role": "user", "content": "hi"}], "temperature": 0.2, "max_tokens": 8},
    False,
    spec_row,
)
assert payload["residual_alpha"] == 0.0, payload
assert payload["alpha"] == 0.0, payload
assert payload["model"] == "Ternary-Bonsai-2-27B-PQ2_0"
print("residual-alpha-probe: PASS")
`;
const out = execFileSync('python3', ['-B', '-c', probe], { encoding: 'utf8' });
assert.match(out, /residual-alpha-probe: PASS/);

{
  const env = {
    AI: { run: async () => ({ response: 'ok' }) },
    ALLOWED_ORIGINS: 'https://www.getdasha.com',
    LOBBY_SESSION_SECRET: 'residual-alpha-secret',
  };
  const token = await createSessionToken(env, { xId: 'residual', handle: 'residual_mac' });
  globalThis.WebSocketRequestResponsePair ||= class {};
  const rows = new Map();
  const storage = {
    async get(key) { return rows.get(key); },
    async put(key, value) { if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item); else rows.set(key, value); },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
    async getAlarm() { return Date.now(); }, async setAlarm() {},
  };
  let ready;
  const network = new ComputeNetwork({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
  await ready;
  const origin = 'https://www.getdasha.com';
  const userHeaders = { Cookie: `${COOKIE}=${token}`, Origin: origin, 'Content-Type': 'application/json' };

  const register = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Bonsai Mac', models: [BONSAI_MODEL_ID] }),
  }), origin);
  assert.equal(register.status, 201, await register.clone().text());
  const creds = await register.json();
  const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
  assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
    method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: creds.provider_id, name: 'Bonsai Mac', models: [BONSAI_MODEL_ID] }),
  }), origin)).status, 204);

  const jobRes = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
    method: 'POST', headers: userHeaders, body: JSON.stringify({ model: BONSAI_MODEL_ID, prompt: 'pack-fidelity' }),
  }), origin);
  assert.equal(jobRes.status, 202, await jobRes.clone().text());
  const queued = await jobRes.json();

  let leased;
  for (let attempt = 0; attempt < 40; attempt++) {
    const poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
      method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: creds.provider_id, name: 'Bonsai Mac', models: [BONSAI_MODEL_ID] }),
    }), origin);
    if (poll.status === 200) {
      leased = (await poll.json()).job;
      break;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.ok(leased?.id, 'provider leased the bonsai job');
  assert.equal(leased.id, queued.id);

  const posted = await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${leased.id}/result`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: creds.provider_id,
      content: 'bonsai-ok',
      residual_alpha: 0,
      residual_site_count: 129,
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
    }),
  }), origin);
  assert.equal(posted.status, 202, await posted.clone().text());

  const got = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${leased.id}`, {
    headers: userHeaders,
  }), origin)).json();
  assert.equal(got.status, 'complete');
  assert.equal(got.receipt.model_id, BONSAI_MODEL_ID);
  assert.equal(got.receipt.residual_alpha, 0);
  assert.equal(got.receipt.residual_site_count, 129);
  assert.equal(got.receipt.attestation, null);
}

console.log('dasha-compute-residual-alpha: PASS (kit extras default 0 + bonsai receipt; catalog stays)');
