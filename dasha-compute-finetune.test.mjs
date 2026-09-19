#!/usr/bin/env node
/** Fine-tune jobs (Phase 1): engine-typed capability, per-engine memory floors,
 *  spec validation/clamping, matching, TTL/lease classes, result contract,
 *  earnings accrual idempotency. */
import assert from 'node:assert/strict';
import {
  finetuneCapability,
  finetuneCanonicalSpecJson,
  finetuneEnginesForPreference,
  finetuneMemoryFloorGb,
  finetuneModelSizeGb,
  finetuneSpecHash,
  growFinetuneEligibility,
  jobEligibleForProvider,
  publicFinetuneTask,
  resolveTuneEngine,
  sanitizeFinetuneEngines,
  sanitizeProviderGpu,
  validateFinetuneSpec,
  validateTuneResult,
} from './dasha-compute-network.mjs';
import {
  accrueTuneEarn,
  earnCentsForTuneJob,
} from './dasha-compute-provider-earn.mjs';

/* ---------- spec validation / clamping ---------- */

const base = { base_model: 'qwen3-8b', dataset_ref: 'ds_abc123' };
const good = validateFinetuneSpec(base);
assert.equal(good.ok, true);
assert.equal(good.spec.finetune_type, 'lora');
assert.equal(good.spec.lora_rank, 8);
assert.equal(good.spec.lora_layers, 16);
assert.equal(good.spec.iters, 750);
assert.equal(good.spec.learning_rate, 1e-5);
assert.equal(good.spec.batch_size, 4);
assert.equal(good.spec.max_seq_length, 2048);
assert.equal(good.spec.grad_accumulation_steps, 8);
assert.equal(good.spec.eval_split, 0.1);
assert.equal(good.spec.replay_mix_ratio, 0.2);
assert.equal(good.spec.seed, 0);
assert.equal(good.spec.save_every, 100);
assert.equal(good.spec.privacy, 'network');
assert.equal(good.spec.engine_preference, 'any');
assert.ok(!('messages' in good.spec), 'unknown fields stripped');

// explicit valid values pass through
const explicit = validateFinetuneSpec({ ...base, finetune_type: 'dora', lora_rank: 16, lora_layers: 4, iters: 50, learning_rate: 1e-6, batch_size: 1, max_seq_length: 4096, grad_accumulation_steps: 32, eval_split: 0.2, replay_mix_ratio: 0.5, seed: -7, save_every: 1000, privacy: 'trusted', engine_preference: 'mlx', rogue_field: 'x' });
assert.equal(explicit.ok, true);
assert.equal(explicit.spec.lora_rank, 16);
assert.equal(explicit.spec.iters, 50);
assert.equal(explicit.spec.engine_preference, 'mlx');
assert.ok(!('rogue_field' in explicit.spec));

// each bad field names the field
const badCases = [
  [{ ...base, base_model: 'gpt-4' }, 'base_model'],
  [{ ...base, base_model: 'qwen3-8b', dataset_ref: 'nope' }, 'dataset_ref'],
  [{ ...base, engine_preference: 'tpu' }, 'engine_preference'],
  [{ ...base, finetune_type: 'full' }, 'finetune_type'],
  [{ ...base, lora_rank: 32 }, 'lora_rank'],
  [{ ...base, lora_layers: 2 }, 'lora_layers'],
  [{ ...base, iters: 49 }, 'iters'],
  [{ ...base, iters: 5001 }, 'iters'],
  [{ ...base, iters: 7.5 }, 'iters'],
  [{ ...base, learning_rate: 1e-3 }, 'learning_rate'],
  [{ ...base, learning_rate: 1e-7 }, 'learning_rate'],
  [{ ...base, batch_size: 3 }, 'batch_size'],
  [{ ...base, max_seq_length: 3000 }, 'max_seq_length'],
  [{ ...base, grad_accumulation_steps: 0 }, 'grad_accumulation_steps'],
  [{ ...base, grad_accumulation_steps: 33 }, 'grad_accumulation_steps'],
  [{ ...base, eval_split: 0.04 }, 'eval_split'],
  [{ ...base, eval_split: 0.21 }, 'eval_split'],
  [{ ...base, replay_mix_ratio: -0.1 }, 'replay_mix_ratio'],
  [{ ...base, replay_mix_ratio: 0.51 }, 'replay_mix_ratio'],
  [{ ...base, seed: 1.5 }, 'seed'],
  [{ ...base, save_every: 49 }, 'save_every'],
  [{ ...base, save_every: 1001 }, 'save_every'],
  [{ ...base, privacy: 'public' }, 'privacy'],
  [{}, 'base_model'],
];
for (const [input, field] of badCases) {
  const r = validateFinetuneSpec(input);
  assert.equal(r.ok, false, `expected rejection for ${field}`);
  assert.equal(r.field, field, `expected field=${field}`);
}

// cuda is a known engine but not yet supported: 400 naming the field
const cudaPref = validateFinetuneSpec({ ...base, engine_preference: 'cuda' });
assert.equal(cudaPref.ok, false);
assert.equal(cudaPref.field, 'engine_preference');
assert.match(cudaPref.error, /engine not yet supported/);

// license/catalog gates: unsupported model rejected even if size-parseable
assert.equal(validateFinetuneSpec({ base_model: 'llama3-8b', dataset_ref: 'ds_x' }).ok, false);

/* ---------- engine helpers ---------- */

assert.deepEqual(finetuneEnginesForPreference('any'), ['mlx']);
assert.deepEqual(finetuneEnginesForPreference('mlx'), ['mlx']);
assert.deepEqual(finetuneEnginesForPreference('cuda'), [], 'cuda not placeable yet');
assert.deepEqual(finetuneEnginesForPreference(undefined), ['mlx']);

const mlxProvider = { finetune_engines: ['mlx'] };
assert.equal(resolveTuneEngine(mlxProvider, { spec: { engine_preference: 'any' } }), 'mlx');
assert.equal(resolveTuneEngine(mlxProvider, { spec: { engine_preference: 'mlx' } }), 'mlx');
assert.equal(resolveTuneEngine(mlxProvider, {}), 'mlx', 'missing preference defaults to any');
assert.equal(resolveTuneEngine({ finetune_engines: ['cuda'] }, { spec: { engine_preference: 'any' } }), null, 'v1 cannot place cuda');
assert.equal(resolveTuneEngine({ finetune_engines: ['cuda'] }, { spec: { engine_preference: 'mlx' } }), null);
assert.equal(resolveTuneEngine({}, { spec: { engine_preference: 'any' } }), null, 'no advertised engines');

/* ---------- per-engine memory floors ---------- */

assert.equal(finetuneModelSizeGb('qwen3-8b'), 8);
assert.equal(finetuneModelSizeGb('gemma3-12b'), 12);
assert.equal(finetuneModelSizeGb('qwen3-30b-a3b'), 30);
assert.equal(finetuneModelSizeGb('gpt-oss-120b'), 120);
assert.equal(finetuneModelSizeGb('qwen3-4b'), 4);
assert.equal(finetuneModelSizeGb('mystery'), null);

// mlx (unified memory): 1B→4, 3B→6, 7B→10, 8B→10, 13B→16, 32B→24
assert.equal(finetuneMemoryFloorGb('qwen3-4b'), 10, 'default engine is mlx');
assert.equal(finetuneMemoryFloorGb('qwen3-4b', 'mlx'), 10);
assert.equal(finetuneMemoryFloorGb('qwen3-8b', 'mlx'), 10);
assert.equal(finetuneMemoryFloorGb('gemma3-12b', 'mlx'), 16);
assert.equal(finetuneMemoryFloorGb('qwen3-30b-a3b', 'mlx'), 24);
assert.equal(finetuneMemoryFloorGb('qwen3-70b', 'mlx'), null, 'above the mlx tiers: fail closed');
assert.equal(finetuneMemoryFloorGb('gpt-oss-120b', 'mlx'), null);
assert.equal(finetuneMemoryFloorGb('mystery', 'mlx'), null);

// cuda (VRAM): 1B→6, 3B→8, 7B→12, 8B→12, 13B→20, 32B→32, 70B→64
assert.equal(finetuneMemoryFloorGb('qwen3-1b', 'cuda'), 6);
assert.equal(finetuneMemoryFloorGb('qwen3-4b', 'cuda'), 12);
assert.equal(finetuneMemoryFloorGb('qwen3-8b', 'cuda'), 12);
assert.equal(finetuneMemoryFloorGb('gemma3-12b', 'cuda'), 20);
assert.equal(finetuneMemoryFloorGb('qwen3-30b-a3b', 'cuda'), 32);
assert.equal(finetuneMemoryFloorGb('qwen3-70b', 'cuda'), 64);
assert.equal(finetuneMemoryFloorGb('gpt-oss-120b', 'cuda'), null, 'above the cuda tiers: fail closed');
assert.equal(finetuneMemoryFloorGb('qwen3-8b', 'tpu'), null, 'unknown engine: fail closed');

/* ---------- capability sanitizing + stickiness ---------- */

assert.deepEqual(sanitizeFinetuneEngines(['mlx']), ['mlx']);
assert.deepEqual(sanitizeFinetuneEngines(['MLX', 'mlx', 'cuda', 'rocm', 'bad!!', 'UPPER-2']), ['mlx', 'cuda', 'rocm', 'upper-2'], 'lowercased, deduped, invalid dropped');
assert.equal(sanitizeFinetuneEngines(['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9']).length, 8, 'max 8 engines');
assert.deepEqual(sanitizeFinetuneEngines([]), [], 'explicit empty array is a clear, not an omission');
assert.equal(sanitizeFinetuneEngines(undefined), null, 'omitted field is the stickiness marker');
assert.equal(sanitizeFinetuneEngines(null), null);
assert.equal(sanitizeFinetuneEngines(true), null, 'non-array treated as omitted');

assert.deepEqual(finetuneCapability({ finetune_engines: ['mlx'], finetune_memory_gb: 28.55 }), { finetune_engines: ['mlx'], finetune_memory_gb: 28.6 });
assert.deepEqual(finetuneCapability({ finetune_engines: ['mlx'], finetune_memory_gb: -5 }), { finetune_engines: ['mlx'], finetune_memory_gb: null });
assert.deepEqual(finetuneCapability({ finetune_engines: ['mlx'], finetune_memory_gb: 99999 }), { finetune_engines: ['mlx'], finetune_memory_gb: null });
assert.deepEqual(finetuneCapability({}), { finetune_engines: null, finetune_memory_gb: null }, 'omission preserves prior via the sticky gate');

assert.deepEqual(
  growFinetuneEligibility({ finetune_engines: [], finetune_memory_gb: null }, { finetune_engines: ['mlx'], finetune_memory_gb: 20 }),
  { finetune_engines: ['mlx'], finetune_memory_gb: 20 },
);
assert.deepEqual(
  growFinetuneEligibility({ finetune_engines: ['mlx'], finetune_memory_gb: 20 }, { finetune_engines: null, finetune_memory_gb: null }),
  { finetune_engines: ['mlx'], finetune_memory_gb: 20 },
  'older kit omitting the field keeps the capability',
);
assert.deepEqual(
  growFinetuneEligibility({ finetune_engines: ['mlx'], finetune_memory_gb: 20 }, { finetune_engines: [], finetune_memory_gb: null }),
  { finetune_engines: [], finetune_memory_gb: null },
  'explicit empty array clears',
);
assert.deepEqual(
  growFinetuneEligibility({ finetune_engines: ['mlx'], finetune_memory_gb: 20 }, { finetune_engines: ['mlx'], finetune_memory_gb: null }),
  { finetune_engines: ['mlx'], finetune_memory_gb: 20 },
  'engines without memory keeps prior memory',
);
assert.deepEqual(
  growFinetuneEligibility({}, { finetune_engines: ['mlx'], finetune_memory_gb: null }),
  { finetune_engines: ['mlx'], finetune_memory_gb: null },
);
assert.deepEqual(
  growFinetuneEligibility({}, { finetune_engines: null, finetune_memory_gb: 20 }),
  { finetune_engines: [], finetune_memory_gb: null },
  'memory without engines is dropped',
);

/* ---------- defensive gpu advertisement ---------- */

assert.deepEqual(
  sanitizeProviderGpu({ model: 'RTX 4090', vram_gb: 24, cuda_version: '12.4' }),
  { model: 'RTX 4090', vram_gb: 24, cuda_version: '12.4' },
);
assert.equal(sanitizeProviderGpu(undefined), null);
assert.equal(sanitizeProviderGpu(null), null);
assert.equal(sanitizeProviderGpu('nope'), null);
assert.equal(sanitizeProviderGpu({}), null, 'empty object sanitizes to nothing');
assert.deepEqual(sanitizeProviderGpu({ model: 'x'.repeat(100), vram_gb: NaN }), { model: 'x'.repeat(64) }, 'strings capped at 64, non-finite numbers dropped');

/* ---------- type-aware matching ---------- */

// legacy chat predicate preserved
const chatProvider = { models: ['qwen3-8b'], owner: 'x:a' };
assert.equal(jobEligibleForProvider(chatProvider, { status: 'queued', model: 'qwen3-8b' }), true);
assert.equal(jobEligibleForProvider(chatProvider, { status: 'queued', kind: 'chat', model: 'qwen3-8b' }), true);
assert.equal(jobEligibleForProvider(chatProvider, { status: 'queued', model: 'gemma3-12b' }), false);
assert.equal(jobEligibleForProvider(chatProvider, { status: 'leased', model: 'qwen3-8b' }), false);
assert.equal(jobEligibleForProvider(chatProvider, { status: 'queued', model: 'qwen3-8b', route: 'self' }), false);
assert.equal(jobEligibleForProvider({ models: ['qwen3-8b'], owner: 'x:a' }, { status: 'queued', model: 'qwen3-8b', route: 'self', owner: 'x:a' }), true);

// chat jobs never match on finetune capability alone
assert.equal(jobEligibleForProvider({ finetune_engines: ['mlx'], finetune_memory_gb: 64, models: [], owner: 'x:a' }, { status: 'queued', kind: 'chat', model: 'qwen3-8b' }), false);

const tuneJob = { status: 'queued', kind: 'finetune', base_model: 'qwen3-8b', privacy: 'network', owner: 'x:owner', spec: { engine_preference: 'any' } };
const tuneProvider = { finetune_engines: ['mlx'], finetune_memory_gb: 10, models: [], owner: 'x:p' };
assert.equal(jobEligibleForProvider(tuneProvider, tuneJob), true, 'exact mlx floor qualifies');
assert.equal(jobEligibleForProvider({ ...tuneProvider, finetune_memory_gb: 9.9 }, tuneJob), false, 'below floor rejected');
assert.equal(jobEligibleForProvider({ ...tuneProvider, finetune_engines: [] }, tuneJob), false, 'no engines rejected');
assert.equal(jobEligibleForProvider({ ...tuneProvider, finetune_engines: ['cuda'] }, tuneJob), false, 'v1 cannot place cuda-only providers');
assert.equal(jobEligibleForProvider({ ...tuneProvider, finetune_memory_gb: null }, tuneJob), false, 'no memory rejected');
assert.equal(jobEligibleForProvider({ ...tuneProvider, models: ['qwen3-8b'] }, tuneJob), true, 'model list irrelevant for tune jobs');
assert.equal(jobEligibleForProvider(tuneProvider, { ...tuneJob, base_model: 'gemma3-12b' }), false, '12B needs 16GB on mlx');
assert.equal(jobEligibleForProvider({ ...tuneProvider, finetune_memory_gb: 16 }, { ...tuneJob, base_model: 'gemma3-12b' }), true);
// engine preference narrows matching
assert.equal(jobEligibleForProvider(tuneProvider, { ...tuneJob, spec: { engine_preference: 'mlx' } }), true);
assert.equal(jobEligibleForProvider({ ...tuneProvider, finetune_engines: ['cuda'] }, { ...tuneJob, spec: { engine_preference: 'mlx' } }), false);

// privacy tiers
assert.equal(jobEligibleForProvider({ ...tuneProvider, trusted: true }, { ...tuneJob, privacy: 'trusted' }), true);
assert.equal(jobEligibleForProvider(tuneProvider, { ...tuneJob, privacy: 'trusted' }), false, 'trusted tier needs the flag');
assert.equal(jobEligibleForProvider({ ...tuneProvider, owner: 'x:owner' }, { ...tuneJob, privacy: 'local' }), true);
assert.equal(jobEligibleForProvider(tuneProvider, { ...tuneJob, privacy: 'local' }), false, 'local = owner Mac only');

/* ---------- spec hash pinning ---------- */

const h1 = await finetuneSpecHash({ b: 2, a: 1 });
const h2 = await finetuneSpecHash({ a: 1, b: 2 });
assert.equal(h1, h2, 'canonical JSON is order-independent');
assert.match(h1, /^[0-9a-f]{64}$/);
const h3 = await finetuneSpecHash({ a: 1, b: 3 });
assert.notEqual(h1, h3);
assert.ok(!finetuneCanonicalSpecJson({ a: 1 }).includes(' '), 'canonical JSON is compact');

/* ---------- result contract ---------- */

const fakeJob = { id: 'job_t1', engine: 'mlx', spec_hash: 'abc123', spec: { iters: 750, base_model: 'qwen3-8b' } };
const complete = validateTuneResult({
  status: 'complete', spec_hash: 'abc123', engine: 'mlx', iters_done: 750,
  train_loss: [2.41, 2.12, 'oops', NaN], val_loss: 1.87, test_perplexity: 12.4,
  baseline: { test_perplexity: 15.1 }, eval_delta: { perplexity_improved: true },
  adapter_ref: 'adapter://t1',
}, fakeJob);
assert.equal(complete.ok, true);
assert.equal(complete.adapter_ref, 'adapter://t1');
assert.deepEqual(complete.result.train_loss, [2.41, 2.12], 'non-finite loss entries dropped');
assert.equal(complete.result.baseline.test_perplexity, 15.1);
assert.equal(complete.result.eval_delta.perplexity_improved, true);

const failed = validateTuneResult({ status: 'failed', spec_hash: 'abc123', engine: 'mlx', iters_done: 100, error: 'OOM' }, fakeJob);
assert.equal(failed.ok, true);
assert.equal(failed.error, 'OOM');

const preempted = validateTuneResult({ status: 'preempted', spec_hash: 'abc123', engine: 'mlx', iters_done: 200, checkpoint_ref: 'ckpt://t1/200' }, fakeJob);
assert.equal(preempted.ok, true);
assert.equal(preempted.checkpoint_ref, 'ckpt://t1/200');

assert.equal(validateTuneResult({ status: 'complete', spec_hash: 'WRONG', engine: 'mlx', iters_done: 1, adapter_ref: 'a://x' }, fakeJob).ok, false, 'spec_hash mismatch rejected');
assert.equal(validateTuneResult({ status: 'complete', spec_hash: 'abc123', engine: 'cuda', iters_done: 1, adapter_ref: 'a://x' }, fakeJob).ok, false, 'engine mismatch rejected');
assert.equal(validateTuneResult({ status: 'complete', spec_hash: 'abc123', iters_done: 1, adapter_ref: 'a://x' }, fakeJob).ok, false, 'missing engine rejected');
assert.equal(validateTuneResult({ status: 'complete', spec_hash: 'abc123', engine: 'MLX', iters_done: 1, adapter_ref: 'a://x' }, fakeJob).ok, true, 'engine comparison is case-insensitive');
assert.equal(validateTuneResult({ status: 'complete', spec_hash: 'abc123', engine: 'mlx', iters_done: 1 }, fakeJob).ok, false, 'adapter_ref required');
assert.equal(validateTuneResult({ status: 'complete', spec_hash: 'abc123', engine: 'mlx', iters_done: 751, adapter_ref: 'a://x' }, fakeJob).ok, false, 'iters_done bounded by spec iters');
assert.equal(validateTuneResult({ status: 'failed', spec_hash: 'abc123', engine: 'mlx', iters_done: 0 }, fakeJob).ok, false, 'failed needs error');
assert.equal(validateTuneResult({ status: 'preempted', spec_hash: 'abc123', engine: 'mlx', iters_done: 0 }, fakeJob).ok, false, 'preempted needs checkpoint_ref');
assert.equal(validateTuneResult({ status: 'whatever', spec_hash: 'abc123', engine: 'mlx' }, fakeJob).ok, false, 'unknown status rejected');
// the chat content validator must not leak in: no content field required
assert.equal(validateTuneResult({ status: 'complete', spec_hash: 'abc123', engine: 'mlx', iters_done: 0, adapter_ref: 'a://x' }, fakeJob).ok, true);

/* ---------- earnings ---------- */

assert.equal(earnCentsForTuneJob({ wall_clock_min: 12, model_gb: 8 }), 300, '12min x 25c');
assert.equal(earnCentsForTuneJob({ wall_clock_min: 10, model_gb: 12 }), 400, '13B tier 40c');
assert.equal(earnCentsForTuneJob({ wall_clock_min: 4, model_gb: 30 }), 300, '32B tier 75c');
assert.equal(earnCentsForTuneJob({ wall_clock_min: 0, model_gb: 8 }), 0);
assert.equal(earnCentsForTuneJob({ wall_clock_min: 10, model_gb: 0 }), 0, 'unknown size accrues nothing');
assert.equal(earnCentsForTuneJob({ wall_clock_min: 10, model_gb: null }), 0);
assert.equal(earnCentsForTuneJob({}), 0);

const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) { rows.set(key, value); },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};

const first = await accrueTuneEarn(storage, { providerId: 'p1', jobId: 'job_t1', wallClockMin: 12, modelGb: 8 });
assert.equal(first.ok, true);
assert.equal(first.replay, false);
assert.equal(first.usdc_cents, 300);
assert.equal(first.tune, true);
assert.equal(first.wall_clock_min, 12);

const replay = await accrueTuneEarn(storage, { providerId: 'p1', jobId: 'job_t1', wallClockMin: 12, modelGb: 8 });
assert.equal(replay.ok, true);
assert.equal(replay.replay, true);
assert.equal(replay.usdc_cents, 300);
const earnRow = await storage.get('compute:provider-earn:p1');
assert.equal(earnRow.usdc_cents, 300, 'replay must not double-accrue');
assert.equal(earnRow.jobs, 1);

const second = await accrueTuneEarn(storage, { providerId: 'p1', jobId: 'job_t2', wallClockMin: 10, modelGb: 12 });
assert.equal(second.usdc_cents, 400);
assert.equal((await storage.get('compute:provider-earn:p1')).usdc_cents, 700);

assert.equal((await accrueTuneEarn(storage, { providerId: '', jobId: 'job_t3' })).ok, false);

/* ---------- public task view ---------- */

const pub = publicFinetuneTask({ id: 'tune_x', status: 'complete', base_model: 'qwen3-8b', dataset_ref: 'ds_a', privacy: 'network', engine: 'mlx', providerId: 'p1', adapter_ref: 'adapter://x', spec_hash: 'h', createdAt: 1, expiresAt: 2 });
assert.equal(pub.kind, 'finetune');
assert.equal(pub.adapter_ref, 'adapter://x');
assert.equal(pub.engine, 'mlx');
assert.ok(!('spec' in pub), 'full spec not exposed in the public view');
assert.equal(publicFinetuneTask(null), null);

console.log('dasha-compute-finetune: PASS');
