#!/usr/bin/env node
/**
 * Model hardware/engine policy — server-side advertise enforcement.
 * Every catalog id needs a policy row; reported memory below the floor drops
 * the model at poll time; splash engines only where a Splash package exists.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODEL_POLICY,
  modelPolicy,
  modelAllowedEngines,
  policyAllowsModel,
  filterPolicyAllowedModels,
  ENGINE_DEFAULT,
  ENGINE_SPLASH,
} from './dasha-compute-model-policy.mjs';
import { COMPUTE_CATALOG_MODELS, growAllowedModels } from './dasha-compute-network.mjs';

const root = dirname(fileURLToPath(import.meta.url));

// 1. Every server catalog id has a policy row (fail closed otherwise).
for (const id of COMPUTE_CATALOG_MODELS) {
  assert.ok(modelPolicy(id), `catalog id ${id} must have a policy row`);
}
// And every policy row is a catalog id (no orphan rows).
for (const id of Object.keys(MODEL_POLICY)) {
  assert.ok(COMPUTE_CATALOG_MODELS.has(id), `policy row ${id} must be a catalog id`);
}

// 2. Memory floors match the public /compute model table (same numbers shown to providers).
const page = readFileSync(join(root, 'dasha-compute-page.mjs'), 'utf8');
const tableRows = [...page.matchAll(/\['([a-z0-9.-]+)','[^']*','[^']*','[^']*',(\d+),'[^']*'\]/g)];
assert.ok(tableRows.length >= 14, 'page model table present');
for (const [, id, mem] of tableRows) {
  const policy = modelPolicy(id);
  assert.ok(policy, `page model ${id} has a policy row`);
  assert.equal(policy.minMemoryGb, Number(mem), `${id}: policy floor matches page table (${mem} GB)`);
}

// 3. policyAllowsModel semantics.
assert.equal(policyAllowsModel('nope'), false, 'unknown model fails closed');
assert.equal(policyAllowsModel('qwen3-4b'), true, 'known model, no memory reported -> allowed');
assert.equal(policyAllowsModel('qwen3.6-35b', { memoryGb: 36 }), true, 'at floor -> allowed');
assert.equal(policyAllowsModel('qwen3.6-35b', { memoryGb: 35.9 }), false, 'below floor -> denied');
assert.equal(policyAllowsModel('qwen3.6-35b', { memoryGb: 128 }), true, 'above floor -> allowed');
assert.equal(policyAllowsModel('qwen3-4b', { memoryGb: 8 }), true, 'small model on 8GB -> allowed');
assert.equal(policyAllowsModel('gemma3-27b', { memoryGb: 16 }), false, '27B on 16GB -> denied');

// 4. Engine allow-list: splash only where a Splash package exists.
for (const id of COMPUTE_CATALOG_MODELS) {
  assert.ok(modelAllowedEngines(id).includes(ENGINE_DEFAULT), `${id} allows default engine`);
}
assert.ok(modelAllowedEngines('qwen3.8-27b').includes(ENGINE_SPLASH), 'qwen3.8-27b splash-ready');
assert.ok(modelAllowedEngines('qwen3.6-35b').includes(ENGINE_SPLASH), 'qwen3.6-35b splash-ready');
assert.ok(!modelAllowedEngines('qwen3-4b').includes(ENGINE_SPLASH), 'qwen3-4b is not splash-ready');
assert.ok(!modelAllowedEngines('gemma3-27b').includes(ENGINE_SPLASH), 'gemma3-27b is not splash-ready');
assert.deepEqual(modelAllowedEngines('nope'), [], 'unknown model has no engines');
assert.equal(policyAllowsModel('qwen3.8-27b', { engine: 'splash' }), true, 'splash engine allowed where published');
assert.equal(policyAllowsModel('qwen3-4b', { engine: 'splash' }), false, 'splash engine denied elsewhere');

// 5. growAllowedModels enforces the floor against reported memory.
const grown8 = growAllowedModels(['qwen3-4b', 'qwen3.6-35b'], ['gemma3-27b'], COMPUTE_CATALOG_MODELS, 8);
assert.deepEqual(grown8, ['qwen3-4b'], '8GB Mac keeps only sub-floor models');
const grown128 = growAllowedModels([], ['qwen3-4b', 'qwen3.6-35b', 'gpt-oss-120b'], COMPUTE_CATALOG_MODELS, 128);
assert.deepEqual(grown128.sort(), ['gpt-oss-120b', 'qwen3-4b', 'qwen3.6-35b'].sort(), '128GB Mac keeps large models');
const grownUnknown = growAllowedModels([], ['qwen3.6-35b'], COMPUTE_CATALOG_MODELS, null);
assert.deepEqual(grownUnknown, ['qwen3.6-35b'], 'unknown hardware keeps prior behavior');
const grownNoRow = growAllowedModels([], ['lfm2.5-8b-a1b'], COMPUTE_CATALOG_MODELS, 128);
assert.deepEqual(grownNoRow, [], 'held/unknown models stay out regardless of memory');

// 6. filterPolicyAllowedModels helper.
assert.deepEqual(
  filterPolicyAllowedModels(['qwen3-4b', 'qwen3.6-35b', 'nope'], { memoryGb: 16 }).sort(),
  ['qwen3-4b'],
  'filter drops below-floor and unknown ids',
);

console.log('model-policy: PASS');
