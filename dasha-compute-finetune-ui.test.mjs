#!/usr/bin/env node
/**
 * Phase 8 fine-tune UI: page module, worker wiring, sitemap parity, new
 * owner-scoped API helpers. Follows the page-test conventions of
 * dasha-compute-start-page.test.mjs (static source inspection for the
 * worker, content pins for the page).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_FINETUNE_PAGE_HTML } from './dasha-compute-finetune-page.mjs';
import { finetuneBaseModels, publicFinetuneTaskDetail, publicFinetuneTask } from './dasha-compute-network.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');
const HTML = COMPUTE_FINETUNE_PAGE_HTML;
const worker = read('dasha-lobby-worker.mjs');
const routes = read('ROUTES.md');
const staticGen = read('dasha-lobby-static-gen.mjs');

/* ---------- page module ---------- */

assert.ok(typeof HTML === 'string' && HTML.length > 5000, 'page HTML exported, non-trivial');
assert.ok(HTML.includes('<title>Fine-tune - Dasha Compute</title>'), 'page title');
assert.ok(HTML.includes('https://www.getdasha.com/compute/finetune'), 'canonical URL');

// hash-routed surfaces
for (const tab of ['data-tab="home"', 'data-tab="new"', 'data-tab="jobs"', 'data-tab="datasets"', 'data-tab="adapters"']) {
  assert.ok(HTML.includes(tab), `tab ${tab} present`);
}
assert.ok(HTML.includes('#/jobs/'), 'job-detail hash route shape');
assert.ok(HTML.includes('vJobDetail') && HTML.includes('vNew') && HTML.includes('vDatasets') && HTML.includes('vAdapters'), 'all views implemented');

// submit flow pins
assert.ok(HTML.includes('/compute/api/finetune/models'), 'model catalog fetch');
assert.ok(HTML.includes('f-dataset') && HTML.includes('/compute/api/finetune/datasets'), 'dataset picker wired');
assert.ok(HTML.includes('lora_rank') && HTML.includes('iters') && HTML.includes('learning_rate'), 'bounded hyperparameters present');
assert.ok(HTML.includes('QLoRA is automatic on 4-bit bases'), 'QLoRA honesty note (not a literal qlora enum)');
assert.ok(HTML.includes('cuda') && HTML.includes('coming soon'), 'CUDA disabled as coming soon');
assert.ok(HTML.includes('/login?return='), '401 redirects to login with return path');

// privacy honesty
assert.ok(HTML.includes('Providers can see your training data'), 'dataset visibility honesty');
assert.ok(HTML.includes('nothing leaves your own machines'), 'local tier explanation');
assert.ok(HTML.includes('network') && HTML.includes('trusted') && HTML.includes('local'), 'all three privacy tiers');

// eval view honesty: authority order, no improvement claims from perplexity
assert.ok(HTML.includes('task A/B') && HTML.includes('retention probes') && HTML.includes('perplexity guardrail') && HTML.includes('LLM judge'), 'eval authority order');
assert.ok(HTML.includes('no quality claim is made from this number'), 'perplexity never renders an improvement claim');
assert.ok(!HTML.toLowerCase().includes('perplexity improved'), 'no perplexity-improved copy');
assert.ok(HTML.includes('train loss'), 'loss sparkline label');
assert.ok(HTML.includes('<svg') && HTML.includes('polyline'), 'sparkline rendering');

// adapters: private by default, explicit publish, download, serve readiness
assert.ok(HTML.includes('private by default'), 'private-by-default copy');
assert.ok(HTML.includes('/publish') && HTML.includes('confirm('), 'explicit publish with confirmation');
assert.ok(HTML.includes('/download') && HTML.includes('.tar.gz'), 'owner download of adapter blob');
assert.ok(HTML.includes('/serve'), 'serve readiness fetch');
assert.ok(HTML.includes('quarantined'), 'quarantine surfaced for failed evals');
assert.ok(HTML.includes('same-engine only'), 'cross-engine serving refused in UI copy');

// no forbidden references
assert.ok(!HTML.includes('plugin.jup.ag'), 'never plugin.jup.ag');

/* ---------- worker wiring ---------- */

assert.ok(worker.includes("import { COMPUTE_FINETUNE_PAGE_HTML } from './dasha-compute-finetune-page.mjs'"), 'page module imported');
assert.ok(worker.includes('function computeFinetunePageResponse(request)'), 'response helper exists');
assert.ok(worker.includes("'X-Dasha-Edge': 'compute-finetune'"), 'edge marker');
assert.ok(worker.includes('attachLlmsHtmlLinks(COMPUTE_FINETUNE_PAGE_HTML)'), 'llms html links attached');
const routeLine = "url.pathname === '/compute/finetune'";
const registrations = worker.split(routeLine).length - 1;
assert.ok(registrations >= 2, `route registered at both dispatch sites (found ${registrations})`);
assert.ok(worker.includes('https://www.getdasha.com/compute/finetune'), 'sitemap row in worker');

/* ---------- sitemap parity ---------- */

assert.ok(staticGen.includes('https://www.getdasha.com/compute/finetune'), 'static-gen sitemap parity');

/* ---------- ROUTES.md ---------- */

for (const row of [
  '`/compute/finetune`',
  'GET /compute/api/finetune/models',
  'GET /compute/api/finetune/{tune_id}',
  'GET /compute/api/finetune/adapters/{ref}/serve',
  'GET /compute/api/finetune/adapters/{ref}/download',
  'compute-finetune',
]) {
  assert.ok(routes.includes(row), `ROUTES.md documents ${row}`);
}

/* ---------- new API helpers ---------- */

const models = finetuneBaseModels();
assert.ok(Array.isArray(models) && models.length === 7, `7 submittable base models (got ${models.length})`);
const qwen8 = models.find((m) => m.id === 'qwen3-8b');
assert.ok(qwen8, 'qwen3-8b listed');
assert.equal(qwen8.size_b, 8);
assert.equal(qwen8.license, 'Apache-2.0');
assert.ok(qwen8.engines.includes('mlx'), 'mlx engine floor present');
assert.equal(qwen8.memory_floors_gb.mlx, 10);
assert.ok(!models.some((m) => m.id === 'gpt-oss-120b'), 'gpt-oss-120b excluded (no memory floor defined)');
for (const m of models) {
  assert.ok(m.engines.length > 0, `${m.id} has at least one trainable engine`);
  assert.ok(typeof m.id === 'string' && Number.isFinite(m.size_b), `${m.id} shape`);
}

const task = {
  id: 'tune_abc123', owner: 'u1', base_model: 'qwen3-8b', dataset_ref: 'ds_abc',
  spec: { engine_preference: 'mlx', iters: 750, lora_rank: 8 },
  spec_hash: 'h1', status: 'complete', gate_verdict: 'pass', evaluated: true,
  gate_reasons: [{ check: 'task_ab', verdict: 'pass', note: 'delta +1.2' }],
  eval_delta: { task_ab: { accuracy_delta: 1.2 } },
  tune_result: { train_loss: [2.1, 1.8], eval_report: { judge: { win_rate: 0.6 } } },
  attempts: [{ providerId: 'p1', outcome: 'success', leasedAt: 5 }],
  createdAt: 1000, expiresAt: 2000,
};
const job = { status: 'complete', attempts: [{ providerId: 'p1', outcome: 'success', leasedAt: 5 }] };
const detail = publicFinetuneTaskDetail(task, job);
assert.ok(detail, 'detail projection returned');
const base = publicFinetuneTask(task);
for (const k of Object.keys(base)) assert.ok(k in detail, `detail includes public task field ${k}`);
assert.deepEqual(detail.gate_reasons, task.gate_reasons);
assert.deepEqual(detail.eval_delta, task.eval_delta);
assert.deepEqual(detail.tune_result, task.tune_result);
assert.deepEqual(detail.spec, task.spec);
assert.equal(detail.attempts.length, 1);
assert.equal(detail.attempts[0].provider_id, 'p1');
assert.equal(detail.lease, null, 'no lease on completed job');
const leasedJob = { status: 'leased', providerId: 'p9', leaseExpiresAt: 777, attempts: [] };
const leasedDetail = publicFinetuneTaskDetail({ ...task, status: 'leased' }, leasedJob);
assert.equal(leasedDetail.lease.provider_id, 'p9');
assert.equal(leasedDetail.lease.expires_at, 777);
assert.equal(publicFinetuneTaskDetail(null, null), null, 'null-safe');

console.log('dasha-compute-finetune-ui: PASS');
