#!/usr/bin/env node
/**
 * /compute/api + /compute/api/v1 docs must mention usage-on-stream for v1, Hosted UI, and jobs/:id when stored.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork, computeApi } from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { USE_SKILL_MD } from './dasha-compute-skills.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /usage\.chat_completions|hosted_chat/);
assert.match(src, /Hosted \/compute\/api\/chat SSE/);
assert.match(src, /jobs\/:id when stored/);
assert.match(src, /usage \(\+ route \+ settle\) when present/);

const html = readFileSync(new URL('./dasha-compute.html', import.meta.url), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs');
assert.match(html, /id=["']api-usage-fine["']/);
assert.match(html, /Usage on stream · v1 \+ Hosted stop · jobs\/:id when stored\./);

const useDisk = readFileSync(new URL('./dasha-compute-skills/USE.md', import.meta.url), 'utf8');
assert.equal(USE_SKILL_MD, useDisk, 'USE.md ↔ skills.mjs');
assert.match(USE_SKILL_MD, /GET \/compute\/api\/v1` → `usage/);
assert.match(USE_SKILL_MD, /GET \/compute\/api\/jobs\/:id/);
assert.match(USE_SKILL_MD, /never invent tokens/);
assert.match(USE_SKILL_MD, /read `usage` from the final stop chunk/);
{
  const m = html.match(/const USE_SKILL="((?:\\.|[^"\\])*)"/);
  assert.ok(m, 'USE_SKILL string present');
  const embed = JSON.parse('"' + m[1] + '"');
  assert.equal(embed, useDisk, 'USE.md ↔ page');
}

const payments = readFileSync(new URL('./COMPUTE-PAYMENTS-LAYERS-2026-09-04.md', import.meta.url), 'utf8');
assert.match(payments, /Hosted `POST \/compute\/api\/chat` SSE also emits/);
assert.doesNotMatch(payments, /does \*\*not\*\* emit OpenAI `usage`/);

const env = { LOBBY_SESSION_SECRET: 'api-usage-docs-secret', AI: { run: async () => ({ response: 'ok' }) } };
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);

function assertUsageDocs(body, label) {
  assert.equal(typeof body.usage, 'object', label);
  assert.match(String(body.usage.chat_completions || ''), /SSE final finish_reason=stop/, label);
  assert.match(String(body.usage.hosted_chat || ''), /\/compute\/api\/chat SSE/, label);
  assert.match(String(body.usage.jobs || ''), /GET \/compute\/api\/jobs\/:id returns stored usage/, label);
  assert.match(String(body.usage.jobs || ''), /never invent/, label);
  assert.match(String(body.billing?.chat_completions || ''), /Prepaid credits \(\$0\.05\/job\)/, label);
}

const gw = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1'));
assert.equal(gw.status, 200);
assertUsageDocs(await gw.json(), 'ComputeNetwork /v1');

const status = await network.fetch(new Request('https://lobby.getdasha.com/compute/api'));
assert.equal(status.status, 200);
const statusBody = await status.json();
assert.match(String(statusBody.usage || ''), /Hosted \/compute\/api\/chat SSE/);
assert.match(String(statusBody.usage || ''), /jobs\/:id when stored/);

const apiStatus = await computeApi(new Request('https://www.getdasha.com/compute/api/status'), env, 'https://www.getdasha.com');
assert.equal(apiStatus.status, 200);
const statusUsage = String((await apiStatus.json()).usage || '');
assert.match(statusUsage, /see \/compute\/api\/v1/);
assert.match(statusUsage, /jobs\/:id when stored/);

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const res = await worker.fetch(new Request(`https://${host}/compute/api/v1`), workerEnv);
  assert.equal(res.status, 200, host);
  assertUsageDocs(await res.json(), `${host} /v1`);
}

console.log('dasha-compute-api-usage-docs.test.mjs: PASS');
