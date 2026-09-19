/**
 * Compute model hardware/engine policy catalog — server-side advertise enforcement.
 *
 * Every catalog id that may enter allowedModels carries a typed policy row:
 * minimum unified memory (GB) and the engines permitted to serve it.
 *
 * Fail closed: a model with no policy row cannot be advertised. Memory is
 * enforced only when the provider's hardware report includes it (older kits
 * that report no hardware keep today's behavior); a reported memory below the
 * floor drops the model from allowedModels at poll time.
 *
 * Memory floors mirror the public model table on /compute (same numbers the
 * page shows providers); engines mirror the provider skill: only models with
 * a published Splash package may advertise engine 'splash'.
 *
 * Do not invent floors — change a number only from a measured footprint or a
 * vendor-stated requirement, and keep the /compute table in sync.
 */
export const ENGINE_DEFAULT = 'default';
export const ENGINE_SPLASH = 'splash';

/**
 * Live policy rows. minMemoryGb = unified memory floor for the Mac serving it.
 */
export const MODEL_POLICY = Object.freeze({
  'qwen3-4b': { minMemoryGb: 8, engines: [ENGINE_DEFAULT] },
  'qwen3-8b': { minMemoryGb: 8, engines: [ENGINE_DEFAULT] },
  'qwen3.5-4b': { minMemoryGb: 8, engines: [ENGINE_DEFAULT] },
  'qwen3.5-9b': { minMemoryGb: 8, engines: [ENGINE_DEFAULT] },
  'gemma4-e2b': { minMemoryGb: 8, engines: [ENGINE_DEFAULT] },
  'gemma3-12b': { minMemoryGb: 16, engines: [ENGINE_DEFAULT] },
  'gpt-oss-20b': { minMemoryGb: 16, engines: [ENGINE_DEFAULT] },
  'qwen3-30b-a3b': { minMemoryGb: 24, engines: [ENGINE_DEFAULT] },
  'gemma3-27b': { minMemoryGb: 24, engines: [ENGINE_DEFAULT] },
  'ternary-bonsai-2-27b': { minMemoryGb: 24, engines: [ENGINE_DEFAULT] },
  'muse-glimmer-30b': { minMemoryGb: 24, engines: [ENGINE_DEFAULT] },
  'gemma4-26b-a4b': { minMemoryGb: 24, engines: [ENGINE_DEFAULT] },
  'qwen3.8-27b': { minMemoryGb: 24, engines: [ENGINE_DEFAULT, ENGINE_SPLASH] },
  // Splash package incoai/Qwen3.6-35B-A3B-Splash (~20.9 GB); 36 GB unified floor per skill.
  'qwen3.6-35b': { minMemoryGb: 36, engines: [ENGINE_DEFAULT, ENGINE_SPLASH] },
  // GPT-OSS 120B MXFP4 is ~61 GB on disk; 96 GB is the smallest Apple tier with headroom.
  'gpt-oss-120b': { minMemoryGb: 96, engines: [ENGINE_DEFAULT] },
});

export function modelPolicy(id) {
  const key = String(id || '').trim();
  return key ? MODEL_POLICY[key] || null : null;
}

/** Engine allow-list for a model. Unknown model -> no engines (fail closed). */
export function modelAllowedEngines(id) {
  return modelPolicy(id)?.engines || [];
}

/**
 * Server-side advertise check: model must have a policy row, the engine (when
 * given) must be allow-listed, and a reported memory below the floor fails.
 * memoryGb null/undefined = hardware not reported -> memory check skipped.
 */
export function policyAllowsModel(id, { memoryGb = null, engine = null } = {}) {
  const policy = modelPolicy(id);
  if (!policy) return false;
  if (engine != null && !policy.engines.includes(String(engine))) return false;
  // memoryGb null/undefined = hardware not reported -> memory check skipped.
  if (memoryGb == null) return true;
  const mem = Number(memoryGb);
  if (Number.isFinite(mem) && mem < policy.minMemoryGb) return false;
  return true;
}

/** Filter a model id list through the policy (memory-aware). */
export function filterPolicyAllowedModels(ids, { memoryGb = null } = {}) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter(id => policyAllowsModel(id, { memoryGb }));
}
